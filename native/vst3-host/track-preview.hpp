// MELORIX GĐ3C: bounded genuine VST3 per-track audition PCM.
// IMPORTANT: this does not render audio in the Electron/web host. Only
// IAudioProcessor::process() returns samples. WAV stays in memory: no temp
// files are written to C: or any other disk. Browser AudioContext drives the
// user's Windows output device for the audition. No WASAPI/ASIO native RT yet.
// SPDX-License-Identifier: MIT
#pragma once
#include "public.sdk/source/vst/hosting/eventlist.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/vstspeaker.h"
#include <cstdint>
#include <vector>
#include <string>
#include <cmath>
#include <algorithm>
#include <memory>
#include <cstring>

namespace MelorixPreview {
using namespace Steinberg;
using namespace Steinberg::Vst;
constexpr int kSampleRate=44100;
constexpr int kBlock=256;
struct Rendered {
 bool ok{false};
 std::string message;
 std::string wavBase64;
 int frames{0};
 int nonzero{0};
 double peak{0.};
};
inline void push16(std::vector<uint8_t>& dst,uint16_t value){
 dst.push_back(static_cast<uint8_t>(value));
 dst.push_back(static_cast<uint8_t>(value>>8));
}
inline void push32(std::vector<uint8_t>& dst,uint32_t value){
 push16(dst,static_cast<uint16_t>(value));
 push16(dst,static_cast<uint16_t>(value>>16));
}
inline std::string base64(const std::vector<uint8_t>& bytes){
 static constexpr char alphabet[]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
 std::string result;
 result.reserve(((bytes.size()+2)/3)*4);
 for(size_t i=0;i<bytes.size();i+=3){
  const auto a=bytes[i];
  const auto b=i+1<bytes.size()?bytes[i+1]:0;
  const auto c=i+2<bytes.size()?bytes[i+2]:0;
  result.push_back(alphabet[a>>2]);
  result.push_back(alphabet[((a&3)<<4)|(b>>4)]);
  result.push_back(i+1<bytes.size()?alphabet[((b&15)<<2)|(c>>6)]:'=');
  result.push_back(i+2<bytes.size()?alphabet[c&63]:'=');
 }
 return result;
}
inline Rendered render(IComponent* component,int pitch,int velocity,int durationMs){
 Rendered result;
 if(!component||pitch<0||pitch>127||velocity<1||velocity>127||
    durationMs<100||durationMs>3000){
  result.message="Invalid VST3 track or MIDI audition request";return result;
 }
 // The note-on duration plus 350ms release, bounded by a few megabytes IPC.
 const int noteOff=durationMs*kSampleRate/1000;
 const int totalFrames=noteOff+static_cast<int>(0.35*kSampleRate);
 IAudioProcessor* raw=nullptr;
 if(component->queryInterface(IAudioProcessor::iid,reinterpret_cast<void**>(&raw))!=kResultOk||!raw){
  result.message="Selected VST3 has no audio processor";return result;
 }
 Steinberg::IPtr<IAudioProcessor> processor=Steinberg::owned(raw);
 bool active=false,processing=false;
 do{
  if(component->getBusCount(kAudio,kOutput)<1||component->getBusCount(kEvent,kInput)<1){
   result.message="Selected VST3 has no stereo output or note-event input";break;
  }
  SpeakerArrangement stereo=SpeakerArr::kStereo;
  if(processor->setBusArrangements(nullptr,0,&stereo,1)!=kResultOk){
   result.message="VST3 does not accept stereo output bus";break;
  }
  if(component->activateBus(kAudio,kOutput,0,true)!=kResultOk ||
     component->activateBus(kEvent,kInput,0,true)!=kResultOk){
   result.message="VST3 could not activate audio/MIDI buses";break;
  }
  ProcessSetup setup{};
  setup.processMode=kOffline;
  setup.symbolicSampleSize=kSample32;
  setup.maxSamplesPerBlock=kBlock;
  setup.sampleRate=kSampleRate;
  if(processor->canProcessSampleSize(kSample32)!=kResultOk ||
     processor->setupProcessing(setup)!=kResultOk){
   result.message="VST3 could not configure 44.1kHz float processing";break;
  }
  if(component->setActive(true)!=kResultOk){
   result.message="VST3 could not activate processing";break;
  }
  active=true;
  if(processor->setProcessing(true)!=kResultOk){
   result.message="VST3 could not start audio processing";break;
  }
  processing=true;
  // IEEE float32 WAV format 3, no compression or synthetic GM fallback.
  // Some plugins return a natural release tail, including Kontakt envelopes.
  std::vector<uint8_t> wav;
  wav.reserve(44+static_cast<size_t>(totalFrames)*8);
  for(char c:"RIFF")if(c)wav.push_back(static_cast<uint8_t>(c));
  push32(wav,36+totalFrames*8);
  for(char c:"WAVE")if(c)wav.push_back(static_cast<uint8_t>(c));
  for(char c:"fmt ")if(c)wav.push_back(static_cast<uint8_t>(c));
  push32(wav,16);push16(wav,3);push16(wav,2); // IEEE-float stereo
  push32(wav,kSampleRate);push32(wav,kSampleRate*8);
  push16(wav,8);push16(wav,32);
  for(char c:"data")if(c)wav.push_back(static_cast<uint8_t>(c));
  push32(wav,totalFrames*8);
  float left[kBlock]{},right[kBlock]{};
  float* channels[2]={left,right};
  AudioBusBuffers bus{};
  bus.numChannels=2;bus.channelBuffers32=channels;
  ProcessData data{};
  data.processMode=kOffline;data.symbolicSampleSize=kSample32;
  data.numInputs=0;data.numOutputs=1;data.outputs=&bus;
  EventList events(8);
  data.inputEvents=&events;
  bool good=true;
  for(int start=0;start<totalFrames;start+=kBlock){
   const int frames=std::min(kBlock,totalFrames-start);
   events.clear();
   if(start==0){
    Event ev{};ev.type=Event::kNoteOnEvent;ev.busIndex=0;ev.sampleOffset=0;
    ev.noteOn.channel=0;ev.noteOn.pitch=static_cast<int16>(pitch);
    ev.noteOn.velocity=static_cast<float>(velocity)/127.f;
    ev.noteOn.noteId=-1;ev.noteOn.length=noteOff;
    events.addEvent(ev);
   }
   if(start<=noteOff&&noteOff<start+frames){
    Event ev{};ev.type=Event::kNoteOffEvent;ev.busIndex=0;ev.sampleOffset=noteOff-start;
    ev.noteOff.channel=0;ev.noteOff.pitch=static_cast<int16>(pitch);
    ev.noteOff.noteId=-1;ev.noteOff.velocity=0.f;
    events.addEvent(ev);
   }
   std::fill_n(left,frames,0.f);std::fill_n(right,frames,0.f);
   bus.silenceFlags=0;data.numSamples=frames;
   if(processor->process(data)!=kResultOk){
    result.message="The VST3 plugin process() returned an error";good=false;break;
   }
   for(int i=0;i<frames;i++){
    for(float value:{left[i],right[i]}){
     if(!std::isfinite(value)){
      result.message="VST3 returned non-finite audio";good=false;break;
     }
     const auto bounded=std::clamp(value,-1.f,1.f);
     result.peak=std::max(result.peak,std::abs(static_cast<double>(value)));
     if(std::abs(value)>1e-4f)++result.nonzero;
     uint32_t bits{};
     static_assert(sizeof(bits)==sizeof(bounded));
     std::memcpy(&bits,&bounded,4);
     push32(wav,bits);
    }
    if(!good)break;
   }
   if(!good)break;
  }
  if(!good)break;
  if(wav.size()!=44+static_cast<size_t>(totalFrames)*8){
   result.message="Generated WAV frame count mismatch";break;
  }
  result.ok=true;result.frames=totalFrames;
  result.wavBase64=base64(wav);
 }while(false);
 if(processing)processor->setProcessing(false);
 if(active)component->setActive(false);
 return result;
}
} // namespace MelorixPreview
