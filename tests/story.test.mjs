import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const code=ts.transpileModule(readFileSync(new URL('../app/story-content.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {storyTimeline}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

test('story remains bounded during fast scroll jumps and has readable endpoints', () => {
  assert.deepEqual(storyTimeline(-20), {motion:0,chapter:0});
  assert.deepEqual(storyTimeline(20), {motion:1,chapter:2});
  assert.equal(storyTimeline(.1).motion, 0);
  assert.equal(storyTimeline(.95).motion, 1);
});

test('scroll motion stays continuous at every hold boundary', () => {
  for (const boundary of [.12,.44,.56,.88]) {
    assert.ok(Math.abs(storyTimeline(boundary-1e-6).motion-storyTimeline(boundary+1e-6).motion)<1e-6);
  }
});

test('forward and reverse scrolling follow the same monotonic visual path', () => {
  const values = Array.from({length:1001},(_,i)=>storyTimeline(i/1000));
  for(let i=1;i<values.length;i++) {
    assert.ok(values[i].motion>=values[i-1].motion);
    assert.ok(values[i].chapter>=values[i-1].chapter);
  }
  const reversed = Array.from({length:1001},(_,i)=>storyTimeline((1000-i)/1000));
  assert.deepEqual(reversed, [...values].reverse());
});
