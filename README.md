# @ggaction/transition

**Smooth chart transitions that can change direction mid-animation.**

This library plays transitions between concrete [ggaction](https://github.com/ggaction/ggaction) scenes. It supports **Canvas and SVG**, continues from the currently visible frame when interrupted, and settles every pending transition request. It does not compute charts, apply ggaction actions, or own your application's history.

[API reference](docs/api.md) · [Runnable demo](examples/basic/) · [Contribute](CONTRIBUTING.md) · [Report an issue](https://github.com/ggaction/transition/issues/new/choose)

## Why use it?

- **Fast retargeting:** move between previews without returning to a stale starting chart.
- **Stable correspondence:** match explicit scene keys, not nearby pixels or DOM order.
- **Two rendering paths:** native Canvas scenes or SVG scenes, with a separate pure SVG correspondence planner for Node/Workers.
- **Exact endpoints:** compatible geometry interpolates; incompatible geometry/text fades; the final frame matches the destination scene.
- **Bounded resources:** dense Canvas scenes use snapshot blending, and discarded playback resources are released.
- **Accessible motion:** both players respect `prefers-reduced-motion`, including changes during playback.

The caller still owns candidate computation, hover intent, committed state, and cancellation of stale asynchronous work. Large-scene rendering can remain expensive; the library does not promise a particular frame rate on every device.

## Installation status

The source package declares version `0.1.1`, but this project has **not published an npm registry release**. Install from the public Git repository for now:

```sh
npm install github:ggaction/transition
```

Commit your application's lockfile to retain the resolved revision. The package has no runtime dependencies and includes TypeScript declarations. Node.js 20+ is declared; contributor CI uses Node.js 22. The players require a browser DOM and a dedicated, non-zero-size container.

Do not assume that an arbitrary published ggaction version includes the scene producer used by current development. The working ggaction source integration is on `codex/overlay-composition-v025`; the VisAutocomplete app records an exact tested revision in its [deployment-sources.json](https://github.com/ggaction/vis-autocomplete/blob/main/deployment-sources.json). Check access and pin compatible revisions for your own application.

## Run the standalone demo

This example needs neither ggaction nor an account. It uses small synthetic scenes and demonstrates both rendering paths, rapid retargeting, immediate updates, and cleanup.

```sh
git clone https://github.com/ggaction/transition.git
cd transition
npm ci
npm run demo
```

Open **http://127.0.0.1:5175/**. Hover the three destination buttons or use the rapid-switch control. `PORT` selects another local port. The example's small renderer illustrates the Canvas callback contract; use ggaction's renderer for real ggaction scenes.

## Use with ggaction

Install a compatible ggaction source alongside this package, for example the current integration branch:

```sh
npm install github:ggaction/ggaction#codex/overlay-composition-v025
```

Provide a host such as `<div id="chart" style="position:relative;width:600px;height:400px"></div>` in your page. In your browser application's module or bundler entry:

```js
import { chart } from 'ggaction';
import { createTransitionScene, renderTransitionScene } from 'ggaction/scene';
import { createCanvasTransitionPlayer } from '@ggaction/transition';

const before = chart()
  .createCanvas({ width: 600, height: 400, margin: 60 })
  .createData({ id: 'data', values: [{ x: 1, y: 2 }, { x: 2, y: 3 }] })
  .createScatterPlot({ id: 'points', data: 'data',
    x: { field: 'x' }, y: { field: 'y' } });
const after = before.encodeColor({ target: 'points', value: '#e45756' });
const player = createCanvasTransitionPlayer(document.querySelector('#chart'), {
  render: renderTransitionScene,
  duration: 300,
});

await player.set(createTransitionScene(before, { format: 'canvas' }));
await player.transitionTo(createTransitionScene(after, { format: 'canvas' }));
// A new request during playback starts from what is currently painted.
await player.transitionTo(createTransitionScene(before, { format: 'canvas' }));
// When the host is unmounted:
player.destroy();
```

For SVG, use `createTransitionPlayer(host)` and `createTransitionScene(program)` (version 1). Do not pass a version-2 Canvas scene to the SVG player or to `planTransition`.

## API at a glance

| Export | Input | Responsibility |
| --- | --- | --- |
| `createCanvasTransitionPlayer(host, { render, ...options })` | Version-2 Canvas scenes | Browser playback using your synchronous scene renderer |
| `createTransitionPlayer(host, options)` | Version-1 SVG scenes | Browser playback; owns one SVG in the host |
| `planTransition(before, after)` | Two version-1 SVG scenes | Pure correspondence plan: updates, enters, exits |

Both players provide `set`, `transitionTo`, `destroy`, and readonly `scene`, `element`, `animating`, and `stats`. A transition promise resolves to `{ status: 'finished' }`, `{ status: 'superseded' }`, or `{ status: 'destroyed' }`; invalid input and renderer failures can throw/reject. Calling playback after destruction throws. See [API details and integration patterns](docs/api.md) and [TypeScript declarations](src/index.d.ts).

Scenes must come from trusted producers. SVG scenes contain markup; this package is **not an SVG sanitizer** or an upload parser. See [SECURITY.md](SECURITY.md).

## Contributing and checking changes

```sh
npm ci
npm run check:docs
npm test
npx playwright install chromium
npm run test:browser
npm run test:package
```

Browser checks cover Canvas/SVG endpoints, interruptions, nested clips, reduced motion, and resource cleanup. The package check installs the packed tarball in an isolated temporary consumer and imports its public API. `CHROME_PATH` can select an existing Chrome executable for browser tests. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow and performance expectations.

## License

[MIT](LICENSE), copyright Hyeon Jeon and the respective contributors. Commercial use is permitted under that license. Contributions use the same license without a separate CLA or copyright assignment. ggaction and applications using this package have their own repositories and terms.
