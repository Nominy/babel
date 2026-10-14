import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { GRADE_CATEGORIES, GRADE_PREFIXES, GRADER_PROTOCOL } from '@nominy/babel-babel-runtime';
import { getSnapshot, requestHelper, sameSnapshot, validateResult } from '../src/helper-client';
import { registerReviewAddon } from '../src/review-addon';
import type { Snapshot } from '../src/types';

Object.assign(globalThis, {
  __BUILD_FLAVOR__: 'dev', __DEFAULT_BACKEND_BASE_URL__: 'http://127.0.0.1:3001',
  __DEFAULT_BACKEND_BASE_URL_FALLBACKS__: [], __ALLOW_BACKEND_OVERRIDES__: true, __ENABLE_SUBMIT_ANALYTICS__: false
});
// The extension's build-time constants must exist before loading its entry dependency.
const { registerGraderAddon } = await import('../../review-interceptor-extension/src/services/grader-addon-service');

function setup(t: TestContext, installHelper = true) {
  const dom = new JSDOM('<!doctype html><body><section id="feedback"></section></body>', { url: 'https://dashboard.babel.audio/review?reviewActionId=current' });
  const win = dom.window;
  const previous = new Map(['window', 'document', 'location', 'chrome', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const root = win.document.getElementById('feedback')!;
  for (const prefix of GRADE_PREFIXES) {
    const card = win.document.createElement('div');
    const note = win.document.createElement('textarea'); note.placeholder = 'Provide specific feedback...'; note.value = `Keep ${prefix}`; card.append(note);
    for (const score of [1, 2, 3]) {
      const radio = win.document.createElement('button'); radio.id = `${prefix}-${score}`; radio.setAttribute('role', 'radio'); radio.setAttribute('aria-checked', String(score === 1));
      radio.addEventListener('click', () => { for (const item of card.querySelectorAll('[role="radio"]')) item.setAttribute('aria-checked', String(item === radio)); });
      card.append(radio);
    }
    root.append(card);
  }
  win.postMessage = ((data: unknown, origin: string) => {
    assert.equal(origin, win.location.origin);
    queueMicrotask(() => win.dispatchEvent(new win.MessageEvent('message', { data, source: win, origin })));
  }) as typeof win.postMessage;
  const annotation = { id: 'turn', content: 'Native edited text', processedRecordingId: 'track', startTimeInSeconds: 0, endTimeInSeconds: 1 };
  const snapshot: Snapshot = { reviewActionId: 'current', original: { actionId: 'original', actionLevel: 1, recordings: [], annotations: [{ ...annotation, content: 'Original text' }] }, current: { actionId: 'current', actionLevel: 2, recordings: [], annotations: [annotation] } };
  const state = { snapshot, fail: false, calls: [] as Array<{ url: string; body: unknown; key: string | null }> };
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: win }, document: { configurable: true, value: win.document }, location: { configurable: true, value: win.location },
    chrome: { configurable: true, value: { storage: { local: { get: async () => ({ 'babel-review-openrouter-key-v1': 'sk-or-unit-test' }) } } } },
    fetch: { configurable: true, value: async (url: string, options: RequestInit) => {
      state.calls.push({ url, body: JSON.parse(options.body as string), key: new Headers(options.headers).get('X-OpenRouter-Key') });
      if (state.fail) return new Response(JSON.stringify({ error: 'Not deployed' }), { status: 404 });
      return new Response(JSON.stringify({ reviewActionId: 'current', originalActionId: 'original', grades: GRADE_CATEGORIES.map((category, i) => ({ category, score: i % 3 + 1, note: 'Evidence', evidence: { samples: [], count: 0 } })) }));
    } }
  });
  t.after(() => {
    dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  });
  const helper = installHelper ? registerGraderAddon(async () => structuredClone(state.snapshot) as never) : null;
  return { state, root, win, helper };
}

