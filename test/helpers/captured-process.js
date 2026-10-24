import { spawn } from 'node:child_process';

// Own the process group so a timeout cannot leave Aider's test subprocess alive.
export async function runCaptured(executable, args, { cwd, env, timeoutMs = 90000, signal } = {}) {
  signal?.throwIfAborted();
  const grouped = process.platform !== 'win32';
  const child = spawn(executable, args, { cwd, env, detached: grouped, stdio: ['ignore', 'pipe', 'pipe'] });
  const started = performance.now();
  let stdout = '', stderr = '', timed_out = false, aborted = false, killTimer;
  child.stdout.on('data', b => { stdout += b; });
  child.stderr.on('data', b => { stderr += b; });
  const kill = sig => {
    try { if (grouped && child.pid) process.kill(-child.pid, sig);else child.kill(sig); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  const terminate = () => { kill('SIGTERM');killTimer ??= setTimeout(() => kill('SIGKILL'), 1000); };
  const abort = () => { aborted = true;terminate(); };
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timed_out = true;terminate(); }, timeoutMs);
  try {
    const [code, exitSignal] = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, sig) => resolve([code, sig]));
    });
    return { code, signal: exitSignal, timed_out, aborted, elapsed_ms: performance.now() - started, stdout, stderr };
  } finally {
    clearTimeout(timer);clearTimeout(killTimer);
    signal?.removeEventListener('abort', abort);
    // Includes descendants that detached their stdio before the direct child exited.
    if (timed_out || aborted) kill('SIGKILL');
  }
}
