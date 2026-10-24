# Acceptance and reporting

## Validation scope

`0.4.0-rc.1` is a prerelease candidate; the latest stable release remains 0.3.0.
It adds diagnostics/reporting and protocol hardening to the 0.3.0 text/tool
contract. Access to real hardware resumed on 2026-10-24. The Panther Lake
validation below concerns the development checkout after publication of rc.1;
it does not replace or change the published archives. Earlier base/LNL evidence
remains historical. Persistent bindings remain experimental.

A simulator can check HTTP translation, protocol failures and recovery decisions.
It cannot establish model quality, native KV restoration or performance.

## Install a candidate in a clean prefix

Use Node.js >=22 on Linux/macOS, or WSL. From this checkout, prepare a local
archive, or download the matching archive and checksum from GitHub Releases:

```sh
npm pack --ignore-scripts
npm install --offline --ignore-scripts --no-audit --no-fund \
  --prefix "$PWD/install" "$PWD/xenolith-bridge-0.4.0-rc.1.tgz"
./install/node_modules/.bin/xenolith-bridge --version
```

Expect `xenolith-bridge 0.4.0-rc.1`. No npm registry account or global installation
is needed. The package bundles neither an engine nor a model. Published archives
and SHA256 sidecars are available from
[GitHub Releases](https://github.com/crrisci/xenolith-bridge/releases);
the latest stable release is 0.3.0. Before installing a downloaded archive,
verify its matching sidecar with `sha256sum -c ARCHIVE.sha256` on Linux or
`shasum -a 256 -c ARCHIVE.sha256` on macOS.

## Check an existing engine without generation

Start your engine separately, then run:

```sh
./install/node_modules/.bin/xenolith-bridge doctor \
  --socket /absolute/path/to/wire.sock --timeout-ms 3000 --report doctor-summary.json
```

The command only inspects the socket and sends `describe`. It neither creates
sessions nor performs inference. Exit code 0 means a valid reachable wire v1
service, not a passing real-model test. Exit code 1 means a failed check or
an invalid invocation; missing/incompatible/silent peers are reported explicitly.
Use a fresh report filename each time. Existing files and symlinks are refused.

`doctor --json` prints detailed local output, potentially including arbitrary
engine-provided fields. Share `doctor-summary.json` instead. That file contains
only versions, platform, check outcomes and capacity/KV capability values.
It omits model identity, local paths and raw error messages.

## Optional real-engine battery for hardware owners

Use Linux or WSL, an existing Xenolith wire v1 binary with durable sessions and
checkpoints, and a compatible local text model. The battery owns one engine at a
time, requires 21 GiB available RAM and a 65536-token context, and refuses to
start when another Xenolith engine is running. It does not download weights or
change the existing engine installation. Stop manually started engines/bridges
before this battery. Keep the checkout path short enough for Unix socket paths.

From this checkout, pointing to the independent installation created above:

```sh
export XENOLITH_BRIDGE_INSTALL_ROOT=/absolute/path/to/install
export XENOLITH_BRIDGE_PACKAGE_ARCHIVE=/absolute/path/to/xenolith-bridge-0.4.0-rc.1.tgz
export XENOLITH_BIN=/absolute/path/to/xenolith
export XENOLITH_MODEL=/absolute/path/to/model.gguf
npm run test:release:real
```

The driver uses the **installed package**, not the checkout's server. It tests
Responses JSON/SSE and Chat Completions JSON/SSE. Each case must request exactly
one `read_file` call, receive actual random fixture contents, and return them
exactly after bridge and engine restart. A saved checkpoint, explicit
`resume.loaded:true` and positive cached-token accounting are required. Each SSE
case cancels while a generation is uncommitted, restarts and recovers using
committed history without executing the tool again.

Expect four `API_ACCEPTANCE_PASS` lines and `RELEASE_TEST_FINISHED passed`.
A failing assertion is a failed check, including model instruction failures.
Run sequentially for each engine build. `RELEASE_TEST_ROOT` identifies a private
evidence directory. `release-result.json`, case responses and logs are private;
they may contain prompts, file contents and local paths.

The battery also writes **`release-summary.json`**. This field-limited report
retains per-case pass/fail/not-run, restart/cancellation/snapshot booleans,
package/Node versions, platform/architecture and optional engine/archive hashes. Partial failures preserve
already completed cases. Unknown fields and raw exception text are omitted.
The summary explicitly says **self-reported real-engine evidence**; it is not
signed proof and does not independently certify what was run.

For older raw results, create a summary locally:

```sh
xenolith-bridge report --input /private/release-result.json --output acceptance-summary.json
```

This accepts the real battery's result format and refuses simulator formats.
Exit code 0 means that exporting succeeded; read `status` and `complete_matrix`
to determine the reported acceptance outcome.
A claimed pass without all four complete cases is not exported as a passed
matrix. The command does not contact GitHub or upload data.

## Submit useful results

Review the summary before sharing: versions, capacities and hashes may identify
an environment. Open a Bug report issue with the summary, client/version,
expected/actual behavior and a minimal request containing invented data.
Do not attach the private raw reports, engine logs, credentials, session state,
prompts or tool results. Report whether a simulator or real engine was used.
No founder approval is assumed or necessary.

The driver itself is tested against a simulator by `npm test`. To validate an
archive's installation and both JSON interfaces without weights:

```sh
XENOLITH_BRIDGE_PACKAGE_ARCHIVE=/absolute/path/to/archive.tgz npm run test:package
```

This is a package/HTTP check, not evidence of real-model compatibility.

## Panther Lake development validation (2026-10-24)

The test host runs native Ubuntu 26.04.1, Node 22.23.4, an Intel Core Ultra X7
358H and Arc B390 (Panther Lake, PCI 8086:b080, xe). Xenolith uses fallback
kernels without XMX for this device; these runs do not qualify its GPU backend.
The engine source is `simoneiacomino/xenolith` at
`1e7025331fdb6bff4d9411e72bc526a86d73b0a0`, with
Gemma-4-26B-A4B-it-qat UD-Q4_K_XL and a 65536-token context. Only that
text/tool configuration is covered. No vision support or other model/backend
compatibility is inferred. Reference clients are SDK 7.32.0, Codex 0.162.1 and
Aider 0.86.2 (Python 3.12).

Private evidence retains raw requests, native counters, logs, test/source hashes,
package hashes and exit outcomes. The installed-package API battery requires
all four JSON/SSE cases, real fixture reads, snapshot restoration after restart
and cancellation/recovery in the SSE cases. Persistence and the Codex lifecycle
battery additionally cover recovery and coding/compaction/restart behavior.
These local runs supplement the Linux/macOS Node 22/24 release CI requirement;
they do not claim that hosted CI was run from this checkout.

On this host, the baseline checkout
`27bc4a2e484e7a60963d9c90fd12be1ca2f22a58` already passed all **4/4 installed
package API cases**: Responses JSON/SSE and Chat JSON/SSE, real fixture reads,
bridge/engine restart with loaded snapshots, and cancellation/recovery in both
SSE cases. The development harness changes below have their own retained
results; baseline evidence does not stand in for validating a changed runtime.

Observed feedback results on this host: both policies passed with normal client
exit 0 and independent verification. Deferred summarization took 92.6 seconds
of client runtime with two coding requests; enabled summarization took 217.5
seconds with three coding requests and three completed summary inferences.
The largest raw enabled-run test output was 19962 characters; model feedback
was bounded to 5662. Native input peaked at 7882 tokens across those requests,
compared with over 34000 in the earlier failed unbounded-feedback run. These
runs demonstrate completion within budget. Generation and scheduling also differ,
so this is not a controlled latency comparison.
Aider's changing full history still rebuilt native sessions; these runs do not
claim incremental Aider KV reuse.

### Aider feedback acceptance

```sh
# Uses both explicit summary policies by default; requires isolated Aider 0.86.2.
XENOLITH_BRIDGE_AIDER_PYTHON=/absolute/venv/bin/python npm run test:aider:feedback:real
```

The invoice fixture requires an actual failed model edit, the genuine failure
marker in a later **coding** request, correction of both editable modules,
passing Aider-run tests, an independent passing test run, unchanged test/runner
contents and normal Aider exit 0 within the original 900-second client budget.
A first-try success alone cannot pass feedback acceptance.

Only feedback sent to Aider is bounded to 8192 characters (long lines are
shortened). Complete stdout/stderr remains in private `test-runs.jsonl`.
A failure marker is retained only if present in that real output. This bounds
an exceptionally large Python traceback without changing tests or their exit
codes. A regression exercises a real error over 200000 characters.

Two separate runs set `--max-chat-history-tokens` explicitly: `32768` defers
summaries for this short fixture; `512` exercises Aider's actual background
summarizer. This is a soft history threshold, not the model context limit.
`XENOLITH_BRIDGE_AIDER_SUMMARY_MODES=deferred` or `enabled` selects one policy.
The default requires both, including at least one completed summary inference in
the enabled run. Optional diagnostics correlate wire events per HTTP request,
so overlapping summary/coding requests cannot inherit each other's timings.
The bridge remains client-neutral; it does not route or suppress summaries.

### Reproducible KV diagnostic

```sh
XENOLITH_BRIDGE_KV_SEED=ptl-20261024 \
XENOLITH_BRIDGE_KV_SIZES=32,128,512 \
XENOLITH_BRIDGE_KV_REPETITIONS=2 npm run test:kv
```

A recorded seed controls the sample shuffle, verification keys and pair order.
For each size, even repetition counts balance warm-before-fresh and
fresh-before-warm comparisons, and independently balance changed-prefix pairs.
Every sample seeds its owned session first, then measures identical continuation
history on that session and a fresh session; changed-prefix requests follow the
warm continuation. The complete schedule is written before generation begins.

The driver checks process names for competing builds before/after each turn,
records timestamps/load average, and refuses active builds or unreadable process
names. It also inherits the engine's memory/other-engine preflight. It never
terminates another user's work. These checks describe the sampled host state;
they cannot guarantee that a shared host has no activity between samples.

Raw results retain elapsed time, first text latency, native usage and any
prefill/decode timings, checkpoint/resume data and persistence events. Wire-done
and commit offsets separate finalization overhead; native checkpoint duration
is null when the engine does not report it. Medians include observation counts; absent native fields stay null rather than zero.
A warm continuation must report actual cache reuse, while a changed prefix must
rebuild. **A fresh session is not guaranteed to have cold native cache.** Within each
pair, both requests use identical prompt bytes; a seeded rerun uses the same workload,
so an engine-wide cache can also influence reruns. Timings include generation,
HTTP and checkpoint work and apply only to this controlled diagnostic, not a
general throughput claim or a comparison against earlier Lunar Lake hardware.

## Candidate publication checklist

1. Run unit/protocol, SDK, Codex, Aider and offline package suites. Verify that
   reports do not copy arbitrary native strings or private fixture data.
2. Require the pinned Linux/macOS Node 22/24 CI matrix. Review early-warning
   results for newer clients separately; see COMPATIBILITY.md.
3. Preserve explicit unsupported-feature and experimental-session boundaries.
   Disclose exactly which checkout/archive, engine, model and client versions
   were exercised; retain failures and distinguish historical release evidence.
4. Review the candidate version, notes and packed contents before tagging.
   After publication, download both archives, verify checksums/content and test
   clean installation. Publishing a candidate tag creates a prerelease, not a stable release.
