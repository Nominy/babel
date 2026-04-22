// ==UserScript==
// @name         Babel Review Exporter
// @namespace    https://dashboard.babel.audio/
// @version      0.1.0
// @description  Export review category ratings/comments from Babel page into JSON.
// @author       You
// @match        https://dashboard.babel.audio/*
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    const CATEGORY_DEFINITIONS = [
        {
            category: 'Word Accuracy',
            description: 'Accuracy of transcribed words and phrases',
        },
        {
            category: 'Timestamp Accuracy',
            description: 'Precision of segment start/end times',
        },
        {
            category: 'Punctuation & Formatting',
            description: 'Correct use of punctuation and text formatting',
        },
        {
            category: 'Tags & Emphasis',
            description: 'Proper use of speaker tags and emphasis markers',
        },
        {
            category: 'Segmentation',
            description: 'Appropriate segment breaks and grouping',
        },
    ];

    function text(el) {
        return (el?.textContent || '').trim();
    }

    function value(el) {
        return (el?.value || '').trim();
    }

    function normalize(s) {
        return (s || '').trim().toLowerCase();
    }

    function findRating(card) {
        if (!card) return null;
        const checkedButton = card.querySelector('button[role="radio"][aria-checked="true"]');
        if (checkedButton) {
            const v = Number(checkedButton.getAttribute('value'));
            return Number.isFinite(v) ? v : null;
        }
        const checkedInput = card.querySelector('input[type="radio"]:checked');
        if (checkedInput) {
            const v = Number(checkedInput.value);
            return Number.isFinite(v) ? v : null;
        }
        return null;
    }

    function isAdditionalTextarea(area) {
        const ph = normalize(area.getAttribute('placeholder'));
        if (ph.includes('additional')) return true;
        const card = area?.closest('div');
        const heading = normalize(text(card?.querySelector('h4')));
        return heading.includes('other feedback') || heading.includes('additional');
    }

    function findDescriptionElement(descriptionText) {
        const target = normalize(descriptionText);
        const ps = Array.from(document.querySelectorAll('p'));
        for (const p of ps) {
            if (normalize(text(p)) === target) return p;
        }
        return null;
    }

    function getCardFromDescriptionElement(descriptionElement) {
        // Requested approach: description <p> -> 2 parents up.
        const twoUp = descriptionElement?.parentElement?.parentElement;
        if (twoUp) return twoUp;
        return null;
    }

    function findCategoryTextarea(card) {
        if (!card) return null;
        const areas = Array.from(card.querySelectorAll('textarea')).filter((ta) => !isAdditionalTextarea(ta));
        if (!areas.length) return null;
        return areas[0];
    }

    function extractCategories() {
        return CATEGORY_DEFINITIONS.map((def) => {
            const descEl = findDescriptionElement(def.description);
            const card = getCardFromDescriptionElement(descEl);
            const textarea = findCategoryTextarea(card);
            return {
                category: def.category,
                description: def.description,
                rating: findRating(card),
                comment: value(textarea || null),
            };
        }).filter((item) => item.rating !== null || item.comment.length > 0);
    }

    function extractAdditionalFeedback() {
        const all = Array.from(document.querySelectorAll('textarea'));
        const area = all.find((ta) => isAdditionalTextarea(ta));
        return value(area);
    }

    function buildPayload() {
        const categories = extractCategories();
        const additionalFeedback = extractAdditionalFeedback();
        const sourceUrl = location.href;
        const pageTitle = document.title;

        return {
            exportedAt: new Date().toISOString(),
            sourceUrl,
            pageTitle,
            summary: {
                textareaCount: document.querySelectorAll('textarea').length,
                categoryCount: categories.length,
                hasAdditionalFeedback: additionalFeedback.length > 0,
            },
            categories,
            additionalFeedback,
        };
    }

    function showToast(message, isError = false) {
        const el = document.createElement('div');
        el.textContent = message;
        el.style.position = 'fixed';
        el.style.left = '20px';
        el.style.bottom = '20px';
        el.style.zIndex = '2147483647';
        el.style.padding = '10px 12px';
        el.style.borderRadius = '10px';
        el.style.font = '12px/1.4 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        el.style.color = '#ffffff';
        el.style.background = isError ? '#b91c1c' : '#166534';
        el.style.boxShadow = '0 8px 30px rgba(0,0,0,.25)';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    async function copyToClipboard(raw) {
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(raw, 'text');
            return;
        }
        await navigator.clipboard.writeText(raw);
    }

    function downloadJson(raw) {
        const blob = new Blob([raw], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const now = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `babel-review-export-${now}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async function onExport() {
        try {
            const payload = buildPayload();
            if (!payload.categories.length) {
                showToast('No categories found. Open console: window.exportBabelReviews(true)', true);
                return;
            }

            const raw = JSON.stringify(payload, null, 2);
            await copyToClipboard(raw);
            downloadJson(raw);
            showToast(`Exported ${payload.categories.length} categories.`);
            console.log('[Babel Review Exporter] JSON copied + downloaded:', payload);
        } catch (err) {
            console.error('[Babel Review Exporter] Export failed', err);
            showToast(`Export failed: ${err?.message || String(err)}`, true);
        }
    }

    function debugExport(logToConsole) {
        const payload = buildPayload();
        if (logToConsole) {
            console.log('[Babel Review Exporter][debug] payload:', payload);
            console.log('[Babel Review Exporter][debug] textareas:', Array.from(document.querySelectorAll('textarea')).map((ta) => ({
                placeholder: ta.getAttribute('placeholder'),
                valueLen: value(ta).length,
            })));
        }
        return payload;
    }

    function injectButton() {
        if (document.getElementById('babel-review-export-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'babel-review-export-btn';
        btn.type = 'button';
        btn.textContent = 'Export Reviews JSON';
        btn.style.position = 'fixed';
        btn.style.left = '16px';
        btn.style.top = '50%';
        btn.style.transform = 'translateY(-50%)';
        btn.style.zIndex = '2147483647';
        btn.style.border = '1px solid #1f2937';
        btn.style.background = '#111827';
        btn.style.color = '#fff';
        btn.style.padding = '10px 12px';
        btn.style.borderRadius = '10px';
        btn.style.cursor = 'pointer';
        btn.style.font = '12px/1.2 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        btn.style.boxShadow = '0 8px 20px rgba(0,0,0,.2)';
        btn.addEventListener('click', onExport);

        document.body.appendChild(btn);
    }

    window.exportBabelReviews = function (debug) {
        return debugExport(Boolean(debug));
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectButton, { once: true });
    } else {
        injectButton();
    }
})();
