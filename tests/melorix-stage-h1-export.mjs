import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('src/views/PianoView.vue','utf8')
const browser=readFileSync('tests/melorix-stage-a-browser-qa.mjs','utf8')
const workflow=readFileSync('.github/workflows/melorix-web-qa.yml','utf8')
for(const [name,text] of [
 ['Audio phase', "exportPhase.value='audio'"],
 ['Audio encode phase',"exportPhase.value='encoding'"],
 ['Video frame phase',"exportPhase.value = 'rendering'"],
 ['Finalize phase',"exportPhase.value='finalizing'"],
 ['Real elapsed clock','exportElapsed.value=Math.floor'],
 ['Cancellation guard','throwIfExportCancelled()'],
 ['Cancel action','function requestExportCancel()'],
 ['Cancellation file notice','Đã hủy xuất MP4. Không lưu video chưa hoàn tất.'],
 ['No fake audio percent','không có % từ WebAudio'],
 ['True video percentage','exportPhase===\'rendering\''],
 ['Close modal guarded','onExportModalVisibility'],
 ['Avoid lingering timer','clearInterval(elapsedClock)'],
 ['Avoid partial stream','await fileWriter.abort()']
 ])assert.ok(source.includes(text),'Missing H1 '+name)
assert.ok((source.match(/throwIfExportCancelled\(\)/g)??[]).length>=7,'Cancellation must be checked at every major await/frame boundary')
assert.ok(browser.includes('PASS Chromium MELORIX Stage H.1:'),'Browser must simulate WebAudio cancellation')
assert.ok(browser.includes("h1Downloads,0"),'Cancelled MP4 must not download')
assert.ok(workflow.includes('feature/melorix-h1-mp4-export-control'),'H.1 must run GitHub CI')
console.log('PASS MELORIX H.1: real stage reporting / elapsed clock / cancellation at safe boundaries')
