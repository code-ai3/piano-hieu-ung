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
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/vst/ivstmidicontrollers.h"
#include <optional>
#include "editor-win32.hpp"
#include "track-preview.hpp"
#include "wasapi-live.hpp"
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
#include <thread>
#include <mutex>
#include <deque>
#include <cstdlib>

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
 Steinberg::IPtr<IEditController> controller;
 bool ownControllerInit{false};
 MelorixEditor::EditorWindow editor;
 HostApplication* context{nullptr};
 bool initialized{false};
 std::string pluginName;
 fs::path path;
 ~Loaded(){
  editor.close();
  if(controller){
   if(ownControllerInit)controller->terminate();
   controller=nullptr;
  }
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
MelorixWasapi::LiveStream liveOutput;
int liveOutputTrack=-1;

void list(){
 std::string out="{\"schema\":3,\"ok\":true,\"operation\":\"list\","
  "\"audioConnected\":" + std::string(liveOutput.running()?"true":"false") +
  ",\"driver\":\"wasapi-shared\",\"liveTrack\":" + std::to_string(liveOutputTrack) +
  ",\"editorOpened\":false,\"tracks\":[";
 bool first=true;
 for(const auto& [id,slot]:instances){
  if(!first)out+=',';
  first=false;
  out+="{\"track\":"+std::to_string(id)+",\"plugin\":"
       +escape(slot->pluginName)+",\"path\":"
       +escape(utf8(slot->path.wstring()))+
       ",\"componentInitialized\":true,\"editorOpened\":"
       +(slot->editor.hwnd?"true":"false")+
       ",\"liveAudio\":"+(liveOutputTrack==id&&liveOutput.running()?"true":"false")+"}";
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
 if(id==liveOutputTrack){liveOutput.stop();liveOutputTrack=-1;}
 instances[id]=std::move(candidate);
 reply("{\"schema\":3,\"ok\":true,\"operation\":\"load\",\"track\":"
   +std::to_string(id)+",\"plugin\":"+escape(instances[id]->pluginName)
   +",\"componentInitialized\":true,\"audioConnected\":false,\"editorOpened\":false}");
}
void openEditor(int id,const std::string& rawOwner){
 const auto it=instances.find(id);
 if(it==instances.end()){fail("Load a VST3 instrument on the track first");return;}
 auto& slot=*it->second;
 if(slot.editor.hwnd){
  ShowWindow(slot.editor.hwnd,SW_RESTORE);
  SetForegroundWindow(slot.editor.hwnd);
  reply("{\"schema\":3,\"ok\":true,\"operation\":\"editor-open\",\"track\":"
    +std::to_string(id)+",\"editorOpened\":true,\"audioConnected\":false}");
  return;
 }
 if(!slot.controller){
  const auto factory=slot.module->getFactory();
  // Single-component VST3 plugins implement IEditController on IComponent.
  IEditController* raw=nullptr;
  if(slot.component->queryInterface(IEditController::iid,reinterpret_cast<void**>(&raw))==kResultOk&&raw){
   slot.controller=Steinberg::owned(raw); // queryInterface returns one owned reference
  }else{
   TUID controllerCID{};
   if(slot.component->getControllerClassId(controllerCID)==kResultOk){
    slot.controller=factory.createInstance<IEditController>(VST3::UID(controllerCID));
    if(slot.controller){
     if(slot.controller->initialize(slot.context)==kResultOk){
      slot.ownControllerInit=true;
     }else{
      slot.controller=nullptr;
     }
    }
   }
  }
 }
 if(!slot.controller){fail("The selected VST3 has no available editor controller");return;}
 // Owner is a window handle only from the trusted Electron main process.
 // "0" is reserved for CI/native diagnostics without Electron.
 HWND owner=nullptr;
 if(rawOwner!="0"){
  try{
   size_t chars=0;
   const auto address=std::stoull(rawOwner,&chars,16);
   if(chars!=rawOwner.size()||!address||address>UINTPTR_MAX){
    fail("Invalid MELORIX owner window");return;
   }
   owner=reinterpret_cast<HWND>(static_cast<uintptr_t>(address));
   if(!IsWindow(owner)){fail("MELORIX owner HWND is not active");return;}
  }catch(...){fail("Invalid MELORIX owner window");return;}
 }
 // The editor view is the actual vendor-rendered native GUI. It is owned
 // by MELORIX, rather than opening Kontakt Standalone or cloning its skin.
 const auto title=L"MELORIX VST3 \u2014 "+fs::u8path(slot.pluginName).wstring();
 if(!slot.editor.open(slot.controller.get(),title,owner)){
  fail("VST3 does not expose a Windows HWND editor or the view cannot attach");
  return;
 }
 reply("{\"schema\":3,\"ok\":true,\"operation\":\"editor-open\",\"track\":"
  +std::to_string(id)+",\"editorOpened\":true,\"audioConnected\":false}");
}
void closeEditor(int id){
 const auto it=instances.find(id);
 if(it==instances.end()){fail("Track has no loaded VST3 instance");return;}
 it->second->editor.close();
 reply("{\"schema\":3,\"ok\":true,\"operation\":\"editor-close\",\"track\":"
  +std::to_string(id)+",\"editorOpened\":false}");
}
void audition(int id,const std::string& args){
 const auto it=instances.find(id);
 if(it==instances.end()){fail("Track has no loaded VST3 instance");return;}
 if(liveOutputTrack==id && liveOutput.running()){
  fail("Stop the WASAPI stream before rendering a separate offline VST3 preview");return;
 }
 const auto a=args.find('\t'),b=a==std::string::npos?std::string::npos:args.find('\t',a+1);
 if(a==std::string::npos||b==std::string::npos||args.find('\t',b+1)!=std::string::npos){
  fail("AUDITION requires MIDI pitch, velocity and duration in milliseconds");return;
 }
 int pitch=0,velocity=0,duration=0;
 auto valid=[](const std::string& value,int& dest){
  if(value.empty()||value.size()>5||
     !std::all_of(value.begin(),value.end(),[](unsigned char c){return c>='0'&&c<='9';}))return false;
  try{dest=std::stoi(value);return true;}catch(...){return false;}
 };
 if(!valid(args.substr(0,a),pitch)||!valid(args.substr(a+1,b-a-1),velocity)||
    !valid(args.substr(b+1),duration)){
  fail("Invalid VST3 audition numeric parameters");return;
 }
 const auto rendered=MelorixPreview::render(it->second->component.get(),pitch,velocity,duration);
 if(!rendered.ok){fail(rendered.message);return;}
 // One JSON reply, VST3 samples stay in memory and go to the renderer as
 // lossless float32 WAV. No files are written to the user's C: drive.
 reply("{\"schema\":3,\"ok\":true,\"operation\":\"audition\",\"track\":"
  +std::to_string(id)+",\"realVst3Pcm\":true,\"audioDevice\":\"electron-web-audio\","
  "\"sampleRate\":44100,\"channels\":2,\"format\":\"wav-f32\","
  "\"frames\":"+std::to_string(rendered.frames)+",\"nonzeroSamples\":"
  +std::to_string(rendered.nonzero)+",\"peak\":"
  +std::to_string(rendered.peak)+",\"wavBase64\":"
  +escape(rendered.wavBase64)+"}");
}
std::optional<ParamID> sustainParamId(Loaded& slot){
 // Kontakt's native editor controller is already available after choosing an NKI.
 if(!slot.controller)return std::nullopt;
 IMidiMapping* mapping=nullptr;
 if(slot.controller->queryInterface(IMidiMapping::iid,reinterpret_cast<void**>(&mapping))!=kResultOk||!mapping)
  return std::nullopt;
 ParamID result=0xffffffffu;
 const auto ok=mapping->getMidiControllerAssignment(0,0,kCtrlSustainOnOff,result)==kResultTrue;
 mapping->release();
 if(!ok||result==0xffffffffu)return std::nullopt;
 return result;
}
void startLive(int id){
 const auto it=instances.find(id);
 if(it==instances.end()){fail("Assign a VST3 instrument before starting Windows audio");return;}
 liveOutput.stop();liveOutputTrack=-1;
 std::string why;
 const auto pedal=sustainParamId(*it->second);
 if(!liveOutput.start(it->second->component.get(),why,pedal)){fail(why);return;}
 liveOutputTrack=id;
 reply("{\"schema\":3,\"ok\":true,\"operation\":\"live-start\",\"track\":"
  +std::to_string(id)+",\"audioConnected\":true,\"driver\":\"wasapi-shared\","
  "\"sampleRate\":"+std::to_string(liveOutput.rate())+"}");
}
void stopLive(){
 liveOutput.stop();liveOutputTrack=-1;
 reply("{\"schema\":3,\"ok\":true,\"operation\":\"live-stop\",\"audioConnected\":false}");
}
void sendLiveNote(const std::string& cmd){
 const auto first=cmd.find('\t'),second=first==std::string::npos?std::string::npos:cmd.find('\t',first+1);
 if(first==std::string::npos||second==std::string::npos||
    cmd.find('\t',second+1)!=std::string::npos){
  fail("LIVE_NOTE requires track, pitch and velocity");return;
 }
 int track=0,pitch=0,velocity=0;
 if(!parseTrack(cmd.substr(0,first),track)||!parseTrack(cmd.substr(first+1,second-first-1),pitch)||
    !parseTrack(cmd.substr(second+1),velocity)||
    track!=liveOutputTrack||pitch>127||velocity>127){
  fail("Live VST3 note does not match an active track or MIDI pitch/velocity");return;
 }
 if(!liveOutput.send(velocity>0,pitch,velocity)){
  fail("WASAPI VST3 stream not ready to receive MIDI notes");return;
 }
 reply("{\"schema\":3,\"ok\":true,\"operation\":\"live-note\",\"track\":"
  +std::to_string(track)+",\"pitch\":"+std::to_string(pitch)+
  ",\"noteOn\":"+(velocity>0?"true":"false")+"}");
}
void sendLivePedal(const std::string& args){
 const auto a=args.find('\t'),b=a==std::string::npos?std::string::npos:args.find('\t',a+1);
 if(a==std::string::npos||b==std::string::npos||args.find('\t',b+1)!=std::string::npos){
  fail("LIVE_CC expects track, controller, value");return;
 }
 int track=0,controller=0,value=0;
 if(!parseTrack(args.substr(0,a),track)||!parseTrack(args.substr(a+1,b-a-1),controller)||
    !parseTrack(args.substr(b+1),value)||track!=liveOutputTrack||controller!=64||value>127){
  fail("CC64 requires an active VST3 track and a value 0-127");return;
 }
 if(!liveOutput.sustainSupported()){
  fail("This VST3 did not expose IMidiMapping for Sustain CC64");return;
 }
 if(!liveOutput.sendSustain(value)){fail("WASAPI MIDI sustain queue is not ready");return;}
 reply("{\"schema\":3,\"ok\":true,\"operation\":\"live-cc\",\"track\":"+
  std::to_string(track)+",\"controller\":64,\"value\":"+std::to_string(value)+"}");
}
void unload(int id){
 if(id==liveOutputTrack){liveOutput.stop();liveOutputTrack=-1;}
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
  liveOutput.stop();liveOutputTrack=-1;
  instances.clear();
  reply("{\"schema\":3,\"ok\":true,\"operation\":\"quit\"}");
  return;
 }
 if(line=="LIVE_STOP"){stopLive();return;}
 if(line.rfind("LIVE_START\t",0)==0){
  int id{};
  if(!parseTrack(line.substr(11),id)){fail("Invalid WASAPI live track ID");return;}
  startLive(id);return;
 }
 if(line.rfind("LIVE_NOTE\t",0)==0){sendLiveNote(line.substr(10));return;}
 if(line.rfind("LIVE_CC\t",0)==0){sendLivePedal(line.substr(8));return;}
 if(line.rfind("AUDITION\t",0)==0){
  const auto split=line.find('\t',9);
  if(split==std::string::npos){fail("AUDITION requires track/pitch/velocity/duration");return;}
  int id{};
  if(!parseTrack(line.substr(9,split-9),id)){fail("Invalid MIDI track ID");return;}
  audition(id,line.substr(split+1));return;
 }
 if(line.rfind("EDITOR_OPEN\t",0)==0){
  const auto split=line.find('\t',12);
  if(split==std::string::npos){fail("EDITOR_OPEN needs track and owner HWND");return;}
  int id{};
  if(!parseTrack(line.substr(12,split-12),id)){fail("Invalid editor track ID");return;}
  openEditor(id,line.substr(split+1));return;
 }
 if(line.rfind("EDITOR_CLOSE\t",0)==0){
  int id{};
  if(!parseTrack(line.substr(13),id)){fail("Invalid editor track ID");return;}
  closeEditor(id);return;
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
// Native editor windows and VST3 UI callbacks must run on the same STA as
// IComponent::initialize(). A reader thread only queues input; it never calls
// vendor code. A Win32 GUI pump processes commands and vendor messages.
std::mutex commandLock;
std::deque<std::string> commands;
HWND commandWindow=nullptr;
constexpr UINT kDispatchCommands=WM_APP+73;
constexpr UINT kDispatchEof=WM_APP+74;
void dispatch(){
 std::deque<std::string> incoming;
 {
  std::lock_guard<std::mutex> guard(commandLock);
  incoming.swap(commands);
 }
 for(const auto& line:incoming){
  try{process(line);}
  catch(const std::exception& e){fail(std::string("VST3 native error: ")+e.what());}
  catch(...){fail("Unknown VST3 native error");}
  if(line=="QUIT"){PostQuitMessage(0);return;}
 }
}
LRESULT CALLBACK commandProc(HWND h,UINT msg,WPARAM w,LPARAM l){
 if(msg==kDispatchCommands){dispatch();return 0;}
 if(msg==kDispatchEof){dispatch();PostQuitMessage(0);return 0;}
 return DefWindowProcW(h,msg,w,l);
}
int main(){
 // A separate COM STA for one native plugin-instance session.
 const HRESULT hr=CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
 if(FAILED(hr)){fail("Could not initialize native COM session");return 3;}
 WNDCLASSW wc{};
 wc.lpfnWndProc=commandProc;
 wc.hInstance=GetModuleHandleW(nullptr);
 wc.lpszClassName=L"MELORIX_VST3_COMMAND_QUEUE";
 if(!RegisterClassW(&wc)&&GetLastError()!=ERROR_CLASS_ALREADY_EXISTS){
  fail("Cannot register Win32 VST3 UI dispatch");CoUninitialize();return 4;
 }
 commandWindow=CreateWindowExW(0,wc.lpszClassName,L"",0,0,0,0,0,
   HWND_MESSAGE,nullptr,wc.hInstance,nullptr);
 if(!commandWindow){fail("Cannot create Win32 VST3 dispatcher");CoUninitialize();return 4;}
 std::thread reader([]{
  std::string line;
  bool quit=false;
  while(std::getline(std::cin,line)){
   if(!line.empty()&&line.back()=='\r')line.pop_back();
   if(line.size()>8192)line="INVALID_LONG_COMMAND";
   const bool last=line=="QUIT";
   {
    std::lock_guard<std::mutex> guard(commandLock);
    commands.push_back(std::move(line));
   }
   PostMessageW(commandWindow,kDispatchCommands,0,0);
   if(last){quit=true;break;}
  }
  if(!quit)PostMessageW(commandWindow,kDispatchEof,0,0);
 });
 MSG msg{};
 while(GetMessageW(&msg,nullptr,0,0)>0){
  TranslateMessage(&msg);
  DispatchMessageW(&msg);
 }
 // QUIT is the expected graceful shutdown; if stdin stayed open after HWND
 // termination, close it so the reader cannot block forever.
 if(reader.joinable())reader.join();
 liveOutput.stop();liveOutputTrack=-1;
 instances.clear();
 DestroyWindow(commandWindow);
 commandWindow=nullptr;
 CoUninitialize();
 return 0;
}
