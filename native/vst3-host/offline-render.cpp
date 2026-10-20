// MELORIX VST3 Stage 2B — offline MIDI->VST3->PCM integration probe.
// A standalone C++ Windows process. The host NEVER generates oscillator
// sound; all samples must come from the loaded VST3 IAudioProcessor::process().
// SPDX-License-Identifier: MIT
#include "public.sdk/source/vst/hosting/module.h"
#include "public.sdk/source/vst/hosting/hostclasses.h"
#include "public.sdk/source/vst/hosting/eventlist.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstevents.h"
#include "pluginterfaces/vst/vstspeaker.h"
#include <windows.h>
#include <objbase.h>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <vector>
#include <cmath>
#include <algorithm>
#include <cstdint>
#include <string>

namespace {
using namespace Steinberg;
using namespace Steinberg::Vst;
constexpr int kRate=44100;
constexpr int kFrames=44100;
constexpr int kBlock=256;
constexpr int kNoteOff=22050;
void u16(std::ostream& out,uint16_t n){
 const char x[2]={static_cast<char>(n&255),static_cast<char>((n>>8)&255)};
 out.write(x,2);
}
void u32(std::ostream& out,uint32_t n){
 u16(out,static_cast<uint16_t>(n));u16(out,static_cast<uint16_t>(n>>16));
}
std::string toUtf8(const std::wstring& value){
 if(value.empty())return {};
 int n=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,value.data(),
  static_cast<int>(value.size()),nullptr,0,nullptr,nullptr);
 if(n<=0)return {};
 std::string r(static_cast<size_t>(n),'\0');
 if(!WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,value.data(),
  static_cast<int>(value.size()),r.data(),n,nullptr,nullptr))return {};
 return r;
}
bool writePcmWav(const std::filesystem::path& target,const std::vector<int16_t>& pcm){
 std::ofstream out(target,std::ios::binary|std::ios::trunc);
 if(!out)return false;
 const uint32_t bytes=static_cast<uint32_t>(pcm.size()*sizeof(int16_t));
 out.write("RIFF",4);u32(out,36+bytes);out.write("WAVE",4);
 out.write("fmt ",4);u32(out,16);u16(out,1);u16(out,2);
 u32(out,kRate);u32(out,kRate*2*2);u16(out,4);u16(out,16);
 out.write("data",4);u32(out,bytes);
 // MSVC Windows x64 is little-endian; write explicitly to preserve portability.
 for(auto sample:pcm)u16(out,static_cast<uint16_t>(sample));
 return static_cast<bool>(out);
}
void logFailure(const char* msg){std::cerr<<"MELORIX VST3 PCM: "<<msg<<"\n";}
} // namespace

