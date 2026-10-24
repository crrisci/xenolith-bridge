import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

// Read-only: never stop builds or other users' processes on a shared machine.
export async function idleSnapshot() {
  const builds = [], unreadable = [];
  for (const pid of await readdir('/proc')) if (/^\d+$/.test(pid)) {
    try {
      const name = (await readFile(`/proc/${pid}/comm`, 'utf8')).trim();
      if (/^(cargo|rustc|rust-lld|cc|c\+\+|cc1|cc1plus|gcc|g\+\+|clang(?:\+\+)?|ninja|make|cmake|ld(?:\.bfd|\.gold|\.lld)?|lld|mold|lto1|collect2|as)(?:-\d+)?$/.test(name)) builds.push({ pid, name });
    } catch (error) {
      if (['EACCES', 'EPERM'].includes(error.code)) unreadable.push(pid);
      else if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error;
    }
  }
  const snapshot = { at: new Date().toISOString(), loadavg: (await readFile('/proc/loadavg', 'utf8')).trim(), builds, unreadable };
  assert.equal(unreadable.length, 0, `Cannot exclude concurrent builds; unreadable process names: ${unreadable}`);
  assert.equal(builds.length, 0, `Concurrent build detected: ${JSON.stringify(builds)}; retry when the host is idle`);
  return snapshot;
}
