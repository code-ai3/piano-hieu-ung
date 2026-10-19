<script setup lang="ts">
import { ref } from 'vue'
import type { MidiPart } from '@/util/midi-tracks'
import { midiNoteName } from '@/util/midi-edit'
import { kontaktChannel, kontaktChannelConflict } from '@/util/melorix-kontakt-routing'
import { midiBridge } from '@/util/melorix-midi-bridge'
const props=defineProps<{parts:MidiPart[];routes:Record<number,number>;labels:Record<number,string>;playing:boolean}>()
const emit=defineEmits<{(e:'close'):void;(e:'auto'):void;(e:'channel',id:number,value:number):void;(e:'label',id:number,value:string):void}>()
const testNote=ref(60)
function channel(part:MidiPart){return kontaktChannel(part,props.routes)}
function setChannel(part:MidiPart,e:Event){emit('channel',part.id,Number((e.target as HTMLSelectElement).value))}
function setLabel(part:MidiPart,e:Event){emit('label',part.id,(e.target as HTMLInputElement).value)}
function test(part:MidiPart){midiBridge.test(testNote.value,channel(part)-1)}
</script>
<template>
<Teleport to="body"><div class="mx-editor-overlay" @click.self="emit('close')">
<section role="dialog" aria-modal="true" aria-label="Nhiều track Kontakt" class="mx-editor-dialog mx-kontakt-router-dialog">
<header class="mx-editor-dialog-header"><div><span class="mx-editor-dialog-eyebrow">MELORIX · Kontakt 8</span><h2>Quản lý nhiều track nhạc cụ</h2></div><button type="button" class="mx-editor-dialog-close" @click="emit('close')">×</button></header>
<div class="mx-editor-dialog-body mx-kontakt-router-body">
<p>Mỗi track gửi MIDI sang một kênh riêng trong Kontakt 8 (Port A). Mở mỗi NKI thành một nhạc cụ riêng trong Kontakt và chọn đúng MIDI Ch. Drum Mix gồm nhiều WAV vẫn là một nhạc cụ trên một track.</p>
<div class="mx-kontakt-router-tools">
 <button type="button" :disabled="playing || !parts.length" @click="emit('auto')">Tự phân kênh cho các track</button>
 <label>Nốt thử <select v-model.number="testNote"><option v-for="n in 85" :key="n" :value="n+23">{{ midiNoteName(n+23) }} ({{ n+23 }})</option></select></label>
</div>
<div v-if="!parts.length">Chưa có track MIDI. Nhập MIDI hoặc tạo track bằng nút +.</div>
<div v-for="part in parts" :key="part.id" class="mx-kontakt-router-track">
<strong :style="{color:part.color}">{{ part.name }}</strong> <span>{{ part.noteCount }} nốt</span>
<label>Tên nhạc cụ Kontakt (ghi chú)<input type="text" maxlength="65" :value="labels[part.id]??''" placeholder="Erhu / Dizi / Drum Mix" :disabled="playing" @input="setLabel(part,$event)"></label>
<label>Kênh MIDI<select :value="channel(part)" :disabled="playing" @change="setChannel(part,$event)"><option v-for="n in 16" :key="n" :value="n">Port A · Ch {{ n }}</option></select></label>
<button type="button" :disabled="!midiBridge.connected || playing || !part.enabled" @click="test(part)">Thử nốt</button>
<p v-if="kontaktChannelConflict(parts,routes,part.id)" class="mx-kontakt-router-warning">Kênh {{ channel(part) }} trùng với track khác. Hãy đổi để không phát chồng nhạc cụ.</p>
</div>
<p>Tên chỉ để ghi nhớ, không tự mở NKI. Kontakt 8 cần mỗi nhạc cụ được nạp và gán kênh tương ứng. Giới hạn Port A: 16 kênh.</p>
<button type="button" @click="emit('close')">Xong</button>
</div></section></div></Teleport>
</template>
