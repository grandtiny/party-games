# QQ Farm V7 Source Baseline

This directory is the reproducible, V7-only inventory for the authorized source release `7.0 Beta1 Build 20120209.1000`.
It does not use the previous classic asset catalog and does not contain source-machine paths, player records, credentials, or deployment settings.

Generate and verify it with:

```powershell
pwsh -NoProfile -File scripts/build-manor-v7-source-inventory.ps1 -SourceRoot <QQnc-root>
pwsh -NoProfile -File scripts/test-manor-v7-source-inventory.ps1
pwsh -NoProfile -File scripts/build-manor-v7-avatar-catalog.ps1
pwsh -NoProfile -File scripts/patch-manor-v7-avatar-links.ps1 -SourceRoot <QQnc-root>
pwsh -NoProfile -File scripts/test-manor-v7-avatar-links.ps1
pwsh -NoProfile -File scripts/build-manor-v7-swf-audio-inventory.ps1 -SourceRoot <QQnc-root>
pwsh -NoProfile -File scripts/test-manor-v7-swf-audio-inventory.ps1
```

Files:

- `FEATURE-MATRIX.md`: complete source-project capability matrix with implemented, partial, localized, deferred, and abandoned status.
- `files.csv`: every V7 module file with hash, domain, category, kind, and integration policy.
- `categories.csv`: counts and sizes grouped by runtime domain and policy.
- `duplicates.csv`: byte-identical source files; duplication does not imply that business identities can be merged.
- `config-files.csv`: the 20 PHP configuration files used only as rule reconstruction inputs.
- `database-boundary.csv`: the seven mutable player-data tables, all explicitly excluded from migration.
- `source-protocols.csv`: every farm and pasture entry allowlist module plus source handlers that are missing or unreachable from those allowlists.
- `summary.csv`: source version and inventory totals.
- `swf-symbols.csv`: root classes, placed characters, depths, symbols, exports, and bounds for every V7 SWF.
- `swf-issues.csv`: SWF files that could not be structurally inspected; never silently treated as usable.
- `swf-summary.csv`: structural inspection coverage.
- `swf-audio.csv`: every dedicated animal sound SWF with codec, sample rate, duration, stage, and placeholder status.
- `swf-audio-summary.csv`: stable audio coverage totals and duration bounds.
- `catalog-*.csv`: V7 crops, animals, fish, decorations, tools, timings, and land upgrades reconstructed from PHP configuration.
- `catalog-avatars.csv`: all 326 local farm figures reconstructed from the original QQ Show XML and matching PNG assets.
- `rules-summary.csv`: V7 rule counts and a stable configuration fingerprint.
- `runtime-catalog-assets.csv`: full-root V7 crop and animal state exports with source/output hashes and bounds.
- `runtime-catalog-issues.csv`: catalog states that could not be exported; the runtime test requires this to remain empty.
- `contact-sheets/scenes`: labeled V7 background previews used to identify screenshot references before full-layer export.

Runtime policy:

- `core-candidate`: eligible for extraction and visual review.
- `optional-social`: optional avatar/social content, never required for the farm or pasture loop.
- `deferred-liveops`: event and time-limited content, inventoried but not part of the first implementation.
- `excluded-monetization`: legacy VIP or premium content, never enabled by default.

No file becomes a web runtime asset merely because it appears in this inventory. SWF symbols, frames, anchors, layers, and visual states must pass a separate extraction and visual-review manifest first.
