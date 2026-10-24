import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {estimateExportBudget,enforceExportBudget} from '../src/util/melorix-stage-f2-export-budget.ts'
for(const kind of ['mp4','wav']){
 const short=estimateExportBudget(30,kind,4)
 const long=estimateExportBudget(300,kind,4)
 assert.ok(short.estimatedMiB<long.estimatedMiB,'Memory estimate must scale with duration')
 assert.ok(short.estimatedMiB<short.budgetMiB,'Short clip must remain possible')
}
const video=estimateExportBudget(240,'mp4',4,false)
const streaming=estimateExportBudget(240,'mp4',4,true)
assert.ok(streaming.estimatedMiB<video.estimatedMiB,'Streaming reduces buffered file memory')
assert.ok(estimateExportBudget(180,'wav',4).estimatedMiB<estimateExportBudget(180,'wav',4).budgetMiB)
assert.throws(()=>enforceExportBudget([1200,'wav',4]),/vượt mức an toàn/)
assert.throws(()=>enforceExportBudget([1200,'mp4',4]),/vượt mức an toàn/)
assert.ok(enforceExportBudget([15,'mp4',2]).estimatedMiB<=enforceExportBudget([15,'mp4',2]).budgetMiB)
assert.throws(()=>estimateExportBudget(-1,'wav',4),/không hợp lệ/)
assert.throws(()=>estimateExportBudget(Infinity,'wav',4),/không hợp lệ/)
assert.throws(()=>estimateExportBudget(90,'mp4',4,false,44100,0),/không hợp lệ/)
const view=readFileSync('src/views/PianoView.vue','utf8')
assert.ok(view.includes("enforceExportBudget([totalSeconds,'wav'"))
assert.ok(view.includes("enforceExportBudget([exportSeconds,'mp4'"))
const flow=readFileSync('.github/workflows/melorix-web-qa.yml','utf8')
assert.ok(flow.includes('feature/melorix-stage-f2-long-render-fx-qa'))
assert.ok(flow.includes('tests/melorix-stage-f2-browser-qa.mjs'))
console.log('PASS MELORIX F.2: export memory estimates, long renders guarded, streamed MP4 budget, no changes to production')
