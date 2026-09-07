import { GRADE_CATEGORIES, GRADE_PREFIXES, validGradeScores, type GradeScore } from '@nominy/babel-babel-runtime';

export function getWritableForm(doc: Document = document): HTMLElement | null {
  const first = doc.getElementById('wordAccuracy-1');
  let root = first?.parentElement ?? null;
  while (root && root !== doc.body) {
    if (GRADE_PREFIXES.every(prefix => root!.querySelector(`[id="${prefix}-1"]`))) {
      const notes = root.querySelectorAll<HTMLTextAreaElement>('textarea[placeholder="Provide specific feedback..."]');
      const radios = root.querySelectorAll<HTMLElement>('[role="radio"]');
      if (notes.length < 5 || [...notes].some(note => note.disabled || note.readOnly)
        || [...radios].some(radio => radio.hasAttribute('disabled') || radio.getAttribute('aria-disabled') === 'true')) return null;
      return root;
    }
    root = root.parentElement;
  }
  return null;
}

export async function applyGrades(grades: GradeScore[], stillCurrent: () => boolean, doc: Document = document): Promise<void> {
  if (!validGradeScores(grades)) throw new Error('All five grades must be between 1 and 3.');
  const root = getWritableForm(doc);
  if (!root || !stillCurrent()) throw new Error('Open the writable feedback form for this review first.');
  const targets = GRADE_CATEGORIES.map((category, index) => ({
    category, prefix: GRADE_PREFIXES[index], score: grades.find(grade => grade.category === category)!.score
  }));
  const selected = (target: typeof targets[number]) => {
    const radio = root.querySelector<HTMLElement>(`[id="${target.prefix}-${target.score}"]`);
    return radio?.getAttribute('aria-checked') === 'true' || radio?.dataset.state === 'checked';
  };
  // Read fresh controls after React commits; only ratings are touched, never comments or submit.
  for (let pass = 0; pass < 3; pass++) {
    for (const target of targets) {
      if (getWritableForm(doc) !== root || !root.isConnected || !stillCurrent()) throw new Error('The review changed while applying grades. Check the current form before retrying.');
      if (selected(target)) continue;
      const radio = root.querySelector<HTMLElement>(`[id="${target.prefix}-${target.score}"]`);
      if (!radio || radio.hasAttribute('disabled') || radio.getAttribute('aria-disabled') === 'true') throw new Error(`The ${target.category} rating is not writable.`);
      radio.click();
      await new Promise(resolve => setTimeout(resolve, 90));
    }
    await new Promise(resolve => setTimeout(resolve, 120));
    if (!stillCurrent() || getWritableForm(doc) !== root) throw new Error('The review changed while applying grades.');
    if (targets.every(selected)) return;
  }
  throw new Error('Some ratings did not stay selected. Check the form and retry.');
}
