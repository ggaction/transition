import { createCanvasTransitionPlayer, createTransitionPlayer } from '/src/index.js';

const host = document.querySelector('#chart');
const status = document.querySelector('#status');
const renderer = document.querySelector('#renderer');
const duration = document.querySelector('#duration');
const buttons = [...document.querySelectorAll('[data-scene]')];
const colors = ['#1677b8', '#e36a36', '#14967a'];
const width = 600, height = 300;
const positions = [
  [230, 200, 185, 160, 120, 90, 75, 45],
  [45, 70, 110, 130, 155, 200, 215, 240],
  [150, 70, 60, 135, 220, 225, 140, 75],
];
const canvases = positions.map((ys, scene) => ({
  version: 2, width, height,
  nodes: ys.map((y, index) => ({ key: `point-${index}`, type: 'circle', topology: '',
    properties: { x: 55 + index * 70, y, radius: 8 + index, fill: colors[scene] },
    offset: [0, 0], clip: [0, 0, width, height] })),
}));
const svgs = canvases.map(scene => ({ version: 1, width, height, definitions: '',
  nodes: scene.nodes.map(node => ({ key: node.key, type: 'circle', topology: '',
    svg: `<circle cx="${node.properties.x}" cy="${node.properties.y}" r="${node.properties.radius}" fill="${node.properties.fill}"/>`,
    offset: node.offset, clip: node.clip })),
}));

// Minimal renderer for this circle-only example. Real ggaction scenes should use
// renderTransitionScene from ggaction/scene, which supports every native primitive.
function paint(scene, context, { pixelRatio }) {
  context.canvas.width = Math.max(1, Math.round(scene.width * pixelRatio));
  context.canvas.height = Math.max(1, Math.round(scene.height * pixelRatio));
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, scene.width, scene.height);
  for (const node of scene.nodes) {
    const p = node.properties;
    context.save();
    for (const clip of node.clips ?? [node.clip]) {
      context.beginPath(); context.rect(...clip); context.clip();
    }
    context.translate(...node.offset);
    context.globalAlpha = p.opacity ?? 1;
    context.fillStyle = p.fill;
    context.beginPath(); context.arc(p.x, p.y, p.radius, 0, Math.PI * 2); context.fill();
    context.restore();
  }
}

let player, selected = 0, generation = 0, timer;
const scene = index => (renderer.value === 'canvas' ? canvases : svgs)[index];
const stopRapid = () => { clearInterval(timer); timer = undefined; };
function report(error) { status.textContent = `Playback failed: ${error.message}`; }
async function show(index, immediate = false) {
  selected = index;
  const request = ++generation;
  for (const button of buttons) button.setAttribute('aria-pressed', String(Number(button.dataset.scene) === index));
  host.setAttribute('aria-label', `${buttons[index].textContent} synthetic points, ${renderer.value} renderer`);
  status.textContent = `Moving to ${buttons[index].textContent.toLowerCase()}…`;
  try {
    const result = await (immediate ? player.set(scene(index)) : player.transitionTo(scene(index), { duration: Number(duration.value) }));
    if (request === generation) status.textContent = `${result.status} · ${renderer.value} · ${player.stats.nodes} nodes`;
  } catch (error) { if (request === generation) report(error); }
}
function recreate() {
  stopRapid(); generation++; player?.destroy();
  player = renderer.value === 'canvas'
    ? createCanvasTransitionPlayer(host, { render: paint })
    : createTransitionPlayer(host);
  return show(selected, true);
}
for (const button of buttons) {
  const preview = () => { stopRapid(); void show(Number(button.dataset.scene)); };
  button.addEventListener('pointerenter', preview);
  button.addEventListener('focus', preview);
  button.addEventListener('click', preview);
}
renderer.addEventListener('change', recreate);
duration.addEventListener('input', () => { document.querySelector('#duration-value').textContent = `${duration.value} ms`; });
document.querySelector('#immediate').addEventListener('click', () => { stopRapid(); void show(selected, true); });
document.querySelector('#recreate').addEventListener('click', recreate);
document.querySelector('#rapid').addEventListener('click', () => {
  stopRapid(); let count = 0;
  timer = setInterval(() => { void show((selected + 1) % 3); if (++count === 18) stopRapid(); }, 55);
});
window.addEventListener('pagehide', () => { stopRapid(); generation++; player?.destroy(); });
await recreate();
