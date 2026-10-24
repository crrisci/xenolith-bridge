import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { kvPlan, summarizeKv } from '../helpers/kv-plan.js';
import { idleSnapshot } from '../helpers/idle-host.js';
import { startAdapter } from '../../src/server.js';
import { startRealEngine } from './engine.js';

// Sequential diagnostic comparisons, not a general performance benchmark.
const sizes = (process.env.XENOLITH_BRIDGE_KV_SIZES ?? '32,128,512').split(',').map(Number);
const repetitions = Number(process.env.XENOLITH_BRIDGE_KV_REPETITIONS ?? 2);
assert.ok(sizes.length && sizes.every(n => Number.isInteger(n) && n > 0 && n <= 1000));
assert.ok(Number.isInteger(repetitions) && repetitions > 0 && repetitions <= 10);
const seed = process.env.XENOLITH_BRIDGE_KV_SEED ?? randomBytes(8).toString('hex');
const plan = kvPlan(sizes, repetitions, seed);
let engine, adapter;
const results = { mode: 'real_kv_diagnostic', status: 'running', sizes, repetitions, samples: [], seed, plan, scheduling: 'seeded sample shuffle; counterbalanced warm/fresh and changed/fresh pairs', host_checks: [], fresh_session_is_not_guaranteed_cold: true, started_at: new Date().toISOString() };
const events = [], sessions = [];
async function turn(label, key, messages, expected) {
  results.host_checks.push(await idleSnapshot());
  const start = performance.now(), offset = events.length, sessionOffset = sessions.length;
  const request = { model: engine.info.model, messages, temperature: 0, max_tokens: 32, stream: true };
  const response = await fetch(adapter.baseUrl + '/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-Xenolith-Session': key },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(300000),
  });
  assert.equal(response.status, 200, await (response.ok ? Promise.resolve('') : response.text()));
  let buffer = '', content = '', firstTextMs = null;
  const decoder = new TextDecoder();
  for await (const bytes of response.body) {
    buffer += decoder.decode(bytes, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, end);buffer = buffer.slice(end + 2);
      for (const line of frame.split('\n')) if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        const event = JSON.parse(line.slice(6));
        assert.ok(!event.error, JSON.stringify(event));
        const text = event.choices?.[0]?.delta?.content;
        if (text) { firstTextMs ??= performance.now() - start;content += text; }
      }
    }
  }
  const terminal = events.slice(offset).findLast(e => e.event === 'done');
  const commit = sessions.slice(sessionOffset).findLast(e => e.kind === 'persistent_commit');
  const result = { label, wire_done_ms: terminal ? terminal.observed_ms - start : null,
    commit_ms: commit ? commit.observed_ms - start : null,
    post_wire_done_commit_ms: terminal && commit ? commit.observed_ms - terminal.observed_ms : null,
    native_checkpoint_ms: terminal?.checkpoint?.elapsed_ms ?? null, elapsed_ms: performance.now() - start, first_text_ms: firstTextMs,
    request, content, usage: terminal?.usage, inference: terminal?.inference ?? null, resume: terminal?.resume ?? null, checkpoint: terminal?.checkpoint ?? null, session_events: sessions.slice(sessionOffset) };
  results.host_checks.push(await idleSnapshot());
  assert.equal(content.trim(), expected, JSON.stringify(result));
  assert.ok(terminal?.usage, 'Native usage must be observed');
  console.log(`${label} input=${result.usage.input} cache=${result.usage.cache_read} ms=${result.elapsed_ms.toFixed(0)}`);
  return result;
}
try {
  results.host_checks.push(await idleSnapshot());
  engine = await startRealEngine('kv-matrix');console.log('KV_ROOT ' + engine.root);
  adapter = await startAdapter({ socketPath: engine.socket, stateDir: join(engine.root, 'bindings'),
    onWireEvent: e => events.push({ ...structuredClone(e), observed_ms: performance.now() }),
    onSessionEvent: e => sessions.push({ ...structuredClone(e), observed_ms: performance.now() }) });
  results.describe = engine.info;
  await writeFile(join(engine.root, 'result.json'), JSON.stringify(results, null, 2));
  for (const { size, repeat, order } of plan) {
    results.host_checks.push(await idleSnapshot());
    const key = randomBytes(8).toString('hex'), nonce = createHash('sha256').update(`${seed}:${size}:${repeat}`).digest('hex').slice(0, 8);
    const ledger = Array.from({ length: size }, (_, i) => `Record ${i}: item=${i * 17 + 103}; status=verified.`).join('\n');
    const seedMessages = [{ role: 'system', content: 'Follow the user request. Return only the requested key or READY, without explanation.' },
      { role: 'user', content: `${ledger}\nVerification key: ${nonce}. Remember it and reply READY.` }];
    const sample = { size, repeat, order };results.samples.push(sample);
    sample.seed = await turn('seed', key, seedMessages, 'READY');
    const continued = [...seedMessages, { role: 'assistant', content: sample.seed.content }, { role: 'user', content: 'Return the verification key.' }];
    const changed = structuredClone(continued);changed[1].content = changed[1].content.replace('status=verified', 'status=updated');
    for (const label of order.slice(1)) {
      const altered = label.startsWith('changed');
      const sessionKey = label === 'warm' || label === 'changed' ? key : `${key}-${label}`;
      sample[label] = await turn(label, sessionKey, altered ? changed : continued, nonce);
    }
    results.host_checks.push(await idleSnapshot());
    assert.ok(sample.warm.session_events.some(e => e.kind === 'persistent_hit'), 'Unchanged history must append incrementally');
    assert.ok(sample.warm.usage.cache_read > 0, 'Warm continuation must report KV reuse');
    assert.ok(sample.changed.session_events.some(e => e.kind === 'persistent_rebuild'), 'Changed prefix must rebuild');
    await writeFile(join(engine.root, 'result.json'), JSON.stringify(results, null, 2));
  }
  results.summary = summarizeKv(results.samples);
  results.status = 'passed';
} catch (error) {
  results.status = 'failed';results.error = { message: error.message, stack: error.stack };process.exitCode = 1;
  console.error(error);
} finally {
  try { await adapter?.close(); } finally { await engine?.close(); }
  results.finished_at = new Date().toISOString();
  if (engine) await writeFile(join(engine.root, 'result.json'), JSON.stringify(results, null, 2));
}