test('coinstalled Helper answers ping/snapshot and authenticates the grading request', async t => {
  const { state } = setup(t);
  assert.equal((await requestHelper('ping')).ok, true);
  const snapshot = await getSnapshot();
  assert.ok(sameSnapshot(snapshot, state.snapshot));
  const response = await requestHelper('grade', snapshot);
  validateResult(response.result, snapshot);
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].url, 'http://127.0.0.1:3001/api/review/grade');
  assert.equal(state.calls[0].key, 'sk-or-unit-test');
  assert.deepEqual(state.calls[0].body, snapshot);
});

test('Magic Review addon prepares grades without mutations then applies while preserving notes', async t => {
  const { state, helper, root } = setup(t);
  registerReviewAddon();
  assert.equal(await helper!.available(), true);
  await helper!.prepare('run-1', state.snapshot as never);
  assert.equal(root.querySelectorAll('[aria-checked="true"][id$="-1"]').length, 5);
  const notes = [...root.querySelectorAll('textarea')].map(note => note.value);
  await helper!.apply('run-1', state.snapshot as never);
  for (const [index, prefix] of GRADE_PREFIXES.entries()) assert.equal(root.querySelector(`[id="${prefix}-${index % 3 + 1}"]`)?.getAttribute('aria-checked'), 'true');
  assert.deepEqual([...root.querySelectorAll('textarea')].map(note => note.value), notes);
});

test('prepared grades reject native transcript changes and cancelled runs before any rating mutation', async t => {
  const { state, helper, root } = setup(t);
  registerReviewAddon();
  const initial = structuredClone(state.snapshot);
  await helper!.prepare('run-1', initial as never);
  state.snapshot.current.annotations[0].content = 'Changed after generation';
  await assert.rejects(helper!.apply('run-1', initial as never), /transcript changed/);
  assert.equal(root.querySelectorAll('[aria-checked="true"][id$="-1"]').length, 5);
  helper!.cancel('run-1');
  await assert.rejects(helper!.apply('run-1', initial as never), /no longer match/);
});

test('addon route changes invalidate prepared grades even when feedback DOM is reused', async t => {
  const { state, helper, win } = setup(t);
  const ensure = registerReviewAddon();
  await helper!.prepare('run-1', state.snapshot as never);
  win.history.pushState({}, '', '?reviewActionId=next');
  ensure();
  await assert.rejects(helper!.apply('run-1', state.snapshot as never), /no longer match/);
});

test('backend dependency failures surface through the real coinstalled protocol', async t => {
  const { state } = setup(t); state.fail = true;
  await assert.rejects(requestHelper('grade', state.snapshot), /does not support Review Grader yet/);
});

test('snapshot dependency errors do not masquerade as a missing Helper', async t => {
  const { state } = setup(t); state.snapshot.original.actionLevel = 0;
  assert.equal((await requestHelper('ping')).ok, true);
  await assert.rejects(getSnapshot(), /complete L1\/current/);
});

test('missing Helper reports installation guidance without a grading request', async t => {
  const { state, win } = setup(t, false);
  const timeout = win.setTimeout.bind(win);
  win.setTimeout = ((handler: TimerHandler, ms?: number) => timeout(handler, ms === 1500 ? 1 : ms)) as typeof win.setTimeout;
  await assert.rejects(requestHelper('ping'), /Install or reload/);
  assert.equal(state.calls.length, 0);
});

test('responses from another origin cannot resolve a Helper request', async t => {
  const { win } = setup(t, false);
  const original = win.postMessage;
  win.postMessage = ((data: { requestId: string }) => {
    win.dispatchEvent(new win.MessageEvent('message', { source: win, origin: 'https://untrusted.example', data: { source: GRADER_PROTOCOL, direction: 'response', requestId: data.requestId, payload: { ok: true } } }));
    original.call(win, { source: GRADER_PROTOCOL, direction: 'response', requestId: data.requestId, payload: { ok: false, error: 'Trusted response' } }, win.location.origin);
  }) as typeof win.postMessage;
  await assert.rejects(requestHelper('ping'), /Trusted response/);
});
