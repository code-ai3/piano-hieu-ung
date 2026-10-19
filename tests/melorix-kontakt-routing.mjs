import assert from 'node:assert/strict'
import {kontaktChannel,kontaktChannelConflict,nextKontaktChannel,autoKontaktChannels} from '../src/util/melorix-kontakt-routing.ts'
const tracks=[{id:1,channel:1},{id:2,channel:2},{id:3,channel:10}]
assert.equal(kontaktChannel(tracks[0],{1:5}),5)
assert.equal(kontaktChannel(tracks[2],{}),10)
assert.equal(kontaktChannelConflict(tracks,{1:2},1),true)
assert.equal(nextKontaktChannel(tracks,{}),3)
const assigned=autoKontaktChannels([{id:11,channel:1,name:'Erhu'},{id:12,channel:1,name:'Dizi'},{id:13,channel:1,name:'Drum Mix'}])
assert.deepEqual(assigned,{11:1,12:2,13:10})
assert.equal(kontaktChannelConflict(tracks,{2:10},3),true)
console.log('PASS Kontakt track routing')
