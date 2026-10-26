# Release and package checks

Normal pushes and PRs run checks only. This repository has no automatic npm publication workflow. The package currently declares `0.1.1` but has not published a registry release; a version field alone is not evidence of publication.

Before an explicitly authorized release:

1. Choose the version with the maintainer; do not invent or bump it during routine work.
2. Verify a clean checkout with `npm ci`, `npm run check:docs`, `npm test`, `npm run test:browser`, and `npm run test:package`.
3. Review `npm pack --dry-run` and the packed consumer. Only intended source, types, README, API documentation, and license should ship; no tests, credentials, caches, or app checkout should be required at runtime.
4. Check package metadata, changelog, install instructions, public signatures, and compatible scene-producer revisions. Keep MIT notices.
5. Publish only after separate authorization, using an authorized npm account and the reviewed artifact. Do not expose tokens or add broad publication credentials to ordinary PR jobs.
6. Verify the actual registry version, artifact contents/integrity, and installation in a fresh consumer before announcing availability. Update installation-status copy only after this verification.

Application integration is separate: VisAutocomplete consumes a pinned Git submodule and records its revision in `deployment-sources.json`. A library commit or npm release does not deploy the application.
