import assert from 'node:assert/strict'
import {inspectKontaktNki,inferKontaktWavRoot,kontaktImportCheck,closestKontaktSample} from '../src/util/melorix-kontakt-import.ts'
const enc=(text)=>new TextEncoder().encode(text).buffer
const recognized=inspectKontaktNki(enc('4KIN'+'.'.repeat(105)+'DSIN'),'Erhu Hmoob Nplog.nki')
assert.equal(recognized.supportedContainer,true)
assert.equal(recognized.name,'Erhu Hmoob Nplog')
assert.equal(inspectKontaktNki(enc('FAKE'.repeat(60)),'bad.nki').supportedContainer,false)
assert.equal(inspectKontaktNki(enc('4KIN'+'.'.repeat(105)+'DSIN'),'bad.txt').supportedContainer,false)
for(const [name,root] of Object.entries({'G.wav':67,'A.wav':69,'B.wav':71,'C.wav':72,'D.wav':74,'E.wav':76,'F.wav':77})){
 assert.equal(inferKontaktWavRoot('Erhu Hmoob Nplog.nki',name),root)
}
assert.equal(inferKontaktWavRoot('Dizi Tau.nki','A.wav'),null)
assert.equal(inferKontaktWavRoot('Dizi Tau.nki','C4.wav'),60)
assert.equal(inferKontaktWavRoot('Dizi Tau.nki','Violin_C#4_vel90.wav'),61)
assert.equal(inferKontaktWavRoot('Dizi Tau.nki','G3-vel90.wav'),55)
assert.equal(inferKontaktWavRoot('Dizi Tau.nki','Bb3.wav'),58)
assert.equal(inferKontaktWavRoot('Dizi Tau.nki','junk.wav'),null)
assert.equal(inferKontaktWavRoot('Dizi Tau.nki','C9.wav'),null)
assert.deepEqual(kontaktImportCheck([67,null,71],3),{ok:false,unmapped:1})
assert.equal(kontaktImportCheck([67,69,71],3).ok,true)
assert.equal(kontaktImportCheck([],0).ok,false)
const group=[{rootMidi:67,id:'G'},{rootMidi:69,id:'A'},{rootMidi:72,id:'C'}]
assert.equal(closestKontaktSample(group,60)?.id,'C')
assert.equal(closestKontaktSample(group,67)?.id,'G')
assert.equal(closestKontaktSample(group,68)?.id,'G')
assert.equal(closestKontaktSample([],60),null)
console.log('PASS Kontakt NKI container inspection + Erhu roots + manual-map safety')
