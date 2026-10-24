Xenolith Bridge 0.4.0-rc.2 — Panther Lake feedback and diagnostics candidate.

This prerelease candidate packages the changes after rc.1. The Responses and
Chat Completions text/tool contract remains the same: JSON by default and SSE
with `stream:true`. Persistent bindings remain experimental.

- Bound feedback sent to Aider while retaining complete raw test output and
  unchanged tests. Exercise deferred and enabled background summarization,
  genuine failed edits, correction and independent verification.
- Correlate optional HTTP/wire diagnostics by request ID, including overlapping
  coding and summarization requests, without changing client payloads.
- Reap owned client process groups on timeout so descendants cannot outlive a
  failed feedback run.
- Seed and counterbalance KV diagnostics; retain native timings, checkpoint and
  actual snapshot-load reports. Fresh sessions do not imply cold native cache.
- Document the scope of actual Panther Lake development evidence separately
  from earlier rc.1 archives and from acceptance of the exact release artifact.

The retained development runs use native Linux/PTL, Xenolith commit
1e7025331fdb6bff4d9411e72bc526a86d73b0a0 and Gemma-4-26B-A4B-it-qat
UD-Q4_K_XL. Aider feedback passed with both summary policies. These observations
are scoped integration evidence, not GPU/XMX qualification, general model
quality, or a performance comparison against Lunar Lake. See ACCEPTANCE.md for
source identities and the installed-artifact acceptance procedure.

The candidate keeps rc.1's read-only doctor, field-limited private reports and
protocol fault hardening. Report files are never uploaded automatically.

Requires Node.js >=22 and an existing text-only Xenolith wire v1 engine. Native
Windows runs the bridge in WSL. No runtime dependencies, engine or model are
bundled; the package is not published to the npm registry. When tagged, the
pinned Linux/macOS Node 22/24 matrix gates GitHub publication of npm/source
archives and SHA256 sidecars. Creating a prerelease does not promote stable.

Release validation must preserve the exact tested archive hash and clean
installation evidence; earlier development runs cannot substitute for those
checks. Latest-client probes remain separate from the pinned release gate.

Reasoning, media, hosted/deferred tools, forced tool choice, strict/structured
outputs, Responses storage/retrieval and WebSockets remain unsupported. Complete
client history is required; persistent identity alone does not guarantee cache
reuse. MIT; CodeXe remains a separate Apache-2.0 project.
