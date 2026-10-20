// MELORIX Stage 3C (experimental): genuine VST3 processor -> native WASAPI
// shared-mode speaker output, *not* loopMIDI/Kontakt Standalone. A separate
// audio thread owns the WASAPI COM objects and calls IAudioProcessor::process.
// Do not claim Kontakt/ASIO compatibility before QA on a licensed Windows PC.
// SPDX-License-Identifier: MIT
#pragma once
#include "public.sdk/source/vst/hosting/eventlist.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/vstspeaker.h"
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <ksmedia.h>
#include <vector>
#include <deque>
#include <mutex>
#include <atomic>
#include <thread>
#include <condition_variable>
#include <chrono>
#include <string>
#include <algorithm>
#include <cmath>

namespace MelorixWasapi {
using namespace Steinberg;
using namespace Steinberg::Vst;
constexpr int kBlock=256;
struct NoteEvent{bool on;int pitch;float velocity;};
class LiveStream {
public:
 LiveStream()=default;
 LiveStream(const LiveStream&)=delete;
 LiveStream& operator=(const LiveStream&)=delete;
 ~LiveStream(){stop();}
 bool start(IComponent* component,std::string& error){
  stop();
  if(!component){error="No loaded VST3 instance";return false;}
  {
   std::lock_guard<std::mutex> lock(mutex_);
   ready_=false;success_=false;error_.clear();sampleRate_=0;
   source_=component;stopping_=false;
  }
  thread_=std::thread([this]{run();});
  std::unique_lock<std::mutex> lock(mutex_);
  if(!readyCv_.wait_for(lock,std::chrono::seconds(12),[this]{return ready_;})){
   lock.unlock();stop();error="WASAPI/VST3 startup exceeded 12 seconds";return false;
  }
  if(!success_){error=error_;lock.unlock();stop();return false;}
  return true;
 }
 void stop(){
  stopping_=true;
  if(thread_.joinable())thread_.join();
  std::lock_guard<std::mutex> lock(mutex_);
  queue_.clear();
  source_=nullptr;
  ready_=false;success_=false;
 }
 bool send(bool on,int pitch,int velocity){
  if(pitch<0||pitch>127||velocity<0||velocity>127)return false;
  std::lock_guard<std::mutex> lock(mutex_);
  if(!ready_||!success_||stopping_||queue_.size()>=256)return false;
  queue_.push_back({on,pitch,static_cast<float>(velocity)/127.f});
  return true;
 }
 bool running()const{
  std::lock_guard<std::mutex> lock(mutex_);
  return ready_&&success_&&!stopping_;
 }
 int rate()const{
  std::lock_guard<std::mutex> lock(mutex_);
  return sampleRate_;
 }
private:
 mutable std::mutex mutex_;
 std::condition_variable readyCv_;
 std::deque<NoteEvent> queue_;
 std::thread thread_;
 std::atomic<bool> stopping_{false};
 bool ready_{false},success_{false};
 IComponent* source_{nullptr};
 int sampleRate_{0};
 std::string error_;
 void notify(bool success,const std::string& error,int rate=0){
  {
   std::lock_guard<std::mutex> lock(mutex_);
   success_=success;error_=error;sampleRate_=rate;ready_=true;
  }
  readyCv_.notify_all();
 }
 void run(){
  const HRESULT com=CoInitializeEx(nullptr,COINIT_MULTITHREADED);
  if(FAILED(com)){notify(false,"WASAPI COM could not initialize");return;}
  IMMDeviceEnumerator* enumerator=nullptr;
  IMMDevice* device=nullptr;
  IAudioClient* audio=nullptr;
  IAudioRenderClient* output=nullptr;
  WAVEFORMATEX* format=nullptr;
  IAudioProcessor* processor=nullptr;
  bool pluginActive=false,pluginProcessing=false,audioStarted=false,notified=false;
  auto fail=[&](const char* why){
   if(!notified){notify(false,why);notified=true;}
  };
  do{
   HRESULT hr=CoCreateInstance(__uuidof(MMDeviceEnumerator),nullptr,CLSCTX_INPROC_SERVER,
                               __uuidof(IMMDeviceEnumerator),reinterpret_cast<void**>(&enumerator));
   if(FAILED(hr)||!enumerator){fail("Cannot discover Windows audio devices");break;}
   hr=enumerator->GetDefaultAudioEndpoint(eRender,eConsole,&device);
   if(FAILED(hr)||!device){fail("No default Windows output device (WASAPI)");break;}
   hr=device->Activate(__uuidof(IAudioClient),CLSCTX_ALL,nullptr,reinterpret_cast<void**>(&audio));
   if(FAILED(hr)||!audio){fail("Cannot open default WASAPI device");break;}
   hr=audio->GetMixFormat(&format);
   if(FAILED(hr)||!format){fail("Cannot read Windows audio mix format");break;}
   const bool floatFormat=format->wFormatTag==WAVE_FORMAT_IEEE_FLOAT ||
      (format->wFormatTag==WAVE_FORMAT_EXTENSIBLE&&
       IsEqualGUID(reinterpret_cast<WAVEFORMATEXTENSIBLE*>(format)->SubFormat,
                   KSDATAFORMAT_SUBTYPE_IEEE_FLOAT));
   if(!floatFormat||format->wBitsPerSample!=32||format->nChannels<2||
      format->nChannels>8||format->nSamplesPerSec<22050||
      format->nSamplesPerSec>192000){
    fail("WASAPI device needs 32-bit float output with 2-8 channels (shared mode)");break;
   }
   hr=audio->Initialize(AUDCLNT_SHAREMODE_SHARED,0,1000000,0,format,nullptr);
   if(FAILED(hr)){fail("WASAPI shared-mode initialization failed");break;}
   hr=audio->GetService(__uuidof(IAudioRenderClient),reinterpret_cast<void**>(&output));
   if(FAILED(hr)||!output){fail("Cannot obtain WASAPI audio render buffer");break;}
   IComponent* component=nullptr;
   {
    std::lock_guard<std::mutex> lock(mutex_);
    component=source_;
   }
   if(!component){fail("VST3 instance vanished before audio startup");break;}
   if(component->getBusCount(kAudio,kOutput)<1||component->getBusCount(kEvent,kInput)<1){
    fail("VST3 instrument lacks an audio bus or MIDI input");break;
   }
   hr=component->queryInterface(IAudioProcessor::iid,reinterpret_cast<void**>(&processor));
   if(hr!=kResultOk||!processor){fail("VST3 does not implement IAudioProcessor");break;}
   SpeakerArrangement stereo=SpeakerArr::kStereo;
   if(processor->setBusArrangements(nullptr,0,&stereo,1)!=kResultOk){
    fail("VST3 rejected stereo output bus");break;
   }
   if(component->activateBus(kAudio,kOutput,0,true)!=kResultOk||
      component->activateBus(kEvent,kInput,0,true)!=kResultOk){
    fail("VST3 failed to activate audio/MIDI buses");break;
   }
   ProcessSetup setup{};
   setup.processMode=kRealtime;setup.symbolicSampleSize=kSample32;
   setup.maxSamplesPerBlock=kBlock;setup.sampleRate=format->nSamplesPerSec;
   if(processor->canProcessSampleSize(kSample32)!=kResultOk||
      processor->setupProcessing(setup)!=kResultOk){
    fail("VST3 rejected real-time float32 audio processing");break;
   }
   if(component->setActive(true)!=kResultOk){fail("VST3 could not activate");break;}
   pluginActive=true;
   if(processor->setProcessing(true)!=kResultOk){fail("VST3 could not start processing");break;}
   pluginProcessing=true;
   UINT32 bufferFrames=0;
   if(FAILED(audio->GetBufferSize(&bufferFrames))){fail("WASAPI buffer size failed");break;}
   // Start with an entirely silent buffer to avoid startup feedback.
   BYTE* initial=nullptr;
   if(FAILED(output->GetBuffer(bufferFrames,&initial))||
      FAILED(output->ReleaseBuffer(bufferFrames,AUDCLNT_BUFFERFLAGS_SILENT))){
    fail("Cannot initialize WASAPI audio buffer");break;
   }
   if(FAILED(audio->Start())){fail("WASAPI audio stream could not start");break;}
   audioStarted=true;
   notify(true,"",static_cast<int>(format->nSamplesPerSec));
   notified=true;
   float left[kBlock]{},right[kBlock]{};
   float* channels[2]={left,right};
   AudioBusBuffers bus{};
   bus.numChannels=2;bus.channelBuffers32=channels;
   ProcessData pd{};
   pd.processMode=kRealtime;pd.symbolicSampleSize=kSample32;
   pd.numInputs=0;pd.numOutputs=1;pd.outputs=&bus;
   EventList events(256);
   pd.inputEvents=&events;
   while(!stopping_){
    UINT32 padding=0;
    if(FAILED(audio->GetCurrentPadding(&padding))||padding>bufferFrames)break;
    UINT32 available=bufferFrames-padding;
    if(!available){Sleep(3);continue;}
    // Avoid a huge buffer allocation or plugin processing on the Electron UI.
    const auto frames=std::min(available,static_cast<UINT32>(kBlock*4));
    BYTE* rawBuffer=nullptr;
    if(FAILED(output->GetBuffer(frames,&rawBuffer))||!rawBuffer)break;
    auto* samples=reinterpret_cast<float*>(rawBuffer);
    for(UINT32 offset=0;offset<frames;offset+=kBlock){
     const auto count=std::min(static_cast<UINT32>(kBlock),frames-offset);
     events.clear();
     std::deque<NoteEvent> pending;
     {
      std::lock_guard<std::mutex> lock(mutex_);
      pending.swap(queue_);
     }
     for(const auto& e:pending){
      Event ev{};ev.busIndex=0;ev.sampleOffset=0;
      if(e.on){
       ev.type=Event::kNoteOnEvent;
       ev.noteOn.channel=0;ev.noteOn.pitch=static_cast<int16>(e.pitch);
       ev.noteOn.velocity=e.velocity;ev.noteOn.noteId=-1;
      }else{
       ev.type=Event::kNoteOffEvent;
       ev.noteOff.channel=0;ev.noteOff.pitch=static_cast<int16>(e.pitch);
       ev.noteOff.velocity=0.f;ev.noteOff.noteId=-1;
      }
      events.addEvent(ev);
     }
     std::fill_n(left,count,0.f);std::fill_n(right,count,0.f);
     pd.numSamples=static_cast<int32>(count);bus.silenceFlags=0;
     if(processor->process(pd)!=kResultOk){stopping_=true;break;}
     for(UINT32 i=0;i<count;++i){
      const auto dest=(offset+i)*format->nChannels;
      for(UINT32 ch=0;ch<format->nChannels;++ch){
       const auto sample=ch==0?left[i]:(ch==1?right[i]:0.f);
       samples[dest+ch]=std::isfinite(sample)?std::clamp(sample,-1.f,1.f):0.f;
      }
     }
    }
    output->ReleaseBuffer(frames,stopping_?AUDCLNT_BUFFERFLAGS_SILENT:0);
    Sleep(2);
   }
  }while(false);
  if(audioStarted)audio->Stop();
  if(pluginProcessing)processor->setProcessing(false);
  if(pluginActive){
   IComponent* component=nullptr;
   {std::lock_guard<std::mutex> lock(mutex_);component=source_;}
   if(component)component->setActive(false);
  }
  if(processor)processor->release();
  if(format)CoTaskMemFree(format);
  if(output)output->Release();
  if(audio)audio->Release();
  if(device)device->Release();
  if(enumerator)enumerator->Release();
  if(!notified)notify(false,"Cannot run native WASAPI VST3 audio");
  CoUninitialize();
 }
};
} // namespace MelorixWasapi
