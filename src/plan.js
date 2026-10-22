export function validateScene(scene) {
  if (scene?.version !== 1) throw new TypeError('Unsupported transition scene version; expected 1.');
  if (![scene.width, scene.height].every(n => Number.isFinite(n) && n > 0) || !Array.isArray(scene.nodes) || typeof scene.definitions !== 'string') {
    throw new TypeError('A transition scene requires positive dimensions, definitions and nodes.');
  }
  const seen = new Set();
  for (const n of scene.nodes) {
    if (typeof n.key !== 'string' || seen.has(n.key) || typeof n.svg !== 'string' ||
      !['circle','rect','line','path','text'].includes(n.type) ||
      n.offset?.length !== 2 || n.clip?.length !== 4 ||
      ![...n.offset,...n.clip].every(Number.isFinite) || n.clip[2]<0 || n.clip[3]<0) {
      throw new TypeError('Scene nodes require unique keys, concrete graphics, offsets and clips.');
    }
    seen.add(n.key);
  }
  return scene;
}

/** Pure correspondence plan, usable in Node or a Worker. No DOM or timers. */
export function planTransition(before, after) {
  validateScene(before); validateScene(after);
  const old = new Map(before.nodes.map(node => [node.key, node]));
  const updates = [], enters = [], exits = [];
  for (const node of after.nodes) {
    const from = old.get(node.key);
    if (from && from.type === node.type && from.topology === node.topology) {
      updates.push({ key: node.key, from, to: node }); old.delete(node.key);
    } else enters.push(node);
  }
  exits.push(...old.values());
  return { updates, enters, exits };
}
