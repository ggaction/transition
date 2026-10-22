# @ggaction/transition

Interruptible, data-aware SVG transitions for ggaction. Repository:
[ggaction/transition](https://github.com/ggaction/transition).

This package consumes version-1 scenes from `ggaction/scene`. It has no runtime
dependencies and does not load ggaction, recompute charts, or modify action history.
The scene producer and the animation player are independently usable.

## Install from source

The package is prepared for npm distribution; no npm registry release has been
published yet. The `ggaction/scene` producer currently lives on ggaction's
`codex/edit-axes-autocomplete` branch. Use that source until it ships in a release.

```sh
npm install github:ggaction/transition
git clone --branch codex/edit-axes-autocomplete https://github.com/ggaction/ggaction.git
npm install ./ggaction
```

```js
import { chart } from 'ggaction';
import { createTransitionScene } from 'ggaction/scene';
import { createTransitionPlayer } from '@ggaction/transition';

const current = chart().createCanvas({ width: 600, height: 400 })
  .createData({ id: 'data', values: [{ x: 1, y: 2 }, { x: 2, y: 3 }] })
  .createScatterPlot({ id: 'points', data: 'data', x: { field: 'x' }, y: { field: 'y' } });
const next = current.encodeColor({ target: 'points', value: '#e45756' });
const container = document.querySelector('#chart'); // Give it a width and height.
const player = createTransitionPlayer(container, { duration: 300 });
await player.set(createTransitionScene(current));
await player.transitionTo(createTransitionScene(next));
// A new call during animation continues from the displayed frame.
await player.transitionTo(createTransitionScene(current));
player.destroy();
```

## API

- `planTransition(before, after)`: pure, linear-time correspondence plan with
  `updates`, `enters`, `exits`. Works in Node and Workers; no DOM required.
- `createTransitionPlayer(container, { duration = 300, maxAnimatedNodes = 3000,
  onFinish } = {})`: owns one SVG in the container and replaces its existing
  content. Use a dedicated container. Uniformly fits the native canvas.
- `player.set(scene)`: immediately display a scene.
- `player.transitionTo(scene, { duration } = {})`: retarget without resetting the
  displayed coordinates. Promise resolves with `status: 'finished'`,
  `'superseded'`, or `'destroyed'`; interrupted requests never remain pending.
- `player.scene`: destination scene; `player.animating`: pending animation frame;
  `player.element`: SVG; `player.stats`: diagnostic counts/frame work.
- `player.destroy()`: cancel playback, settle promises, remove SVG and listeners.

Scenes are readonly serializable values with `version`, native `width`/`height`,
SVG `definitions` and ordered `nodes`. Nodes carry opaque `key`, concrete `type`,
path `topology`, a concrete `svg` fragment, parent `offset`, and canvas `clip`.
Use trusted scene producers; scenes contain SVG markup and are not a general
untrusted SVG upload format. Unknown versions and duplicate keys are rejected.
The package ships TypeScript declarations; no TypeScript runtime is required.

## Behavior and limits

Matched primitives interpolate position, size, paint, opacity and compatible
path commands. Point shape changes, changed path topology, text replacement,
incompatible paints and unknown correspondence use a local crossfade. Matching
never uses screen proximity or DOM order. Arc flags remain discrete. Facet
placements and nested canvas clips are interpolated in absolute coordinates.
Unchanged nodes stay mounted. Final attributes equal the destination exactly.

The player automatically respects `prefers-reduced-motion`, including preference
changes during playback. Chart computation belongs outside animation frames;
precompute scenes in a Worker and cache only a bounded working set. The player
caches eight compiled scenes, shares plot clipping resources, cleans discarded
resources, and bounds outgoing ghosts during rapid unrelated transitions.
If expensive SVG painting causes repeated missed display frames, the player
temporarily updates the chart at approximately 30 fps to leave display frames
available for surrounding UI animations and pointer feedback. It probes the
normal display rate again after recovery. Duration, interruption continuity and
exact final attributes are unchanged; idle time is not treated as a slow frame.
Above `maxAnimatedNodes`, changed primitive attributes crossfade instead of
performing large numeric morphs. This bounds interpolation work, not rendering
cost: very large SVG scenes still require browser profiling.

The caller owns hover intent, committed state, Apply, history and stale async
request cancellation. Every hover candidate should be computed from the committed
program; animation destination changes do not apply ggaction actions.

## Tests

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm pack --dry-run
```

`CHROME_PATH` optionally selects an existing Chrome executable. Browser tests
verify exact retarget continuity, retained identity, 120 rapid switches, cleanup,
invalid input, promise settlement, and reduced motion. Native chart pixel and
performance integration tests live in `ggaction/vis-autocomplete` under
`test/browser/transition-player.py` and `transition-mode.py`.
