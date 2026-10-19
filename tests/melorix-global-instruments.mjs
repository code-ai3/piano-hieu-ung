import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parsePublishedLibrary,publishedInstrumentUrl,validatePublishedInstrument} from '../src/util/melorix-published-library.ts'
const wav={id:'erhu-hmoob',label:'Erhu Hmoob',format:'wav',file:'erhu.wav',rootMidi:60,license:'Original - public redistribution granted',redistributionApproved:true}
const nki={id:'s90-es',label:'S90 ES Kontakt',format:'nki',file:'S90_ES.nki',license:'Authorized for public redistribution',redistributionApproved:true}
assert.equal(validatePublishedInstrument(wav)?.id,'erhu-hmoob')
assert.equal(validatePublishedInstrument(nki)?.format,'nki')
assert.equal(validatePublishedInstrument({...wav,redistributionApproved:false}),null)
assert.equal(validatePublishedInstrument({...nki,license:''}),null)
assert.equal(validatePublishedInstrument({...wav,file:'../../password.wav'}),null)
assert.equal(validatePublishedInstrument({...nki,file:'preset.wav'}),null)
assert.equal(validatePublishedInstrument({...wav,rootMidi:999}),null)
assert.equal(validatePublishedInstrument({...wav,id:'../api'}),null)
assert.deepEqual(parsePublishedLibrary({schemaVersion:2,instruments:[wav]}),[])
assert.deepEqual(parsePublishedLibrary({schemaVersion:1,instruments:[wav,wav,nki,{...nki,id:'bad',redistributionApproved:false}]}).map(x=>x.id),['erhu-hmoob','s90-es'])
assert.equal(publishedInstrumentUrl(wav),'/instruments/erhu-hmoob/erhu.wav')
assert.equal(publishedInstrumentUrl(nki),'/instruments/s90-es/S90_ES.nki')
const shipped=JSON.parse(readFileSync(new URL('../public/instruments/catalog.json',import.meta.url),'utf8'))
assert.equal(shipped.schemaVersion,1)
assert.deepEqual(parsePublishedLibrary(shipped),[])
console.log('PASS published instrument registry: no unauthorized bundles, valid WAV/NKI, path traversal rejected, stable manifest')
