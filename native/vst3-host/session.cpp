// MELORIX Stage 3A: native VST3 track-instance session.
// This is an isolated *long-lived* Windows child process. It loads selected
// VST3 components but has NO soundcard, track MIDI scheduling, or plugin GUI yet.
// Commands (UTF-8 stdin, one per line): PING, LIST, LOAD<TAB>track<TAB>path,
// UNLOAD<TAB>track, QUIT. Replies: exactly one JSON object per command.
// No external DLL code is executed until an explicit LOAD command.
// SPDX-License-Identifier: MIT
#include "public.sdk/source/vst/hosting/module.h"
#include "public.sdk/source/vst/hosting/hostclasses.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include <windows.h>
#include <objbase.h>
#include <filesystem>
#include <iostream>
#include <string>
#include <map>
#include <memory>
#include <algorithm>
#include <cwctype>
#include <cstdint>

namespace {
namespace fs=std::filesystem;
using namespace Steinberg;
using namespace Steinberg::Vst;

std::string escape(const std::string& input){
 constexpr char hex[]="0123456789abcdef";
 std::string out="\"";
 for(unsigned char c:input){
  switch(c){
   case '"':out+="\\\"";break;
   case '\\':out+="\\\\";break;
   case '\n':out+="\\n";break;
   case '\r':out+="\\r";break;
   case '\t':out+="\\t";break;
   default:
    if(c<32){out+="\\u00";out+=hex[c>>4];out+=hex[c&15];}
    else out+=static_cast<char>(c);
  }
 }
 return out+'"';
}
std::string utf8(const std::wstring& w){
 if(w.empty())return {};
 const int size=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,
   w.data(),static_cast<int>(w.size()),nullptr,0,nullptr,nullptr);
 if(size<=0)return {};
 std::string result(static_cast<size_t>(size),'\0');
 if(!WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,w.data(),
  static_cast<int>(w.size()),result.data(),size,nullptr,nullptr))return {};
 return result;
}
void reply(const std::string& response){
 std::cout<<response<<"\n"<<std::flush;
}
void fail(const std::string& message){
 reply("{\"schema\":3,\"ok\":false,\"error\":"+escape(message)+"}");
}
bool parseTrack(const std::string& value,int& result){
 if(value.empty()||value.size()>8||
    !std::all_of(value.begin(),value.end(),[](unsigned char c){return c>='0'&&c<='9';}))return false;
 try{
  const auto parsed=std::stoll(value);
  if(parsed<0||parsed>10000000)return false;
  result=static_cast<int>(parsed);return true;
 }catch(...){return false;}
}
bool parsePluginPath(const std::string& raw,fs::path& result){
 if(raw.empty()||raw.size()>4096||raw.find('\n')!=std::string::npos||
    raw.find('\t')!=std::string::npos||raw.find('\r')!=std::string::npos)return false;
 try{
  result=fs::u8path(raw);
  const auto ext=result.extension().wstring();
  if(_wcsicmp(ext.c_str(),L".vst3")!=0)return false;
  std::error_code ec;
  if(!fs::exists(result,ec)||ec)return false;
  result=fs::absolute(result,ec);
  return !ec;
 }catch(...){return false;}
}
struct Loaded {
 // Deliberately own Module BEFORE IComponent and release component first:
 // no plugin factory or DLL object may survive a module unload.
 std::shared_ptr<VST3::Hosting::Module> module;
 // The SDK factory returns an owning IPtr. NEVER assign its temporary to a
 // raw pointer: the temporary would release the instance immediately.
 Steinberg::IPtr<IComponent> component;
 HostApplication* context{nullptr};
 bool initialized{false};
 std::string pluginName;
 fs::path path;
 ~Loaded(){
  if(component){
   if(initialized)component->terminate();
   component=nullptr; // release IPtr while the owning VST3 module is still loaded
  }
  if(context){context->release();context=nullptr;}
  module.reset();
 }
 Loaded()=default;
 Loaded(const Loaded&)=delete;
 Loaded& operator=(const Loaded&)=delete;
};
std::map<int,std::unique_ptr<Loaded>> instances;

