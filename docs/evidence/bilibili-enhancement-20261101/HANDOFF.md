# Bilibili enhancement handoff

Documentation publication only. Product source and existing PR #3–#8 branches are untouched. The user authorized this separate documentation Draft PR after receiving the research bundle.

Specification: SPEC-BILIBILI-ENHANCEMENT.md (repository-root file; see README for the relative link).
Evidence target: PR #8 commit e46f05cb170ebbb534341ea84cce442a7e6c16cb, NOT the current main-based documentation branch.
Base at publication: de5e0641d99ff5a22d7a4d059720bcc6c5fa567e.

G1: multilingual /zh-Hant/video path excluded by metadata and runtime (reproduced).
G2: URL/initial-page CID lookup does not establish the current media's CID (evidence/design gap, not observed live wrong skip).
G3: stale videoDuration=999 accepted for a 120-second video (reproduced).

Next: existing stack owner should reconcile exact integration head before editing shared speed-pro.user.js. Do not create a second coordinator or Sponsor engine. Start with the routing/context and duration checks, preserve other platforms and fail-closed CID handling.

No independent reviewer was available under the one-worker scope. SPEC review and live Chromium/Tampermonkey acceptance remain pending. The 16-group npm test log is historical evidence for the pinned #8 source, not a test claim for later commits. Diagnostic exit 0 confirms known gaps, not product acceptance.
