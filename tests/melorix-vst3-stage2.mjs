import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const host=readFileSync(new URL('../native/vst3-host/probe.cpp',import.meta.url),'utf8')
const cmake=readFileSync(new URL('../native/vst3-host/CMakeLists.txt',import.meta.url),'utf8')
const workflow=readFileSync(new URL('../.github/workflows/melorix-vst3-host-probe.yml',import.meta.url),'utf8')

for(const marker of [
 '"public.sdk/source/vst/hosting/module.h"',
 'VST3::Hosting::Module::create(source,error)',
 'factory.classInfos()',
 'info.category()==kVstAudioEffectClass',
 'factory.createInstance<Steinberg::Vst::IComponent>(info.ID())',
 'component->initialize(context)',
 'Steinberg::Vst::IAudioProcessor::iid',
 'component->terminate()',
 'const auto factory=module->getFactory();',
 '"--initialize"',
 '"--inspect"',
 'CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED)',
 'std::filesystem::exists(path,ec)',
 '"audioRendered\\":false',
])assert.ok(host.includes(marker),'Native VST3 loader contract missing: '+marker)
assert.ok(!host.includes('IAudioProcessor::process('),'Processing is not implemented yet')
assert.ok(!host.includes('module.reset()'),'Must not unload DLL while factory wrapper still lives')
const renderer=readFileSync(new URL('../native/vst3-host/offline-render.cpp',import.meta.url),'utf8')
const synth=readFileSync(new URL('../native/vst3-host/test-synth.cpp',import.meta.url),'utf8')
for(const marker of [
 'VST3::Hosting::Module::create(plugin,error)',
 'EventList events(8)',
 'events.addEvent(on)',
 'events.addEvent(off)',
 'data.inputEvents=&events',
 'processor->process(data)',
 'writePcmWav(outputPath,pcm)',
 'pcm.reserve(',
 'nonzero<1000',
 'peak<0.02',
 'tail>0.0001',
 'component->setActive(false)',
 'processor->setProcessing(false)',
])assert.ok(renderer.includes(marker),'Missing native MIDI-to-VST3-to-PCM implementation: '+marker)
assert.ok(!renderer.includes('std::sin('),'Host must not synthesize fallback sound: only real VST3 process() output')
assert.ok(synth.includes('process(ProcessData& data)'),'QA synth must implement actual VST3 DSP')
assert.ok(synth.includes('Event::kNoteOnEvent')&&synth.includes('Event::kNoteOffEvent'),'QA synth must respond to MIDI events')
assert.ok(workflow.includes('Prove MIDI Note On-Off was rendered by real VST3 into WAV PCM'))

assert.ok(!host.includes('IPlugView::attached('),'Kontakt UI hosting is not implemented yet')
assert.ok(cmake.includes('target_link_libraries(melorix-vst3-probe PRIVATE sdk_hosting ole32)'))
assert.ok(cmake.includes('SMTG_ENABLE_VST3_PLUGIN_EXAMPLES OFF'))
assert.ok(workflow.includes('3cdf9ca5d1f5b1b21e0a86832aa4abe55607bd96'))
assert.ok(workflow.includes('cmake --build native/vst3-host-build --target melorix-vst3-probe'))
assert.ok(workflow.includes('MELORIX-VST3-loader-probe-x64-NOT-RELEASE'))
assert.ok(!workflow.includes('Kontakt 8.vst3/Contents'),'Do not confuse fake fixtures with Kontakt test')
console.log('PASS: Stage2A SDK lifetime and Stage2B actual plugin MIDI-to-PCM processor contract; Kontakt UI still pending')
