# Transition API

The runtime exports three functions from `@ggaction/transition`. Public types are in [src/index.d.ts](../src/index.d.ts). This reference describes the current source, not an announced npm release.

## Choose a scene format

| Scene | Producer | Consumer |
| --- | --- | --- |
| `TransitionScene`, `version: 1` | `createTransitionScene(program)` from a compatible `ggaction/scene` | `createTransitionPlayer`, `planTransition` |
| `CanvasTransitionScene`, `version: 2` | `createTransitionScene(program, { format: 'canvas' })` | `createCanvasTransitionPlayer` |

Scenes are readonly, concrete, serializable graphics. Keep keys stable for the same logical mark and scope them across panels. Do not mutate a scene after submitting it; compiled scene caches rely on stable inputs. Unique keys, finite offsets/clips, supported primitives, and positive scene dimensions are required. Neither player computes statistics, resolves encodings, or infers identity from spatial proximity.

SVG scenes contain definitions and node fragments. Canvas nodes contain concrete properties, offset/clip frames, and optional outer-to-inner `clips`. Treat both formats as trusted producer output, not an untrusted document format. A renderer callback is application code and can execute arbitrary behavior.

## Player creation

```js
const svg = createTransitionPlayer(host, {
  duration: 300,
  maxAnimatedNodes: 3000,
  onFinish: scene => { /* optional */ },
});
const canvas = createCanvasTransitionPlayer(host, {
  render: renderTransitionScene,
  duration: 300,
  maxAnimatedNodes: 3000,
  onFinish: scene => { /* optional */ },
});
```

Use a dedicated host: creation replaces its existing children. Give it an explicit layout size, and use `position: relative` for a Canvas host. The player uniformly fits the native scene without changing its aspect ratio. `duration` is milliseconds; zero applies immediately. `onFinish` runs for a completed destination, including immediate `set` calls. It is not a signal that an application history step was committed.

The Canvas `render(scene, context, { pixelRatio })` callback must synchronously size/clear the backing canvas and paint the supplied concrete scene. ggaction's `renderTransitionScene` implements this contract. The callback must render the scene it receives, including intermediate properties and opacity, rather than a separately captured original chart. The small [standalone demo](../examples/basic/app.js) shows a minimal circle renderer; it is not a replacement for the full native renderer.

## Lifecycle

| Member | Meaning |
| --- | --- |
| `set(scene)` | Apply immediately; returns a transition-result promise. |
| `transitionTo(scene, { duration }?)` | Retarget from the currently displayed state; optional duration overrides the default. |
| `scene` | Destination scene, or `null` before the first scene. It is not an intermediate-frame snapshot. |
| `element` | Owned `SVGSVGElement` or `HTMLCanvasElement`. |
| `animating` | Whether an animation frame is pending. |
| `stats` | Diagnostic frame/retarget/work/resource counts; not a portable benchmark score. |
| `destroy()` | Cancel frames, settle a pending request, release resources, and remove the owned element. Repeated destroy is safe. |

Results use `status: 'finished' | 'superseded' | 'destroyed'`. A newer target settles the older request as superseded; destruction settles pending playback as destroyed. Invalid scenes may throw synchronously, and rendering errors may reject, so wrap calls in normal error handling. Playback after `destroy()` throws.

## Rapid hover and asynchronous scene preparation

The player handles animation interruption. Your application must separately reject stale **computation** results. For example:

```js
let generation = 0;
async function preview(program) {
  const requested = ++generation;
  const scene = await computeScene(program); // Your worker/cache integration.
  if (requested !== generation) return;
  return player.transitionTo(scene);
}
function dispose() {
  generation++; // A late worker response must not call a destroyed player.
  player.destroy();
}
```

Compute each candidate from the application's committed program. Retarget directly when moving between candidates; do not reset to the committed scene first. Restore the committed scene when preview intent ends. Whether to debounce short pointer gaps or commit on Apply is an application decision, not player state.

## Interpolation and limits

Compatible numeric geometry, paint, opacity, and path commands interpolate. Changes in text, path topology, primitive type, or incompatible styles use local fades. Arc flags remain discrete. Nested offsets and clips follow their marks; the final destination is exact.

For SVG, compiled scenes and outgoing resources are bounded; unchanged nodes remain mounted. Above `maxAnimatedNodes`, large attribute morphs fall back to fades. Expensive SVG painting can trigger temporary lower-frequency updates to leave time for surrounding UI, while preserving duration and endpoints.

For Canvas, dense scenes blend bounded snapshots rather than repainting every intermediate primitive. A retarget captures the displayed bitmap, and the final frame uses the exact scene renderer. Backing dimensions are limited to 4096 per axis and 16 million pixels. Device-pixel ratio and host resize are handled separately from logical geometry. These measures bound specific costs, not all rendering or scene-preparation time.

Both players respect `prefers-reduced-motion`, including a preference change during playback. Test this path as well as normal animation. Keep expensive chart preparation outside animation callbacks.

## Pure planner

`planTransition(before, after)` accepts **version-1 SVG scenes only**. It validates both inputs and returns `{ updates, enters, exits }`. Same key/type/topology produces an update; unmatched or incompatible nodes enter/exit. This is a linear-time correspondence plan without DOM access or animation timing, suitable for Node and Workers. Canvas playback has its own internal correspondence handling; there is no public Canvas planning export.
