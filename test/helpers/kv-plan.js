import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function kvPlan(sizes, repetitions, seed) {
  assert.ok(sizes.length && new Set(sizes).size === sizes.length && sizes.every(n => Number.isInteger(n) && n > 0 && n <= 1000));
  assert.ok(Number.isInteger(repetitions) && repetitions > 0 && repetitions <= 10);
  assert.ok(typeof seed === 'string' && seed.length > 0);
  const hash = text => createHash('sha256').update(seed + ':' + text).digest().readUInt32LE();
  const samples = sizes.flatMap(size => Array.from({ length: repetitions }, (_, repeat) => {
    const freshFirst = (hash('warm:' + size) + repeat) % 2 === 0;
    const changedFreshFirst = (hash('changed:' + size) + repeat) % 2 === 0;
    return { size, repeat, order: ['seed', ...(freshFirst ? ['fresh', 'warm'] : ['warm', 'fresh']),
      ...(changedFreshFirst ? ['changed_fresh', 'changed'] : ['changed', 'changed_fresh'])] };
  }));
  return samples.sort((a, b) => hash(`${a.size}:${a.repeat}`) - hash(`${b.size}:${b.repeat}`));
}

export function summarizeKv(samples) {
  const median = values => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  return [...new Set(samples.map(s => s.size))].sort((a, b) => a - b).flatMap(size =>
    ['warm', 'fresh', 'changed', 'changed_fresh'].map(label => {
      const cells = samples.filter(s => s.size === size && s[label]).map(s => s[label]);
      const fields = { elapsed_ms: c => c.elapsed_ms, first_text_ms: c => c.first_text_ms,
        native_input: c => c.usage?.input, native_cache_read: c => c.usage?.cache_read,
        prefill_ms: c => c.inference?.prefill?.elapsed_ms, decode_ms: c => c.inference?.decode?.elapsed_ms };
      return { size, label, count: cells.length, medians: Object.fromEntries(Object.entries(fields).map(([key, get]) => {
        const observed = cells.map(get).filter(Number.isFinite);
        return [key, { value: median(observed), observed: observed.length }];
      })) };
    }));
}
