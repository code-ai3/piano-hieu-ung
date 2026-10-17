import assert from 'node:assert/strict'
import { velocityVisualStrength as strength, velocityParticleCount as count } from '../src/util/velocity-effects.ts'

for (const mode of ['off', 'natural', 'expressive']) {
  for (const value of [-3, 0, 0.2, 0.5, 0.9, 1, 3, NaN]) {
    const n = strength(value, mode, 85)
    assert.ok(n >= 0 && n <= 1)
  }
}
assert.equal(strength(0.1,'off',100),1)
assert.equal(strength(0.8,'natural',0),1)
assert.ok(strength(0.1,'natural',100) < strength(0.9,'natural',100))
assert.ok(strength(0.1,'expressive',100) < strength(0.1,'natural',100))
assert.ok(strength(0.9,'expressive',100) > strength(0.1,'expressive',100))
assert.ok(strength(0.5,'natural',20) > strength(0.5,'natural',90))
assert.equal(strength(0,'natural',100),0.22)
assert.equal(strength(1,'expressive',100),1)
assert.equal(count(16,1),16)
assert.ok(count(16,0.15) < count(16,0.85))
assert.equal(count(0,0.5),0)
console.log('PASS: velocity modes, contrast, sensitivity, particle bounds, unchanged audio path')
