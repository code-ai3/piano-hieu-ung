import assert from 'node:assert/strict'
import {erhuRoot,nearestErhuSample,validateErhuSamples} from '../src/util/melorix-erhu-sample-cache.ts'
const mapped={G:67,A:69,B:71,C:72,D:74,E:76,F:77}
for(const [letter,pitch] of Object.entries(mapped))assert.equal(erhuRoot(letter+'.wav'),pitch)
assert.equal(erhuRoot('x.wav'),null)
assert.equal(nearestErhuSample(73,Object.values(mapped)),72)
assert.equal(nearestErhuSample(68,Object.values(mapped)),67)
assert.equal(nearestErhuSample(60,[]),null)
const files=['A','B','C','D','E','F','G'].map(letter=>({name:letter+'.wav',size:1024}))
assert.equal(validateErhuSamples(files),null)
assert.match(validateErhuSamples(files.slice(0,6)),/đủ 7/)
assert.match(validateErhuSamples([...files.slice(0,6),files[0]]),/trùng/)
console.log('PASS: Erhu WAV root mapping and sample validation')
