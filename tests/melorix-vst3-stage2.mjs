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
 'module.reset()',
 '"--initialize"',
 '"--inspect"',
 'CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED)',
 'std::filesystem::exists(path,ec)',
 '"audioRendered\\":false',
])assert.ok(host.includes(marker),'Native VST3 loader contract missing: '+marker)
assert.ok(!host.includes('IAudioProcessor::process('),'Processing is not implemented yet')
assert.ok(!host.includes('IPlugView::attached('),'Kontakt UI hosting is not implemented yet')
assert.ok(cmake.includes('target_link_libraries(melorix-vst3-probe PRIVATE sdk_hosting ole32)'))
assert.ok(cmake.includes('SMTG_ENABLE_VST3_PLUGIN_EXAMPLES OFF'))
assert.ok(workflow.includes('3cdf9ca5d1f5b1b21e0a86832aa4abe55607bd96'))
assert.ok(workflow.includes('cmake --build native/vst3-host-build --target melorix-vst3-probe'))
assert.ok(workflow.includes('MELORIX-VST3-loader-probe-x64-NOT-RELEASE'))
assert.ok(!workflow.includes('Kontakt 8.vst3/Contents'),'Do not confuse fake fixtures with Kontakt test')
console.log('PASS: Stage2A real SDK loader paths, explicit init, subprocess isolation and honest unsupported audio/editor')
