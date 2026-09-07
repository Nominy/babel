import { cancelHelperGrade } from './helper-client';
import { createComponent as c, themeRoot } from '@nominy/babel-extension-frontend';
import { registerDomLifecycle, gradingSnapshotKey, validGradeScores, GRADE_CATEGORIES } from '@nominy/babel-babel-runtime';
import { getSnapshot, requestHelper } from './helper-client';
import { applyGrades, getWritableForm } from './form';
import type { Grade, GradingResult, Snapshot } from './types';

const ACCENT = '#0f766e';
let dialog: HTMLDialogElement | null = null;
let activeRequest = '';
let revision = 0;
let route = window.location.href;
let busy = false;
let result: GradingResult | null = null;
let snapshot: Snapshot | null = null;
let status: HTMLElement;
let cards: HTMLElement;
let progress: HTMLElement;
let generate: HTMLButtonElement;
let apply: HTMLButtonElement;

function message(text: string, error = false) {
  status.textContent = text;
  status.dataset.tone = error ? 'danger' : '';
  status.style.color = error ? 'var(--bui-danger)' : '';
}
function setBusy(value: boolean) {
  busy = value; progress.hidden = !value;
  generate.disabled = value; apply.disabled = value || !result;
  for (const select of cards.querySelectorAll<HTMLSelectElement>('select')) select.disabled = value;
}
function cancel() {
  revision++;
  if (activeRequest) cancelHelperGrade(activeRequest);
  activeRequest = '';
  busy = false;
}
function close() { cancel(); dialog?.close(); dialog?.remove(); dialog = null; result = null; snapshot = null; }

