import { createComponent as c, themeRoot } from '@nominy/babel-extension-frontend';
themeRoot(document.body, '#0f766e');
document.body.classList.add('bui-page');
const shell = c('settings-shell');
shell.append(c('header', { children: [c('title', { text: 'Babel Review Grader' })] }),
  c('body', { children: [
    c('notice', { text: 'Requires Babel Review Helper. Reload both extensions after installing an update.' }),
    c('card', { children: [c('title', { text: 'Grade a review' }), c('hint', { text: 'Open the native feedback form on Babel, click Grade review, then Generate grades. Review the five proposed scores and apply them when ready.' })] }),
    c('card', { children: [c('title', { text: 'Your feedback stays yours' }), c('hint', { text: 'Applying grades changes only category ratings. Existing notes are preserved. The addon never submits the review.' })] }),
    c('hint', { text: 'Save an OpenRouter key in Review Helper. The backend address and key come from Review Helper settings. Grading compares the L1 original with the current reviewed transcript; it does not assess the audio. Transcript snapshots are sent to that backend only when you generate grades. Grades stay in this page and are discarded on navigation.' })
  ] }));
document.body.append(shell);
