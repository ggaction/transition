# Security policy

Report vulnerabilities privately to Hyeon Jeon at [jeonhyun97@gmail.com](mailto:jeonhyun97@gmail.com), with the subject **ggaction transition security report**. Include the revision, rendering path, minimal reproduction, and impact. Do not post exploitable details or private charts in a public issue. There is no guaranteed response-time or bounty program.

## Trust boundary

This library consumes trusted scenes. SVG scenes contain markup that is parsed and inserted into the DOM. Shape/schema validation does not sanitize SVG or make arbitrary uploads safe. Do not pass user-supplied SVG/scene JSON from an untrusted source directly to the player. Use a trusted producer and enforce your application's own input, isolation, CSP, and size/resource policies.

Canvas scenes contain concrete drawing properties and are passed to a caller-supplied synchronous renderer. That renderer is executable application code. Scene text can contain confidential information even when a scene has no raw source rows; sanitize reproductions before sharing them.

The package does not authenticate users, fetch datasets, store histories, or own your application security policy. Use local tests and data you control; do not access other people's information or stress third-party services when investigating.

Fixes target current source and the latest published package, if a registry release exists. There is no separate backport commitment for older Git revisions. Vulnerabilities in the scene producer or consuming editor should be coordinated with those maintainers privately.
