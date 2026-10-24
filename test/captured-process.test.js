import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { testRoot } from './helpers/codex.js';
import { runCaptured } from './helpers/captured-process.js';

test('captured client exits normally and preserves diagnostics', async () => {
  const result = await runCaptured(process.execPath, ['-e', "console.log('out');console.error('err');process.exitCode=3"]);
  assert.equal(result.code, 3);
  assert.equal(result.signal, null);
  assert.equal(result.timed_out, false);
  assert.equal(result.stdout.trim(), 'out');
  assert.equal(result.stderr.trim(), 'err');
});

test('client timeout reports termination even before the executable produces output', { timeout: 10000 }, async () => {
  const result = await runCaptured(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 200 });
  assert.equal(result.timed_out, true);
  assert.ok(result.signal || result.code === 143, JSON.stringify(result));
  assert.ok(result.elapsed_ms < 5000);
});

test('cancelling a started client terminates descendants that keep its output pipe alive',
  { timeout: 20000, skip: process.platform === 'win32' }, async t => {
    const ready = join(await testRoot('client-cleanup'), 'ready');
    const control = new AbortController();
    const script = `const {spawn}=require('node:child_process');
      const child=spawn(process.execPath,['-e', 'setInterval(()=>{},1000)'],{stdio:['ignore',1,2]});
      require('node:fs').writeFileSync(${JSON.stringify(ready)},String(child.pid));setInterval(()=>{},1000);`;
    const pending = runCaptured(process.execPath, ['-e', script], { timeoutMs: 15000, signal: control.signal });
    t.after(async () => { control.abort();await pending; });
    // Synchronize with fixture readiness, not an assumption that Node starts
    // within 500 ms while a real engine is consuming the host CPU.
    let descendant;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      try { descendant = Number(await readFile(ready, 'utf8'));break; }
      catch (error) { if (error.code !== 'ENOENT') throw error;await sleep(25); }
    }
    assert.ok(Number.isInteger(descendant) && descendant > 0);
    control.abort();
    const result = await pending;
    assert.equal(result.aborted, true);
    assert.equal(result.timed_out, false);
    // Node may handle SIGTERM and report the conventional exit status 143.
    assert.ok(result.signal || result.code === 143, JSON.stringify(result));
    // kill(0) alone cannot distinguish a live process from a Linux zombie.
    for (let attempt = 0; ; attempt++) {
      try {
        if (process.platform === 'linux') {
          if (/^\d+ \(.*\) Z /.test(await readFile(`/proc/${descendant}/stat`, 'utf8'))) break;
        } else process.kill(descendant, 0);
      } catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) break;throw error; }
      assert.ok(attempt < 40, 'Owned descendant must stop after cancellation');
      await sleep(25);
    }
  });
