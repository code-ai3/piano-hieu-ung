import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const view=readFileSync(new URL('../src/views/PianoView.vue',import.meta.url),'utf8')
const connector=readFileSync(new URL('../src/components/MelorixMidiConnector.vue',import.meta.url),'utf8')
// Regression: do not offer a fake Kontakt importer requiring the user to provide WAV files.
for(const legacy of ['openKontaktImporter','onKontaktWavsChoose','importKontaktCompatibility','kontaktWavFiles','NKI + WAV (chế độ tương thích cũ)','Nhập thư viện Kontakt']){
 assert.equal(view.includes(legacy),false,'Misleading legacy Kontakt import reappeared: '+legacy)
}
assert.ok(view.includes('openMidiConnector'),'Real Kontakt connector must remain accessible')
assert.ok(view.includes('openKontaktRouter'),'Multi-instrument MIDI routing must remain accessible')
assert.ok(view.includes('openKontaktAudioCapture'),'Kontakt MP4 audio capture must remain accessible')
assert.ok(view.includes('openPersonalInstrumentImport'),'Independent WAV sampler should remain available')
assert.match(connector,/Không phải chọn thêm WAV trong MELORIX/)
assert.match(connector,/\.nki/)
assert.match(connector,/MELORIX-KONTAKT/)
console.log('PASS: Kontakt .nki uses the real MIDI connector; no mandatory manual WAV importer')
