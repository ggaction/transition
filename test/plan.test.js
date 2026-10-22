import test from 'node:test';import assert from 'node:assert/strict';
import {planTransition} from '../src/index.js';
import {stringInterpolator} from '../src/interpolate.js';
const n=(key,type='circle',topology='')=>({key,type,topology,svg:'<circle/>',offset:[0,0],clip:[0,0,100,100]});
const s=nodes=>({version:1,width:100,height:100,definitions:'',nodes});
test('matches opaque identity, not draw order',()=>{const p=planTransition(s([n('a'),n('b')]),s([n('b'),n('c')]));assert.equal(p.updates[0].key,'b');assert.equal(p.enters[0].key,'c');assert.equal(p.exits[0].key,'a');});
test('changed topology and primitive type crossfade rather than mispair',()=>{const p=planTransition(s([n('a','path','old'),n('b')]),s([n('a','path','new'),n('b','rect')]));assert.equal(p.updates.length,0);assert.equal(p.enters.length,2);assert.equal(p.exits.length,2);});
test('version and duplicate key validation',()=>{assert.throws(()=>planTransition({...s([]),version:2},s([])));assert.throws(()=>planTransition(s([n('a'),n('a')]),s([])));});
test('compatible paths interpolate; command and arc flags do not invent topology',()=>{assert.equal(stringInterpolator('M0 0 L10 20','M0 10 L20 30')(.5),'M0 5 L15 25');assert.equal(stringInterpolator('M0 0 L1 2','M0 0 C1 2 3 4 5 6'),null);assert.equal(stringInterpolator('M0 0 A1 1 0 0 1 2 3','M0 0 A1 1 0 1 1 2 3'),null);});
