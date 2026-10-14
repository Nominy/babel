import { GRADER_PROTOCOL } from '@nominy/babel-babel-runtime';
import { gradingSnapshotKey, validGradeScores } from '@nominy/babel-babel-runtime';
import type { GradingResult, Snapshot } from './types';

export function requestHelper(operation: 'ping' | 'snapshot' | 'grade', input?: unknown, id?: string): Promise<{ snapshot?: Snapshot; result?: GradingResult; ok?: boolean; error?: string }> {
  return new Promise((resolve, reject) => {
    const requestId = id || crypto.randomUUID();
    const origin = window.location.origin;
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', listener); };
    const listener = (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== window || event.origin !== origin || data?.source !== GRADER_PROTOCOL
        || data.direction !== 'response' || data.requestId !== requestId) return;
      cleanup();
      if (data.payload?.ok !== true) reject(new Error(data.payload?.error || 'Review Helper could not prepare this review.'));
      else resolve(data.payload);
    };
    const timer = window.setTimeout(() => {
      cleanup(); reject(new Error(operation === 'ping'
        ? 'Install or reload the updated Babel Review Helper, then refresh this page.'
        : 'Review Helper timed out while reading the current review. Try again.'));
    }, operation === 'ping' ? 1500 : operation === 'grade' ? 185000 : 45000);
    window.addEventListener('message', listener);
    window.postMessage({ source: GRADER_PROTOCOL, direction: 'request', requestId, operation, input }, origin);
  });
}

export function validateSnapshot(snapshot: Snapshot | undefined): asserts snapshot is Snapshot {
  if (!snapshot?.reviewActionId || !Array.isArray(snapshot.original?.annotations)
    || !Array.isArray(snapshot.current?.annotations) || !snapshot.original.annotations.length
    || !snapshot.current.annotations.length || snapshot.current.actionId !== snapshot.reviewActionId
    || snapshot.original.actionId === snapshot.current.actionId || snapshot.original.actionLevel !== 1
    || snapshot.current.actionLevel <= 1) throw new Error('Review Helper did not return a complete L1/current transcript pair.');
}

export function validateResult(result: GradingResult | undefined, snapshot: Snapshot): asserts result is GradingResult {
  if (!result || !validGradeScores(result.grades) || result.reviewActionId !== snapshot.reviewActionId
    || result.originalActionId !== snapshot.original.actionId) throw new Error('Grades belong to a different review or are incomplete.');
}

export function sameSnapshot(expected: Snapshot, current: Snapshot): boolean {
  return expected.reviewActionId === current.reviewActionId
    && gradingSnapshotKey(expected.original, expected.current) === gradingSnapshotKey(current.original, current.current);
}

export async function getSnapshot(): Promise<Snapshot> {
  const { snapshot } = await requestHelper('snapshot');
  validateSnapshot(snapshot);
  return snapshot;
}

export function cancelHelperGrade(gradeRequestId: string) { window.postMessage({ source: GRADER_PROTOCOL, direction: 'request', requestId: crypto.randomUUID(), operation: 'cancel-grade', gradeRequestId }, location.origin); }
