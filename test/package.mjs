import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'ggaction-transition-consumer-'));
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { cwd: root, encoding: 'utf8' }))[0];
  const names = new Set(packed.files.map(file => file.path));
  for (const name of ['src/index.js', 'src/index.d.ts', 'README.md', 'LICENSE', 'docs/api.md']) assert.ok(names.has(name), `Missing package file: ${name}`);
  assert.ok([...names].every(name => /^(?:src\/|docs\/api\.md$|README\.md$|LICENSE$|package\.json$)/.test(name)), 'Package contains unintended files');
  const consumer = join(temporary, 'consumer'); await mkdir(consumer);
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', join(temporary, packed.filename)], { cwd: consumer, stdio: 'pipe' });
  const installed = join(consumer, 'node_modules/@ggaction/transition');
  const pkg = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert.equal(pkg.license, 'MIT');
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
  // Resolve the package by its public name from the consumer, including exports.
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import * as api from '@ggaction/transition';
    for (const name of ['planTransition', 'createTransitionPlayer', 'createCanvasTransitionPlayer']) assert.equal(typeof api[name], 'function', name);
    const scene = { version: 1, width: 100, height: 100, definitions: '', nodes: [] };
    assert.deepEqual(api.planTransition(scene, scene), { updates: [], enters: [], exits: [] });
  `], { cwd: consumer, stdio: 'pipe' });
  const declarations = await readFile(join(installed, pkg.exports['.'].types), 'utf8');
  assert.match(declarations, /createCanvasTransitionPlayer/);
  assert.match(await readFile(join(installed, 'LICENSE'), 'utf8'), /MIT License/);
  console.log(`PASS: packed ${packed.filename}; installed isolated consumer; imports, planner, declarations, license and file allowlist verified.`);
} finally { await rm(temporary, { recursive: true, force: true }); }
