import assert from 'node:assert/strict'
import {kontaktChannel,kontaktChannelConflict,nextKontaktChannel} from '../src/util/melorix-kontakt-routing.ts'
const tracks=[{id:1,channel:1},{id:2,channel:2},{id:3,channel:10}]
assert.equal(kontaktChannel(tracks[0],{1:5}),5)
assert.equal(kontaktChannel(tracks[2],{}),10)
assert.equal(kontaktChannelConflict(tracks,{1:2},1),true)
assert.equal(nextKontaktChannel(tracks,{}),3)
console.log('PASS Kontakt track routing')