function renderGrades(grades: Grade[]) {
  cards.replaceChildren();
  for (const category of GRADE_CATEGORIES) {
    const grade = grades.find(item => item.category === category)!;
    const card = c('card');
    const label = c('label', { text: category });
    const select = c('select', { attrs: { 'aria-label': `${category} grade` } }) as HTMLSelectElement;
    for (const [value, text] of [['1', '1 · Isolated or no issues'], ['2', '2 · Repeated issues'], ['3', '3 · Systemic issues']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    }
    select.value = String(grade.score);
    select.addEventListener('change', () => { grade.score = Number(select.value) as 1 | 2 | 3; });
    label.append(select);
    card.append(label, c('hint', { text: grade.note }));
    if (grade.evidence?.samples?.length) {
      const details = c('details');
      details.append(c('summary', { text: `Evidence · ${grade.evidence.count} correction${grade.evidence.count === 1 ? '' : 's'}` }));
      for (const sample of grade.evidence.samples) {
        const evidence = c('body');
        evidence.append(c('hint', { text: sample.note }));
        if (sample.before !== undefined) evidence.append(c('diff-text', { text: `Original: ${sample.before}` }));
        if (sample.after !== undefined) evidence.append(c('diff-text', { text: `Reviewed: ${sample.after}` }));
        details.append(evidence);
      }
      card.append(details);
    }
    cards.append(card);
  }
}

async function generateGrades() {
  if (busy) return;
  const currentRevision = ++revision;
  const currentRoute = window.location.href;
  result = null; snapshot = null; cards.replaceChildren(); setBusy(true);
  message('Reading the original and current transcript…');
  try {
    await requestHelper('ping');
    const captured = await getSnapshot();
    if (revision !== currentRevision || window.location.href !== currentRoute || !dialog?.open) return;
    snapshot = captured;
    message('Generating five category grades…');
    activeRequest = crypto.randomUUID();
    const response = await requestHelper('grade', { reviewActionId: captured.reviewActionId, original: captured.original, current: captured.current }, activeRequest);
    if (revision !== currentRevision || window.location.href !== currentRoute || !dialog?.open) return;
    if (!response?.ok) throw new Error(response?.error || 'The grader did not return a result.');
    if (!validGradeScores(response.result?.grades) || response.result.reviewActionId !== captured.reviewActionId
      || response.result.originalActionId !== captured.original.actionId) throw new Error('Grades belong to a different review or are incomplete.');
    result = response.result;
    renderGrades(result!.grades);
    message('Review the suggested grades. You can adjust any score before applying.');
    generate.textContent = 'Regenerate';
  } catch (error) {
    if (revision === currentRevision && dialog?.open) message(error instanceof Error ? error.message : String(error), true);
  } finally {
    if (revision === currentRevision && dialog?.open) { activeRequest = ''; setBusy(false); }
  }
}

async function applyResult() {
  if (busy || !result || !snapshot) return;
  const currentRevision = ++revision;
  const originalKey = gradingSnapshotKey(snapshot.original, snapshot.current);
  const currentRoute = window.location.href;
  const expectedAction = snapshot.reviewActionId;
  const grades = result.grades.map(({ category, score }) => ({ category, score }));
  setBusy(true); message('Checking that this review has not changed…');
  try {
    const current = await getSnapshot();
    if (revision !== currentRevision || !dialog?.open) return;
    if (currentRoute !== window.location.href || current.reviewActionId !== expectedAction
      || gradingSnapshotKey(current.original, current.current) !== originalKey) {
      result = null; snapshot = null; cards.replaceChildren();
      throw new Error('The transcript changed since grading. Generate new grades before applying.');
    }
    await applyGrades(grades, () => revision === currentRevision && window.location.href === currentRoute);
    if (revision !== currentRevision || !dialog?.open) return;
    result = null;
    message('Grades applied. Your feedback notes are unchanged. Review and submit in Babel when ready.');
  } catch (error) {
    if (revision === currentRevision && dialog?.open) message(error instanceof Error ? error.message : String(error), true);
  } finally { if (revision === currentRevision && dialog?.open) setBusy(false); }
}

function open() {
  if (dialog?.open) return;
  result = null; snapshot = null;
  dialog = c('dialog', { tag: 'dialog' }) as HTMLDialogElement;
  themeRoot(dialog, ACCENT);
  dialog.id = 'babel-review-grader-dialog';
  dialog.setAttribute('aria-labelledby', 'babel-review-grader-title');
  dialog.style.width = 'min(560px, calc(100vw - 32px))';
  dialog.style.maxHeight = 'calc(100vh - 32px)';
  dialog.style.overflow = 'auto';
  const title = c('title', { text: 'Babel Review Grader', attrs: { id: 'babel-review-grader-title' } });
  const closeButton = c('button', { text: 'Close' }); closeButton.addEventListener('click', close);
  status = c('status', { text: 'Generate grades from the changes between the original and reviewed transcript. 1 is best; 3 indicates systemic issues.', attrs: { role: 'status', 'aria-live': 'polite' } });
  progress = c('progress', { attrs: { 'data-indeterminate': 'true', 'aria-label': 'Working' }, children: [c('progress-fill')] });
  progress.hidden = true;
  cards = c('stack');
  generate = c('button', { text: 'Generate grades', variant: 'primary' }) as HTMLButtonElement;
  apply = c('button', { text: 'Apply grades', variant: 'primary' }) as HTMLButtonElement;
  generate.addEventListener('click', () => void generateGrades()); apply.addEventListener('click', () => void applyResult());
  apply.disabled = true;
  dialog.append(c('header', { children: [title, closeButton] }), c('body', { children: [status, progress, cards] }),
    c('footer', { children: [generate, apply] }));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  document.body.append(dialog); dialog.showModal(); generate.focus();
}

function ensure() {
  if (route !== window.location.href) { route = window.location.href; close(); }
  const form = getWritableForm();
  const existing = document.getElementById('babel-review-grader-button');
  if (!form || !form.getClientRects().length) { existing?.remove(); if (dialog?.open) close(); return; }
  if (existing && form.contains(existing)) return;
  existing?.remove();
  const button = c('button', { text: 'Grade review', variant: 'soft', accent: ACCENT,
    attrs: { id: 'babel-review-grader-button', title: 'Grade this review with Babel Review Helper' } });
  button.style.margin = '4px 8px'; button.addEventListener('click', open);
  const helper = form.querySelector('#babel-review-magic-button');
  if (helper) helper.after(button); else form.prepend(button);
}

registerDomLifecycle(ensure);
ensure();
