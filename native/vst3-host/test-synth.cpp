// MELORIX VST3 QA instrument only — NOT Kontakt and NOT distributed in MELORIX.
// This is a real Steinberg-SDK VST3 binary. Audio must be generated in process(),
// not faked by the MELORIX host. It provides a deterministic MIDI->PCM CI fixture.
// SPDX-License-Identifier: MIT
#include "public.sdk/source/vst/vstaudioeffect.h"
#include "public.sdk/source/vst/vsteditcontroller.h"
#include "public.sdk/source/common/pluginview.h"
#include <windows.h>
#include <cstring>
#include "public.sdk/source/main/pluginfactory_constexpr.h"
#include "pluginterfaces/vst/ivstevents.h"
#include "pluginterfaces/vst/vsttypes.h"
#include <cmath>

namespace Melorix {
using namespace Steinberg;
using namespace Steinberg::Vst;
static DECLARE_UID(TestSynthCID, 0xEB12215D, 0x71364E96, 0x92C350DA, 0x3B119CC7);
static DECLARE_UID(TestControllerCID, 0x7B3E4CD7, 0x49DC4851, 0xA1220B11, 0xE37F0131);

// Test-only native view: verify the HOST attaches real VST3 IPlugView to
// HWND. We do not copy Kontakt GUI or inject a fake screenshot into MELORIX.
class TestEditorView final : public Steinberg::CPluginView {
public:
 TestEditorView(){setRect(Steinberg::ViewRect(0,0,440,180));}
 tresult PLUGIN_API isPlatformTypeSupported(FIDString type) override {
  return std::strcmp(type,Steinberg::kPlatformTypeHWND)==0?kResultTrue:kResultFalse;
 }
 tresult PLUGIN_API attached(void* parent,FIDString type) override {
  if(isPlatformTypeSupported(type)!=kResultTrue)return kResultFalse;
  if(Steinberg::CPluginView::attached(parent,type)!=kResultOk)return kResultFalse;
  label_=CreateWindowExW(0,L"STATIC",L"MELORIX VST3 GUI QA | Native HWND",
    WS_CHILD|WS_VISIBLE|SS_CENTER,10,40,410,70,
    static_cast<HWND>(parent),nullptr,GetModuleHandleW(nullptr),nullptr);
  if(!label_){Steinberg::CPluginView::removed();return kResultFalse;}
  return kResultOk;
 }
 tresult PLUGIN_API removed() override {
  if(label_){DestroyWindow(label_);label_=nullptr;}
  return Steinberg::CPluginView::removed();
 }
private:
 HWND label_{nullptr};
};

class TestController final : public EditController {
public:
 static FUnknown* createInstance(void*) {
  return static_cast<IEditController*>(new TestController());
 }
 IPlugView* PLUGIN_API createView(FIDString name) override {
  return FIDStringsEqual(name,ViewType::kEditor)?new TestEditorView():nullptr;
 }
};


class TestSynth final : public AudioEffect {
public:
 static FUnknown* createInstance(void*) {
  return static_cast<IAudioProcessor*>(new TestSynth());
 }
 TestSynth(){
  setControllerClass(FUID::fromTUID(TestControllerCID));
 }
 tresult PLUGIN_API initialize(FUnknown* context) override {
  const auto result=AudioEffect::initialize(context);
  if(result==kResultOk){
   addAudioOutput(STR16("Stereo Out"), SpeakerArr::kStereo);
   addEventInput(STR16("MIDI Event Input"),1);
  }
  return result;
 }
 tresult PLUGIN_API canProcessSampleSize(int32 size) override {
  return size==kSample32?kResultOk:kResultFalse;
 }
 tresult PLUGIN_API setActive(TBool state) override {
  if(!state){active=false;velocity=0.;}
  phase=0.;
  return AudioEffect::setActive(state);
 }
 tresult PLUGIN_API setProcessing(TBool /*state*/) override { return kResultOk; }
 tresult PLUGIN_API process(ProcessData& data) override {
  if(data.numOutputs<1||!data.outputs||data.outputs[0].numChannels<2||
     data.symbolicSampleSize!=kSample32)return kResultFalse;
  const auto& bus=data.outputs[0];
  if(!bus.channelBuffers32||!bus.channelBuffers32[0]||!bus.channelBuffers32[1])return kResultFalse;
  int32 index=0;
  const auto eventCount=data.inputEvents?data.inputEvents->getEventCount():0;
  for(int32 sample=0;sample<data.numSamples;++sample){
   while(index<eventCount){
    Event ev{};
    if(data.inputEvents->getEvent(index,ev)!=kResultOk){++index;continue;}
    if(ev.sampleOffset>sample)break;
    if(ev.type==Event::kNoteOnEvent){
     if(ev.noteOn.velocity>0.f){
      active=true;note=ev.noteOn.pitch;velocity=ev.noteOn.velocity;
      phase=0.;
     }else if(note==ev.noteOn.pitch)active=false;
    }else if(ev.type==Event::kNoteOffEvent&&ev.noteOff.pitch==note){
     active=false;
    }
    ++index;
   }
   float signal=0.f;
   if(active){
    const double frequency=440.0*std::pow(2.0,(static_cast<double>(note)-69.0)/12.0);
    signal=static_cast<float>(std::sin(phase)*0.18*velocity);
    phase+=6.2831853071795864769*frequency/processSetup.sampleRate;
    if(phase>6.2831853071795864769)phase-=6.2831853071795864769;
   }
   bus.channelBuffers32[0][sample]=signal;
   bus.channelBuffers32[1][sample]=signal;
  }
  data.outputs[0].silenceFlags=active?0:0;
  return kResultOk;
 }
private:
 bool active{false};
 int note{-1};
 double phase{0.};
 double velocity{0.};
};
} // namespace Melorix

BEGIN_FACTORY_DEF("MELORIX QA","https://example.invalid","qa@example.invalid",1)
 DEF_CLASS(Melorix::TestSynthCID,Steinberg::PClassInfo::kManyInstances,
   kVstAudioEffectClass,"MELORIX Test MIDI Synth",0,"Instrument|Synth",
   "0.1.0",kVstVersionString,Melorix::TestSynth::createInstance,nullptr)
 DEF_CLASS(Melorix::TestControllerCID,Steinberg::PClassInfo::kManyInstances,
   kVstComponentControllerClass,"MELORIX Test Native GUI Controller",0,"",
   "0.1.0",kVstVersionString,Melorix::TestController::createInstance,nullptr)
END_FACTORY
