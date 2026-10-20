// MELORIX native VST3 loader PROBE — milestone 2A.
// Steinberg VST3 SDK (MIT), Windows x64. Separate process: third-party DLLs never
// execute in Electron's renderer or main process. No audio or GUI claims yet.
#include "public.sdk/source/vst/hosting/module.h"
#include "public.sdk/source/vst/hosting/hostclasses.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/vsttypes.h"
#include "pluginterfaces/base/ipluginbase.h"
#include <windows.h>
#include <objbase.h>
#include <filesystem>
#include <iostream>
#include <string>
#include <string_view>
#include <vector>

namespace {
std::string toUtf8(const std::wstring& value) {
 if(value.empty()) return {};
 int count=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,value.data(),
   static_cast<int>(value.size()),nullptr,0,nullptr,nullptr);
 if(count<=0) return {};
 std::string result(static_cast<size_t>(count),'\0');
 if(!WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,value.data(),
   static_cast<int>(value.size()),result.data(),count,nullptr,nullptr))return {};
 return result;
}
std::string escape(const std::string& s) {
 static constexpr char digits[]="0123456789abcdef";
 std::string out="\"";
 for(unsigned char c:s){
  switch(c){
  case '"':out+="\\\"";break;case '\\':out+="\\\\";break;
  case '\n':out+="\\n";break;case '\r':out+="\\r";break;
  case '\t':out+="\\t";break;
  default:
   if(c<32){out+="\\u00";out+=digits[c>>4];out+=digits[c&15];}
   else out+=static_cast<char>(c);
  }
 }
 return out+"\"";
}
void failure(std::string_view message) {
 std::cout<<"{\"schema\":2,\"kind\":\"vst3-probe\",\"ok\":false,\"message\":"
          <<escape(std::string(message))<<"}\n";
}
}

int wmain(int argc,wchar_t* argv[]){
 // Do not ever scan then automatically instantiate all plugins: module loading
 // executes vendor code. The caller must select one local plugin explicitly.
 if(argc!=3 || (std::wstring_view(argv[1])!=L"--inspect" &&
                std::wstring_view(argv[1])!=L"--initialize")){
  failure("Usage: melorix-vst3-probe.exe --inspect|--initialize <VST3 bundle path>");
  return 2;
 }
 const bool initialize=std::wstring_view(argv[1])==L"--initialize";
 const std::filesystem::path path(argv[2]);
 std::error_code ec;
 if(path.extension()!=L".vst3"||!std::filesystem::exists(path,ec)||ec){
  failure("The selected plugin must be an existing .vst3 bundle or file.");
  return 3;
 }
 const std::string source=toUtf8(path.wstring());
 if(source.empty()){failure("Invalid Windows Unicode plugin path");return 3;}
 const auto comStatus=CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
 if(FAILED(comStatus)){failure("Windows COM could not initialize");return 4;}
 // The Steinberg loader calls module entry points and GetPluginFactory and
 // properly unloads the module when the shared pointer leaves scope.
 std::string error;
 auto module=VST3::Hosting::Module::create(source,error);
 if(!module){
  failure("VST3 SDK could not load module: "+error);
  CoUninitialize();
  return 5;
 }
 const auto factory=module->getFactory();
 const auto classes=factory.classInfos();
 std::cout<<"{\"schema\":2,\"kind\":\"vst3-probe\",\"ok\":true,\"mode\":"
          <<escape(initialize?"initialize":"inspect")
          <<",\"module\":"<<escape(module->getName())
          <<",\"vendor\":"<<escape(factory.info().vendor())
          <<",\"classes\":[";
 bool first=true;
 bool foundComponent=false;
 bool initialized=false;
 bool audioProcessor=false;
 for(const auto& info:classes) {
  const bool effect=info.category()==kVstAudioEffectClass;
  if(!first)std::cout<<',';
  first=false;
  std::cout<<"{\"name\":"<<escape(info.name())
           <<",\"category\":"<<escape(info.category())
           <<",\"isAudioEffect\":"<<(effect?"true":"false")<<"}";
  if(!initialize||!effect||foundComponent)continue;
  auto component=factory.createInstance<Steinberg::Vst::IComponent>(info.ID());
  if(!component)continue;
  foundComponent=true;
  // Only instantiate after explicit user action; no NKI, sample, or audio
  // data is copied. Exact Kontakt initialize needs QA on licensed machine.
  Steinberg::Vst::HostApplication* context=new Steinberg::Vst::HostApplication();
  if(component->initialize(context)==Steinberg::kResultOk){
   initialized=true;
   Steinberg::Vst::IAudioProcessor* processor=nullptr;
   if(component->queryInterface(Steinberg::Vst::IAudioProcessor::iid,
                   reinterpret_cast<void**>(&processor))==Steinberg::kResultOk &&
      processor){
    audioProcessor=true;
    processor->release();
   }
   component->terminate();
  }
  context->release();
 }
 std::cout<<"],\"factoryClasses\":"<<classes.size()
          <<",\"componentFound\":"<<(foundComponent?"true":"false")
          <<",\"componentInitialized\":"<<(initialized?"true":"false")
          <<",\"audioProcessorInterface\":"<<(audioProcessor?"true":"false")
          <<",\"audioRendered\":false,\"pluginEditorOpened\":false}\n";
 module.reset();
 CoUninitialize();
 return (initialize&&!initialized)?6:0;
}