int wmain(int argc,wchar_t** argv){
 if(argc!=4||std::wstring(argv[1])!=L"--render"){
  logFailure("Usage: melorix-vst3-render.exe --render <instrument.vst3> <output.wav>");
  return 2;
 }
 const std::filesystem::path pluginPath(argv[2]),outputPath(argv[3]);
 std::error_code ec;
 if(pluginPath.extension()!=L".vst3"||!std::filesystem::exists(pluginPath,ec)){
  logFailure("A real installed VST3 instrument file/bundle is required");
  return 3;
 }
 // Do not overwrite audio outside explicitly chosen output path: CI uses temp dir.
 const auto plugin=toUtf8(pluginPath.wstring());
 if(plugin.empty())return 3;
 const HRESULT com=CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
 if(FAILED(com))return 4;
 int exitCode=5;
 {
  std::string error;
  auto module=VST3::Hosting::Module::create(plugin,error);
  if(!module){
   std::cerr<<"SDK module load failed: "<<error<<"\n";
  }else{
   auto factory=module->getFactory();
   bool rendered=false;
   for(const auto& info:factory.classInfos()){
    if(info.category()!=kVstAudioEffectClass)continue;
    auto component=factory.createInstance<IComponent>(info.ID());
    if(!component)continue;
    auto* context=new HostApplication();
    bool initialized=false,activated=false,processing=false;
    IAudioProcessor* processor=nullptr;
    std::vector<int16_t> pcm;
    double peak=0,energy=0,tail=0;
    int nonzero=0;
    do{
     if(component->initialize(context)!=kResultOk){logFailure("IComponent initialize failed");break;}
     initialized=true;
     if(component->getBusCount(kAudio,kOutput)<1||
        component->getBusCount(kEvent,kInput)<1){
      logFailure("Selected VST3 has no stereo output or MIDI event input");break;
     }
     if(component->queryInterface(IAudioProcessor::iid,
         reinterpret_cast<void**>(&processor))!=kResultOk||!processor){
      logFailure("VST3 has no IAudioProcessor");break;
     }
     SpeakerArrangement stereo=SpeakerArr::kStereo;
     if(processor->setBusArrangements(nullptr,0,&stereo,1)!=kResultOk){
      logFailure("VST3 refused stereo bus arrangement");break;
     }
     component->activateBus(kAudio,kOutput,0,true);
     component->activateBus(kEvent,kInput,0,true);
     ProcessSetup setup{};
     setup.processMode=kOffline;
     setup.symbolicSampleSize=kSample32;
     setup.maxSamplesPerBlock=kBlock;
     setup.sampleRate=kRate;
     if(processor->canProcessSampleSize(kSample32)!=kResultOk ||
        processor->setupProcessing(setup)!=kResultOk){
      logFailure("VST3 processor rejected PCM32 setup");break;
     }
     if(component->setActive(true)!=kResultOk){
      logFailure("VST3 failed to activate");break;
     }
     activated=true;
     if(processor->setProcessing(true)!=kResultOk){
      logFailure("VST3 failed to start processing");break;
     }
     processing=true;
     pcm.reserve(static_cast<size_t>(kFrames)*2);
     EventList events(8);
     float left[kBlock]{},right[kBlock]{};
     float* channels[2]={left,right};
     AudioBusBuffers bus{};
     bus.numChannels=2;bus.silenceFlags=0;bus.channelBuffers32=channels;
     ProcessData data{};
     data.processMode=kOffline;
     data.symbolicSampleSize=kSample32;
     data.numInputs=0;
     data.numOutputs=1;
     data.outputs=&bus;
     data.inputEvents=&events;
     bool success=true;
     for(int start=0;start<kFrames;start+=kBlock){
      events.clear();
      const int count=std::min(kBlock,kFrames-start);
      if(start==0){
       Event on{};on.type=Event::kNoteOnEvent;
       on.busIndex=0;on.sampleOffset=0;
       on.noteOn.channel=0;on.noteOn.pitch=69;on.noteOn.velocity=0.85f;
       on.noteOn.noteId=-1;on.noteOn.length=kNoteOff;
       events.addEvent(on);
      }
      if(start<=kNoteOff && kNoteOff<start+count){
       Event off{};off.type=Event::kNoteOffEvent;
       off.busIndex=0;off.sampleOffset=kNoteOff-start;
       off.noteOff.channel=0;off.noteOff.pitch=69;
       off.noteOff.velocity=0.f;off.noteOff.noteId=-1;
       events.addEvent(off);
      }
      std::fill_n(left,count,0.f);std::fill_n(right,count,0.f);
      bus.silenceFlags=0;
      data.numSamples=count;
      if(processor->process(data)!=kResultOk){
       logFailure("IAudioProcessor::process() failed");success=false;break;
      }
      for(int i=0;i<count;++i){
       if(!std::isfinite(left[i])||!std::isfinite(right[i])){
        logFailure("VST3 returned non-finite PCM");success=false;break;
       }
       for(float value:{left[i],right[i]}){
        peak=std::max(peak,std::abs(static_cast<double>(value)));
        energy+=static_cast<double>(value)*value;
        if(std::abs(value)>0.0001f)++nonzero;
        if(start+i>=kNoteOff+3000)tail=std::max(tail,std::abs(static_cast<double>(value)));
        const auto bounded=std::clamp(value,-1.f,1.f);
        pcm.push_back(static_cast<int16_t>(std::lround(bounded*32767.f)));
       }
      }
      if(!success)break;
     }
     if(!success)break;
     // A real instrument must have generated audio from the MIDI events.
     if(nonzero<1000||peak<0.02||peak>1.1||tail>0.0001){
      logFailure("MIDI/VST3 PCM test did not create a bounded, audible note with silence after Note Off");break;
     }
     if(!writePcmWav(outputPath,pcm)){
      logFailure("Cannot write PCM WAV");break;
     }
     std::cout<<"{\"schema\":3,\"vst3Process\":true,\"midiEvents\":2,"
              <<"\"sampleRate\":"<<kRate<<",\"channels\":2,\"frames\":"<<kFrames
              <<",\"nonzeroSamples\":"<<nonzero<<",\"peak\":"<<peak
              <<",\"rms\":"<<std::sqrt(energy/(pcm.size()))
              <<",\"tailPeak\":"<<tail<<"}\n";
     rendered=true;exitCode=0;
    }while(false);
    if(processing)processor->setProcessing(false);
    if(activated)component->setActive(false);
    if(processor)processor->release();
    if(initialized)component->terminate();
    context->release();
    if(rendered)break;
   }
  }
 }
 CoUninitialize();
 return exitCode;
}
