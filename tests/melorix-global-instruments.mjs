import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {parsePublishedLibrary,publishedInstrumentUrl,validatePublishedInstrument} from '../src/util/melorix-published-library.ts'
const wav={id:'erhu-hmoob',label:'Erhu Hmoob',format:'wav',file:'erhu.wav',rootMidi:60,license:'Owner licensed',redistributionApproved:true}
const nki={id:'s90-es',label:'S90 ES Kontakt',format:'nki',file:'S90_ES.nki',license:'Owner licensed',redistributionApproved:true}
assert.equal(validatePublishedInstrument(wav)?.id,'erhu-hmoob')
assert.equal(validatePublishedInstrument(nki)?.format,'nki')
assert.equal(validatePublishedInstrument({...wav,redistributionApproved:false}),null)
assert.equal(validatePublishedInstrument({...nki,license:''}),null)
assert.equal(validatePublishedInstrument({...wav,file:'../../password.wav'}),null)
assert.equal(validatePublishedInstrument({...nki,file:'preset.wav'}),null)
assert.equal(validatePublishedInstrument({...wav,rootMidi:999}),null)
assert.equal(validatePublishedInstrument({...wav,id:'../api'}),null)
assert.equal(validatePublishedInstrument({...nki,delivery:'drive',sourceUrl:'javascript:alert(1)'}),null)
assert.equal(validatePublishedInstrument({...nki,samplesUrl:'https://evil.example/drive/folders/x'}),null)
assert.equal(validatePublishedInstrument({...nki,delivery:'drive',sourceUrl:'https://drive.google.com/file/d/abcDEF123/view'})?.delivery,'drive')
assert.equal(validatePublishedInstrument({...nki,file:'S90 ES for Kontakt edition1.nki'})?.format,'nki')
assert.deepEqual(parsePublishedLibrary({schemaVersion:2,instruments:[wav]}),[])
assert.deepEqual(parsePublishedLibrary({schemaVersion:1,instruments:[wav,wav,nki,{...nki,id:'bad',redistributionApproved:false}]}).map(x=>x.id),['erhu-hmoob','s90-es'])
assert.equal(publishedInstrumentUrl(wav),'/instruments/erhu-hmoob/erhu.wav')
assert.equal(publishedInstrumentUrl(nki),'/instruments/s90-es/S90_ES.nki')
const shipped=JSON.parse(readFileSync(new URL('../public/instruments/catalog.json',import.meta.url),'utf8'))
assert.equal(shipped.schemaVersion,1)
const published=parsePublishedLibrary(shipped)
assert.equal(published.length,33,'All 32 NKI and 1 NKM must appear')
assert.equal(published.filter(x=>x.format==='nki').length,32)
assert.equal(published.filter(x=>x.format==='nkm').length,1)
assert.equal(published.filter(x=>x.delivery!=='drive').length,18)
assert.equal(published.filter(x=>x.delivery==='drive').length,15)
for(const item of published.filter(x=>x.delivery!=='drive')){
 const path=new URL('../public/instruments/'+item.id+'/'+item.file,import.meta.url)
 assert.ok(existsSync(path),'Bundled NKI must exist: '+item.label)
 assert.ok(readFileSync(path).length>2500,'NKI asset must contain file bytes: '+item.label)
 assert.equal(publishedInstrumentUrl(item),'/instruments/'+item.id+'/'+encodeURIComponent(item.file))
}
for(const item of published.filter(x=>x.delivery==='drive')){
 assert.ok(item.sourceUrl?.startsWith('https://drive.google.com/file/d/'))
}
assert.equal(published.filter(x=>x.samplesUrl).length,31)
console.log('PASS: MELORIX catalog has 33 entries, 18 real NKI files, 15 Drive links and safe sample URLs')