void list(){
 std::string out="{\"schema\":3,\"ok\":true,\"operation\":\"list\","
  "\"audioConnected\":false,\"editorOpened\":false,\"tracks\":[";
 bool first=true;
 for(const auto& [id,slot]:instances){
  if(!first)out+=',';
  first=false;
  out+="{\"track\":"+std::to_string(id)+",\"plugin\":"
       +escape(slot->pluginName)+",\"path\":"
       +escape(utf8(slot->path.wstring()))+
       ",\"componentInitialized\":true}";
 }
 out+="]}";
 reply(out);
}
void load(int id,const std::string& raw){
 if(instances.size()>=32&&!instances.count(id)){fail("At most 32 VST3 track instances may be loaded");return;}
 fs::path path;
 if(!parsePluginPath(raw,path)){fail("Choose an existing local .vst3 plugin from the approved scan");return;}
 auto candidate=std::make_unique<Loaded>();
 std::string error;
 // Important: the plugin DLL executes vendor code only inside this child process.
 candidate->module=VST3::Hosting::Module::create(utf8(path.wstring()),error);
 if(!candidate->module){fail("VST3 module could not load: "+error);return;}
 candidate->path=path;
 bool found=false;
 {
  // Factory must die before the module; scope is intentional.
  const auto factory=candidate->module->getFactory();
  for(const auto& info:factory.classInfos()){
   if(info.category()!=kVstAudioEffectClass)continue;
   candidate->component=factory.createInstance<IComponent>(info.ID());
   if(!candidate->component)continue;
   candidate->pluginName=info.name();
   candidate->context=new HostApplication();
   if(candidate->component->initialize(candidate->context)==kResultOk){
    candidate->initialized=true;
    found=true;
   }
   break;
  }
 }
 if(!found){fail("VST3 has no initializable audio component");return;}
 // Replacing an assignment unloads the prior instance AFTER the new one
 // has initialized successfully, preserving the previous assignment on failure.
 instances[id]=std::move(candidate);
 reply("{\"schema\":3,\"ok\":true,\"operation\":\"load\",\"track\":"
   +std::to_string(id)+",\"plugin\":"+escape(instances[id]->pluginName)
   +",\"componentInitialized\":true,\"audioConnected\":false,\"editorOpened\":false}");
}
void unload(int id){
 const auto removed=instances.erase(id);
 reply("{\"schema\":3,\"ok\":true,\"operation\":\"unload\",\"track\":"
  +std::to_string(id)+",\"removed\":"+(removed?"true":"false")+"}");
}
void process(const std::string& line){
 if(line=="PING"){
  reply("{\"schema\":3,\"ok\":true,\"operation\":\"ping\","
   "\"nativeHost\":true,\"audioConnected\":false,\"editorOpened\":false}");
  return;
 }
 if(line=="LIST"){list();return;}
 if(line=="QUIT"){
  instances.clear();
  reply("{\"schema\":3,\"ok\":true,\"operation\":\"quit\"}");
  return;
 }
 if(line.rfind("UNLOAD\t",0)==0){
  int id{};
  if(!parseTrack(line.substr(7),id)){fail("Invalid track ID");return;}
  unload(id);return;
 }
 if(line.rfind("LOAD\t",0)==0){
  const auto delim=line.find('\t',5);
  if(delim==std::string::npos){fail("LOAD requires track ID and path");return;}
  int id{};
  if(!parseTrack(line.substr(5,delim-5),id)){fail("Invalid track ID");return;}
  load(id,line.substr(delim+1));return;
 }
 fail("Unknown native VST3 host command");
}
} // namespace
int main(){
 // A separate COM STA for one native plugin-instance session.
 const HRESULT hr=CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
 if(FAILED(hr)){fail("Could not initialize native COM session");return 3;}
 std::string line;
 while(std::getline(std::cin,line)){
  if(!line.empty()&&line.back()=='\r')line.pop_back();
  if(line.size()>8192){fail("Request too long");continue;}
  if(line=="QUIT"){process(line);break;}
  try{process(line);}
  catch(const std::exception& e){fail(std::string("VST3 native error: ")+e.what());}
  catch(...){fail("Unknown VST3 native error");}
 }
 instances.clear();
 CoUninitialize();
 return 0;
}
