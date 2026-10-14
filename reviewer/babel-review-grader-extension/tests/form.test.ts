import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { GRADE_CATEGORIES, GRADE_PREFIXES, gradingSnapshotKey } from '@nominy/babel-babel-runtime';
import { applyGrades, getWritableForm } from '../src/form';

function fixture() {
  const dom = new JSDOM('<!doctype html><body><section id="feedback"></section></body>');
  const doc = dom.window.document;
  const root = doc.getElementById('feedback')!;
  for (const prefix of GRADE_PREFIXES) {
    const card = doc.createElement('div');
    const note = doc.createElement('textarea'); note.placeholder = 'Provide specific feedback...'; note.value = `Keep ${prefix} note`;
    card.append(note);
    for (const score of [1, 2, 3]) {
      const radio = doc.createElement('button'); radio.id = `${prefix}-${score}`; radio.setAttribute('role', 'radio');
      radio.setAttribute('aria-checked', String(score === 1));
      radio.addEventListener('click', () => { for (const sibling of card.querySelectorAll('[role="radio"]')) sibling.setAttribute('aria-checked', String(sibling === radio)); });
      card.append(radio);
    }
    root.append(card);
  }
  return { doc, root };
}
const grades = GRADE_CATEGORIES.map((category, i) => ({ category, score: (i % 3 + 1) as 1 | 2 | 3 }));
test('applies all five grades without modifying feedback notes', async () => {
  const { doc, root } = fixture();
  const before = [...root.querySelectorAll('textarea')].map(note => note.value);
  await applyGrades(grades, () => true, doc);
  for (const [i, grade] of grades.entries()) assert.equal(doc.getElementById(`${GRADE_PREFIXES[i]}-${grade.score}`)?.getAttribute('aria-checked'), 'true');
  assert.deepEqual([...root.querySelectorAll('textarea')].map(note => note.value), before);
});
test('read-only form is rejected before any ratings change', async () => {
  const { doc, root } = fixture();
  root.querySelector('textarea')!.readOnly = true;
  assert.equal(getWritableForm(doc), null);
  await assert.rejects(applyGrades(grades, () => true, doc), /writable/);
  assert.equal(root.querySelectorAll('[aria-checked="true"]').length, 5);
});
test('task switch interrupts application rather than touching the next form', async () => {
  const { doc } = fixture();
  let sameTask = true;
  doc.getElementById('timestampAccuracy-2')!.addEventListener('click', () => { sameTask = false; });
  await assert.rejects(applyGrades(grades, () => sameTask, doc), /changed/);
  assert.equal(doc.getElementById('punctuationFormatting-1')?.getAttribute('aria-checked'), 'true');
});
test('incomplete grades are not partially applied', async () => {
  const { doc } = fixture();
  await assert.rejects(applyGrades(grades.slice(1), () => true, doc), /five/);
});
test('snapshot identity ignores capture time but includes transcript changes', () => {
  const state = { actionId: 'a', actionLevel: 1, annotations: [{ id: 's', content: 'Hello', processedRecordingId: 'track', startTimeInSeconds: 0, endTimeInSeconds: 1 }] };
  const refreshed = { ...state, capturedAt: 'later' };
  assert.equal(gradingSnapshotKey(state, state), gradingSnapshotKey(refreshed, refreshed));
  const changed = { ...state, annotations: [{ ...state.annotations[0], content: 'Changed' }] };
  assert.notEqual(gradingSnapshotKey(state, state), gradingSnapshotKey(state, changed));
});

test('disabled fieldset inherited state is not mistaken for a writable feedback form', async () => {
  const { doc, root } = fixture();
  const fieldset = doc.createElement('fieldset');
  root.before(fieldset); fieldset.append(root); fieldset.disabled = true;
  assert.equal(getWritableForm(doc), null);
  await assert.rejects(applyGrades(grades, () => true, doc), /writable/);
  assert.equal(root.querySelectorAll('[aria-checked="true"][id$="-1"]').length, 5);
});

test('a remounted feedback form interrupts application rather than applying to replacement controls', async () => {
  const { doc, root } = fixture();
  doc.getElementById('timestampAccuracy-2')!.addEventListener('click', () => root.replaceWith(root.cloneNode(true)));
  await assert.rejects(applyGrades(grades, () => true, doc), /changed/);
  assert.equal(doc.getElementById('punctuationFormatting-1')?.getAttribute('aria-checked'), 'true');
});

test('duplicate grade categories are rejected before any click', async () => {
  const { doc, root } = fixture();
  await assert.rejects(applyGrades([...grades.slice(0, 4), grades[0]], () => true, doc), /five/);
  assert.equal(root.querySelectorAll('[aria-checked="true"][id$="-1"]').length, 5);
});

test('snapshot identity includes track and time edits but not rating notes', () => {
  const state = { actionId: 'a', actionLevel: 2, annotations: [{ id: 's', content: 'Hello', processedRecordingId: 'track', startTimeInSeconds: 0, endTimeInSeconds: 1 }] };
  for (const update of [{ processedRecordingId: 'other' }, { startTimeInSeconds: 0.5 }, { endTimeInSeconds: 2 }]) {
    const changed = { ...state, annotations: [{ ...state.annotations[0], ...update }] };
    assert.notEqual(gradingSnapshotKey(state, state), gradingSnapshotKey(state, changed));
  }
});
