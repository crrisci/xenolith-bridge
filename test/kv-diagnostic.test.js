import test from 'node:test';
import assert from 'node:assert/strict';
import { kvPlan, summarizeKv } from './helpers/kv-plan.js';

test('KV diagnostic covers every size/repetition and counterbalances comparisons with valid dependencies', () => {
  const plan = kvPlan([32, 128, 512], 4, 'repeatable');
  assert.deepEqual(plan, kvPlan([32, 128, 512], 4, 'repeatable'));
  assert.notDeepEqual(plan, kvPlan([32, 128, 512], 4, 'another-seed'));
  for (const size of [32, 128, 512]) {
    const samples = plan.filter(s => s.size === size);
    assert.deepEqual(samples.map(s => s.repeat).sort(), [0, 1, 2, 3]);
    for (const sample of samples) {
      assert.equal(sample.order[0], 'seed');
      assert.equal(new Set(sample.order).size, 5);
      assert.ok(sample.order.indexOf('warm') < sample.order.indexOf('changed'));
    }
    assert.equal(samples.filter(s => s.order.indexOf('warm') < s.order.indexOf('fresh')).length, 2);
    assert.equal(samples.filter(s => s.order.indexOf('changed') < s.order.indexOf('changed_fresh')).length, 2);
  }
  for (const args of [[[32, 32], 2, 's'], [[0], 2, 's'], [[32], 0, 's'], [[32], 2, '']]) assert.throws(() => kvPlan(...args));
});

test('KV summaries retain zero measurements and distinguish unavailable native timings', () => {
  const summary = summarizeKv([{ size: 32, warm: { elapsed_ms: 10, first_text_ms: 0, usage: { input: 3, cache_read: 0 } } },
    { size: 32, warm: { elapsed_ms: 20, first_text_ms: 2, usage: { input: 5, cache_read: 8 }, inference: { prefill: { elapsed_ms: 0 } } } }]);
  assert.deepEqual(summary[0].medians.elapsed_ms, { value: 15, observed: 2 });
  assert.deepEqual(summary[0].medians.native_cache_read, { value: 4, observed: 2 });
  assert.deepEqual(summary[0].medians.prefill_ms, { value: 0, observed: 1 });
  assert.deepEqual(summary[0].medians.decode_ms, { value: null, observed: 0 });
  assert.equal(summary[1].count, 0);
});
