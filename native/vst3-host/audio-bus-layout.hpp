// MELORIX VST3 output-bus compatibility.
// Steinberg ProcessData requires an AudioBusBuffers entry for EACH declared
// audio bus, including inactive auxiliary buses (not just one stereo output).
// Keep the plug-in's existing arrangements: forcing 1 stereo bus can be
// rejected by multi-output instruments such as Kontakt 8.
// No plugin DSP or samples are synthesized or persisted by this host.
// SPDX-License-Identifier: MIT
#pragma once
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include <array>
#include <vector>
#include <string>
#include <algorithm>
#include <cstddef>

namespace MelorixAudioBus {
using namespace Steinberg;
using namespace Steinberg::Vst;
constexpr int kBlock=256;
constexpr int kMaxBuses=64;
constexpr int kMaxTotalChannels=256;

class Buffers {
 struct Channels {
  std::vector<std::array<float,kBlock>> samples;
  std::vector<float*> pointers;
 };
 std::vector<Channels> inputs_,outputs_;
 std::vector<AudioBusBuffers> inputBuses_,outputBuses_;
 static bool configure(IComponent* component,BusDirection direction,
                      std::vector<Channels>& storage,
                      std::vector<AudioBusBuffers>& descriptors,
                      std::string& error){
  const int32 count=component->getBusCount(kAudio,direction);
  if(count<0||count>kMaxBuses){
   error="VST3 declares too many audio buses";return false;
  }
  if(direction==kOutput&&count==0){
   error="VST3 instrument has no audio output bus";return false;
  }
  storage.reserve(static_cast<size_t>(count));
  int total=0;
  for(int32 i=0;i<count;++i){
   BusInfo info{};
   if(component->getBusInfo(kAudio,direction,i,info)!=kResultOk||
      info.channelCount<0||info.channelCount>kMaxTotalChannels||
      total>kMaxTotalChannels-info.channelCount){
    error="VST3 audio bus channel layout is unsupported";return false;
   }
   if(direction==kOutput&&i==0&&info.channelCount<1){
    error="VST3 main output bus has no channels";return false;
   }
   total+=info.channelCount;
   storage.emplace_back();
   auto& slot=storage.back();
   slot.samples.resize(static_cast<size_t>(info.channelCount));
   slot.pointers.reserve(static_cast<size_t>(info.channelCount));
   for(auto& channel:slot.samples)slot.pointers.push_back(channel.data());
  }
  descriptors.resize(static_cast<size_t>(count));
  for(size_t i=0;i<descriptors.size();++i){
   auto& bus=descriptors[i];
   bus.numChannels=static_cast<int32>(storage[i].pointers.size());
   bus.channelBuffers32=storage[i].pointers.empty()?nullptr:storage[i].pointers.data();
   bus.silenceFlags=0;
  }
  return true;
 }
public:
 bool initialize(IComponent* component,std::string& error){
  inputs_.clear();outputs_.clear();inputBuses_.clear();outputBuses_.clear();
  if(!component){error="No VST3 component";return false;}
  if(!configure(component,kInput,inputs_,inputBuses_,error))return false;
  if(!configure(component,kOutput,outputs_,outputBuses_,error))return false;
  return true;
 }
 void clear(int frames){
  for(auto* group:{&inputs_,&outputs_})
   for(auto& bus:*group)
    for(auto& channel:bus.samples)
     std::fill_n(channel.data(),frames,0.f);
  for(auto* busses:{&inputBuses_,&outputBuses_})
   for(auto& bus:*busses)bus.silenceFlags=0;
 }
 int32 inputCount()const{return static_cast<int32>(inputBuses_.size());}
 int32 outputCount()const{return static_cast<int32>(outputBuses_.size());}
 AudioBusBuffers* inputBuses(){return inputBuses_.empty()?nullptr:inputBuses_.data();}
 AudioBusBuffers* outputBuses(){return outputBuses_.data();}
 float left(int i)const{return outputs_[0].samples[0][static_cast<size_t>(i)];}
 float right(int i)const{return outputs_[0].samples[outputs_[0].samples.size()>1?1:0][static_cast<size_t>(i)];}
};
} // namespace MelorixAudioBus
