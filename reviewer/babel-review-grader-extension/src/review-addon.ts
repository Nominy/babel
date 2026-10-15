import { GRADER_PROTOCOL } from '@nominy/babel-babel-runtime';
import { applyGrades, getWritableForm } from './form';
import { cancelHelperGrade, getSnapshot, requestHelper, sameSnapshot, validateResult, validateSnapshot } from './helper-client';
import type { GradingResult, Snapshot } from './types';

interface Run {
  id: string;
  route: string;
  requestId: string;
  snapshot: Snapshot;
  result?: GradingResult;
}

/** Magic Review prepares grades concurrently, then applies only the same live review. */
export function registerReviewAddon(): () => void {
  let run: Run | null = null;
  const cancel = () => {
    if (run) cancelHelperGrade(run.requestId);
    run = null;
  };
  const current = (expected: Run) => run === expected && window.location.href === expected.route && Boolean(getWritableForm());
  const assertCurrent = (expected: Run) => {
    if (!current(expected)) throw new Error('The review changed. Run Magic Review again.');
  };

  window.addEventListener('message', async event => {
    const message = event.data;
    if (event.source !== window || event.origin !== window.location.origin || message?.source !== GRADER_PROTOCOL
      || message.direction !== 'addon-request' || typeof message.requestId !== 'string' || message.requestId.length > 100) return;
    const reply = (payload: unknown) => window.postMessage({ source: GRADER_PROTOCOL, direction: 'addon-response', requestId: message.requestId, payload }, window.location.origin);
    try {
      if (message.operation === 'ping') { reply({ ok: true }); return; }
      if (message.operation === 'cancel') {
        if (run?.id === message.runId) cancel();
        reply({ ok: true }); return;
      }
      if (message.operation !== 'prepare' && message.operation !== 'apply') return;
      if (typeof message.runId !== 'string' || !message.runId) throw new Error('Missing Magic Review run identity.');
      validateSnapshot(message.input);
      if (!getWritableForm()) throw new Error('Open the writable feedback form for this review first.');
      if (message.operation === 'prepare') {
        cancel();
        const prepared: Run = { id: message.runId, route: window.location.href, requestId: crypto.randomUUID(), snapshot: message.input };
        run = prepared;
        const response = await requestHelper('grade', prepared.snapshot, prepared.requestId);
        assertCurrent(prepared);
        validateResult(response.result, prepared.snapshot);
        prepared.result = response.result;
      } else {
        const prepared = run;
        if (!prepared || prepared.id !== message.runId || !prepared.result || !sameSnapshot(prepared.snapshot, message.input)) {
          throw new Error('Prepared grades no longer match this review. Run Magic Review again.');
        }
        assertCurrent(prepared);
        const live = await getSnapshot();
        assertCurrent(prepared);
        if (!sameSnapshot(prepared.snapshot, live)) throw new Error('The transcript changed since grading. Run Magic Review again.');
        await applyGrades(prepared.result.grades, () => current(prepared));
        assertCurrent(prepared);
        run = null;
      }
      reply({ ok: true });
    } catch (error) {
      reply({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
  window.addEventListener('pagehide', cancel);
  return () => { if (run && !current(run)) cancel(); };
}
