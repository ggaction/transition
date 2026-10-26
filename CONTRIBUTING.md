# Contributing to @ggaction/transition

Bug reports, small examples, documentation, performance investigations, and code are welcome. This is an independent scene-playback library; you do not need the VisAutocomplete app or a Supabase account to work on it.

## Start locally

```sh
git clone https://github.com/ggaction/transition.git
cd transition
npm ci
npm run demo
```

Open `http://127.0.0.1:5175/`. Use Node.js 22 for development; [.nvmrc](.nvmrc) matches CI. The demo uses trusted synthetic Canvas/SVG scenes and a small renderer, with no external chart/data fetches.

Fork the repository, create a focused branch, and open a PR against `main`. Discuss new exports, scene contracts, dependencies, or large architectural changes in an issue first. Existing users rely on interruption, promise-settlement, and cleanup behavior.

## What belongs here?

- **Here:** scene correspondence, interpolation, interruption, timing, clipping, reduced motion, and player resource management.
- **ggaction:** converting chart programs into scenes, native chart semantics, public authoring actions, and native rendering.
- **Your application:** hover intent, candidate preparation, asynchronous request freshness, Apply/Undo, and persistent history.

Do not add a runtime dependency on the editor or run chart actions inside animation frames. Keep Canvas and SVG support explicit; `planTransition` currently accepts only SVG scenes. Public signatures and behavior must match [src/index.d.ts](src/index.d.ts) and [docs/api.md](docs/api.md).

## Before requesting review

```sh
npm run check:docs
npm test
npx playwright install chromium
npm run test:browser
npm run test:package
```

On Linux, `npx playwright install --with-deps chromium` installs required system libraries and may need administrator privileges. `CHROME_PATH` optionally chooses an existing Chrome executable. Run the browser tests for interpolation, timing, or resource changes; documentation-only edits do not require an unrelated performance benchmark.

For a behavior fix, include a regression that reproduces the original problem. Check the relevant subset of: exact final properties, mid-flight retarget continuity, promise statuses, malformed input, enter/exit cleanup, repeated destruction, nested clips, host resizing, device-pixel ratio, and reduced motion. Avoid tests that only duplicate implementation steps.

For performance changes, record browser/device, scene/node count, renderer, duration, repeated retarget sequence, and before/after measurements. Preserve all nodes and exact endpoints. Keep traces and screenshots under ignored `output/`; do not commit private charts or large generated captures.

The package test packs the actual distributable, installs it into a temporary consumer without fetching runtime dependencies, and verifies public imports and shipped types/license. Do not introduce a `prepare` script that makes installation require a private repository or cloud service.

## Reporting a problem

Use the [issue forms](https://github.com/ggaction/transition/issues/new/choose). Include the Git/package revision, Canvas or SVG, browser/OS, a minimal trusted scene, interruption sequence, and expected behavior. If the problem only appears with ggaction output, include the producer revision and a small synthetic chart. Never upload confidential scene text or data. For vulnerabilities, use [SECURITY.md](SECURITY.md).

## Review, ownership, and releases

Hyeon Jeon currently maintains this library. Maintainers review compatibility, source provenance, and validation before merging. English is used for contribution documents and new documentation. Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Contributions are submitted under the existing [MIT license](LICENSE), unless explicitly agreed otherwise before review. You retain copyright; no CLA or copyright assignment is required. Submit only material you are authorized to contribute, preserve third-party notices, and identify material AI assistance and how you validated it. MIT permits both maintainers and other recipients to use contributions commercially under its terms.

A merged PR does not publish to npm. Version changes, tags, and package publication require a separate maintainer decision. The current repository is installable from Git; do not describe a registry release as available until it is actually published and verified. See [release checks](docs/releasing.md).
