(function () {
  "use strict";

  class HttpStatusError extends Error {
    constructor(message, status) {
      super(message);
      this.name = "HttpStatusError";
      this.status = status;
    }
  }

  const els = {
    status: document.getElementById("status"),
    backendUrl: document.getElementById("backendUrl"),
    reviewActionId: document.getElementById("reviewActionId"),
    historyUsername: document.getElementById("historyUsername"),
    historyPassword: document.getElementById("historyPassword"),
    historySearch: document.getElementById("historySearch"),
    historyEventType: document.getElementById("historyEventType"),
    historyList: document.getElementById("historyList"),
    historyRefreshBtn: document.getElementById("historyRefreshBtn"),
    originalFile: document.getElementById("originalFile"),
    currentFile: document.getElementById("currentFile"),
    originalInput: document.getElementById("originalInput"),
    currentInput: document.getElementById("currentInput"),
    demoBtn: document.getElementById("demoBtn"),
    prepareBtn: document.getElementById("prepareBtn"),
    generateBtn: document.getElementById("generateBtn"),
    contextMeta: document.getElementById("contextMeta"),
    metricGrid: document.getElementById("metricGrid"),
    feedbackCards: document.getElementById("feedbackCards"),
    changeListSummary: document.getElementById("changeListSummary"),
    changeListCards: document.getElementById("changeListCards"),
    segmentationSummary: document.getElementById("segmentationSummary"),
    segmentationEvents: document.getElementById("segmentationEvents"),
    segmentLanes: document.getElementById("segmentLanes"),
    textDiffRows: document.getElementById("textDiffRows"),
    promptOut: document.getElementById("promptOut"),
    metricsDump: document.getElementById("metricsDump"),
    rawOut: document.getElementById("rawOut")
  };

  const appState = {
    historyItems: [],
    selectedHistoryId: "",
    latestPayload: null,
    latestPrepared: null,
    latestLlm: null,
    latestContext: null,
    original: null,
    current: null
  };

  function setStatus(message, isError) {
    els.status.textContent = message;
    els.status.style.color = isError ? "#a33f2f" : "";
  }

  function cleanBaseUrl(url) {
    return String(url || "").trim().replace(/\/+$/, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : "-";
  }

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeWhitespace(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function uniq(values) {
    const out = [];
    for (const item of values || []) {
      if (!out.includes(item)) {
        out.push(item);
      }
    }
    return out;
  }

  // ── Change Extractor (client-side port of change-extractor.ts) ──

  function escapeQuotesForChange(text) {
    return String(text || "").replace(/"/g, '\\"');
  }

  function formatTextChange(before, after) {
    return '"' + escapeQuotesForChange(before) + '" \u2192 "' + escapeQuotesForChange(after) + '"';
  }

  function extractTextChanges(packet) {
    var changes = [];
    var evidence = packet && packet.localTextEvidence ? packet.localTextEvidence : null;
    if (!evidence || !Array.isArray(evidence.changedPairs)) return changes;

    for (var i = 0; i < evidence.changedPairs.length; i++) {
      var pair = evidence.changedPairs[i];
      var hasTagDelta = pair.beforeTagCount !== pair.afterTagCount;

      changes.push({
        index: 0,
        type: "TEXT",
        description: formatTextChange(pair.before, pair.after)
      });

      if (hasTagDelta) {
        var direction = pair.afterTagCount > pair.beforeTagCount ? "added" : "removed";
        var delta = Math.abs(pair.afterTagCount - pair.beforeTagCount);
        changes.push({
          index: 0,
          type: "TAG",
          description: delta + " tag(s) " + direction + ": " + formatTextChange(pair.before, pair.after)
        });
      }
    }
    return changes;
  }

  function extractTimestampChanges(packet) {
    var changes = [];
    var ts = packet && packet.structuralDiff && packet.structuralDiff.timestamp ? packet.structuralDiff.timestamp : null;
    if (!ts || !Array.isArray(ts.samples)) return changes;

    for (var i = 0; i < ts.samples.length; i++) {
      var sample = ts.samples[i];
      if (sample.quality === "high") continue;

      var shifts = [];
      if (sample.startShiftMs !== 0) shifts.push("start " + (sample.startShiftMs > 0 ? "+" : "") + sample.startShiftMs + "ms");
      if (sample.endShiftMs !== 0) shifts.push("end " + (sample.endShiftMs > 0 ? "+" : "") + sample.endShiftMs + "ms");
      var shiftDesc = shifts.length > 0 ? shifts.join(", ") : "avg " + sample.avgShiftMs + "ms";

      changes.push({
        index: 0,
        type: "TIMESTAMP",
        description: 'Timing shift (' + shiftDesc + ') [' + sample.quality + ']: "' + escapeQuotesForChange(sample.refText) + '"'
      });
    }
    return changes;
  }

  function extractSegmentationChanges(packet) {
    var changes = [];
    var seg = packet && packet.structuralDiff && packet.structuralDiff.segmentation ? packet.structuralDiff.segmentation : null;
    if (!seg || !Array.isArray(seg.samples)) return changes;

    for (var i = 0; i < seg.samples.length; i++) {
      var sample = seg.samples[i];
      var refCount = sample.referenceSegmentCount || 0;
      var hypCount = sample.hypothesisSegmentCount || 0;
      var relationship = sample.relationship || "unknown";
      var severity = sample.structuralSeverity || "n/a";

      var refText = sample.referenceText ? '"' + escapeQuotesForChange(sample.referenceText) + '"' : "(empty)";
      var hypText = sample.hypothesisText ? '"' + escapeQuotesForChange(sample.hypothesisText) + '"' : "(empty)";

      var tokenChanges = [];
      if (sample.substitutions > 0) tokenChanges.push(sample.substitutions + " sub");
      if (sample.insertions > 0) tokenChanges.push(sample.insertions + " ins");
      if (sample.deletions > 0) tokenChanges.push(sample.deletions + " del");
      var tokenSuffix = tokenChanges.length > 0 ? " (" + tokenChanges.join(", ") + ")" : "";

      changes.push({
        index: 0,
        type: "SEGMENTATION",
        description: relationship + " [" + severity + "] ref=" + refCount + "\u2192hyp=" + hypCount + tokenSuffix + ": " + refText + " \u2192 " + hypText
      });
    }
    return changes;
  }

  function extractWordDiffChanges(packet) {
    return [];
  }

  function extractChanges(promptPacket) {
    if (!promptPacket) return [];
    var all = [].concat(
      extractTextChanges(promptPacket),
      extractTimestampChanges(promptPacket),
      extractSegmentationChanges(promptPacket),
      extractWordDiffChanges(promptPacket)
    );
    for (var i = 0; i < all.length; i++) {
      all[i].index = i + 1;
    }
    return all;
  }

  // ── Deterministic Rules (client-side port of deterministic-rules.ts) ──

  var DETERMINISTIC_TEMPLATES = {
    "timestamp_accuracy.nizkiy_precision": true,
    "timestamp_accuracy.nizkiy_recall": true
  };

  function runDeterministicRules(promptPacket) {
    var findings = [];
    var ts = promptPacket && promptPacket.structuralDiff && promptPacket.structuralDiff.timestamp
      ? promptPacket.structuralDiff.timestamp.overview
      : null;
    if (!ts) return findings;

    if (typeof ts.precision === "number" && ts.precision < 0.99) {
      findings.push("timestamp_accuracy.nizkiy_precision");
    }
    if (typeof ts.recall === "number" && ts.recall < 0.99) {
      findings.push("timestamp_accuracy.nizkiy_recall");
    }
    return findings;
  }

  // ── Parse LLM raw response for classifications ──

  function parseClassifications(rawContent) {
    if (!rawContent || typeof rawContent !== "string") return [];
    var parsed = parseMaybeJson(rawContent);
    if (!parsed || typeof parsed !== "object") return [];
    var items = parsed.classifications || parsed.findings;
    if (!Array.isArray(items)) return [];

    var out = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (typeof item === "string") {
        out.push({ change: null, templateId: item.trim() });
      } else if (item && typeof item === "object" && item.templateId) {
        out.push({
          change: typeof item.change === "number" ? item.change : null,
          templateId: String(item.templateId).trim()
        });
      }
    }
    return out;
  }

  function buildClassificationMap(rawContent) {
    var classifications = parseClassifications(rawContent);
    var byChange = {};
    var byTemplate = {};
    for (var i = 0; i < classifications.length; i++) {
      var c = classifications[i];
      if (c.change !== null) {
        if (!byChange[c.change]) byChange[c.change] = [];
        byChange[c.change].push(c.templateId);
      }
      byTemplate[c.templateId] = true;
    }
    return { byChange: byChange, byTemplate: byTemplate, all: classifications };
  }

  function buildBaseCandidates(primary) {
    return uniq([primary].map(cleanBaseUrl).filter(Boolean));
  }

  function getHistoryAuthHeader() {
    const username = String(els.historyUsername.value || "");
    const password = String(els.historyPassword.value || "");
    if (!username && !password) {
      return "";
    }
    return "Basic " + btoa(username + ":" + password);
  }

  async function requestJson(method, url, payload, extraHeaders) {
    const headers = {
      ...(payload ? { "Content-Type": "application/json" } : {}),
      ...(extraHeaders || {})
    };
    const response = await fetch(url, {
      method,
      headers,
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = null;
    }
    if (!response.ok) {
      const err =
        (data && typeof data.error === "string" && data.error) ||
        ("HTTP " + response.status + ": " + text.slice(0, 240));
      throw new HttpStatusError(err, response.status);
    }
    if (!data || typeof data !== "object") {
      throw new Error("Backend returned non-JSON payload.");
    }
    return data;
  }

  async function requestJsonWithFallback(method, path, payload, baseCandidates, extraHeaders) {
    if (!Array.isArray(baseCandidates) || !baseCandidates.length) {
      throw new Error("Backend URL is required.");
    }
    const errors = [];
    for (const base of baseCandidates) {
      try {
        return await requestJson(method, base + path, payload, extraHeaders);
      } catch (error) {
        errors.push(base + ": " + (error instanceof Error ? error.message : String(error)));
        if (error instanceof HttpStatusError) {
          throw error;
        }
      }
    }
    throw new Error("Could not reach backend. Tried: " + errors.join(" | "));
  }

  function parseMaybeJson(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return null;
    }
  }

  function parseTrpcFrameStream(rawText) {
    const trimmed = String(rawText || "").trim();
    if (!trimmed) return [];
    const direct = parseMaybeJson(trimmed);
    if (direct !== null) {
      return Array.isArray(direct) ? direct : [direct];
    }
    const normalized = "[" + trimmed.replace(/}\s*{/g, "},{") + "]";
    const streamed = parseMaybeJson(normalized);
    return Array.isArray(streamed) ? streamed : [];
  }

  function deepFindPayload(node) {
    if (!node) return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = deepFindPayload(item);
        if (found) return found;
      }
      return null;
    }
    if (typeof node === "object") {
      if (Array.isArray(node.annotations) && (typeof node.actionId === "string" || typeof node.reviewActionId === "string")) {
        return node;
      }
      for (const value of Object.values(node)) {
        const found = deepFindPayload(value);
        if (found) return found;
      }
    }
    return null;
  }

  function normalizeFromRaw(raw) {
    const annotationsRaw = Array.isArray(raw.annotations) ? raw.annotations : [];
    const annotations = annotationsRaw
      .map((item, idx) => ({
        id: typeof item.id === "string" ? item.id : "idx-" + idx,
        reviewActionId: typeof item.reviewActionId === "string" ? item.reviewActionId : "",
        type: typeof item.type === "string" ? item.type : "",
        content: typeof item.content === "string" ? item.content : "",
        processedRecordingId: typeof item.processedRecordingId === "string" ? item.processedRecordingId : "",
        startTimeInSeconds: toNumber(item.startTimeInSeconds),
        endTimeInSeconds: toNumber(item.endTimeInSeconds),
        metadata: item && typeof item.metadata === "object" ? item.metadata : null
      }))
      .sort((a, b) => a.startTimeInSeconds - b.startTimeInSeconds);

    const recordingsRaw = Array.isArray(raw.transcriptionChunkProcessedRecordings)
      ? raw.transcriptionChunkProcessedRecordings
      : Array.isArray(raw.recordings)
        ? raw.recordings
        : [];
    const recordings = recordingsRaw
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : "",
        transcriptionChunkId: typeof item.transcriptionChunkId === "string" ? item.transcriptionChunkId : "",
        processedRecordingId: typeof item.processedRecordingId === "string" ? item.processedRecordingId : "",
        speaker: toNumber(item.speaker),
        startTimeInSeconds: toNumber(item.startTimeInSeconds),
        endTimeInSeconds: toNumber(item.endTimeInSeconds)
      }))
      .sort((a, b) => a.startTimeInSeconds - b.startTimeInSeconds);

    const lintErrors = Array.isArray(raw.lintErrors)
      ? raw.lintErrors.map((x) => ({
          annotationId: typeof x.annotationId === "string" ? x.annotationId : "",
          reason: typeof x.reason === "string" ? x.reason : "",
          severity: typeof x.severity === "string" ? x.severity : ""
        }))
      : [];

    const actionId =
      (typeof raw.actionId === "string" && raw.actionId) ||
      (annotations[0] && annotations[0].reviewActionId) ||
      "";

    return {
      actionId,
      actionLevel: toNumber(raw.actionLevel),
      actionDecision: typeof raw.actionDecision === "string" ? raw.actionDecision : "",
      annotations,
      recordings,
      lintErrors,
      capturedAt: typeof raw.capturedAt === "string" ? raw.capturedAt : new Date().toISOString()
    };
  }

  function isNormalizedState(value) {
    return !!value &&
      typeof value === "object" &&
      Array.isArray(value.annotations) &&
      Array.isArray(value.recordings) &&
      Array.isArray(value.lintErrors);
  }

  function parseStateInput(text) {
    const parsed = parseMaybeJson(text);
    if (parsed !== null) {
      if (isNormalizedState(parsed)) return parsed;
      const found = deepFindPayload(parsed);
      if (found) return normalizeFromRaw(found);
    }
    const frames = parseTrpcFrameStream(text);
    for (const frame of frames) {
      const node = frame && typeof frame === "object" && "json" in frame ? frame.json : frame;
      const found = deepFindPayload(node);
      if (found) return normalizeFromRaw(found);
    }
    throw new Error("Could not parse state. Provide normalized JSON or raw getReviewActionDataById payload.");
  }

  async function readFileText(file) {
    if (!file) return "";
    return file.text();
  }

  async function handleStateFileUpload(file, targetEl, label) {
    if (!file) return;
    try {
      const text = await readFileText(file);
      targetEl.value = text;
      const parsed = parseStateInput(text);
      if (!els.reviewActionId.value.trim() && parsed && parsed.actionId) {
        els.reviewActionId.value = parsed.actionId;
      }
      setStatus(label + " file loaded: " + file.name, false);
    } catch (error) {
      setStatus("Failed to load " + label + " file: " + (error instanceof Error ? error.message : String(error)), true);
    }
  }

  function formatSeconds(value) {
    return Number(value).toFixed(3) + "s";
  }

  function durationMs(annotation) {
    return Math.max(0, (annotation.endTimeInSeconds - annotation.startTimeInSeconds) * 1000);
  }

  function overlapMs(a, b) {
    const start = Math.max(a.startTimeInSeconds, b.startTimeInSeconds);
    const end = Math.min(a.endTimeInSeconds, b.endTimeInSeconds);
    return Math.max(0, (end - start) * 1000);
  }

  function buildLinkSummary(originalSegments, currentSegments) {
    const oldToNew = new Map();
    const newToOld = new Map();
    for (const oldSeg of originalSegments) oldToNew.set(oldSeg.id, []);
    for (const newSeg of currentSegments) newToOld.set(newSeg.id, []);

    for (const oldSeg of originalSegments) {
      for (const newSeg of currentSegments) {
        const overlap = overlapMs(oldSeg, newSeg);
        const minDuration = Math.min(durationMs(oldSeg), durationMs(newSeg));
        const strongEnough = overlap >= 120 && overlap >= minDuration * 0.25;
        if (!strongEnough) continue;
        oldToNew.get(oldSeg.id).push(newSeg.id);
        newToOld.get(newSeg.id).push(oldSeg.id);
      }
    }

    const stablePairs = [];
    for (const oldSeg of originalSegments) {
      const linkedNew = oldToNew.get(oldSeg.id) || [];
      if (linkedNew.length !== 1) continue;
      const newId = linkedNew[0];
      const linkedOld = newToOld.get(newId) || [];
      if (linkedOld.length === 1 && linkedOld[0] === oldSeg.id) {
        stablePairs.push({ oldId: oldSeg.id, newId });
      }
    }

    return { oldToNew, newToOld, stablePairs };
  }

  function buildSegmentationAnalysis(originalState, currentState) {
    const originalSegments = [...(originalState.annotations || [])].sort((a, b) => a.startTimeInSeconds - b.startTimeInSeconds);
    const currentSegments = [...(currentState.annotations || [])].sort((a, b) => a.startTimeInSeconds - b.startTimeInSeconds);
    const originalMap = new Map(originalSegments.map((item) => [item.id, item]));
    const currentMap = new Map(currentSegments.map((item) => [item.id, item]));
    const links = buildLinkSummary(originalSegments, currentSegments);
    const stableOld = new Set(links.stablePairs.map((pair) => pair.oldId));
    const stableNew = new Set(links.stablePairs.map((pair) => pair.newId));
    const textDiffs = new Map();
    const timingDiffs = new Map();

    for (const pair of links.stablePairs) {
      const before = originalMap.get(pair.oldId);
      const after = currentMap.get(pair.newId);
      if (!before || !after) continue;
      if (normalizeWhitespace(before.content) !== normalizeWhitespace(after.content)) {
        textDiffs.set(pair.oldId, pair.newId);
      }
      const startShiftMs = Math.round((after.startTimeInSeconds - before.startTimeInSeconds) * 1000);
      const endShiftMs = Math.round((after.endTimeInSeconds - before.endTimeInSeconds) * 1000);
      if (Math.abs(startShiftMs) >= 120 || Math.abs(endShiftMs) >= 120) {
        timingDiffs.set(pair.oldId, { pair, startShiftMs, endShiftMs });
      }
    }

    const events = [];
    const consumedNewByMerge = new Set();

    for (const oldSeg of originalSegments) {
      const linkedNewIds = links.oldToNew.get(oldSeg.id) || [];
      if (stableOld.has(oldSeg.id)) {
        const newId = linkedNewIds[0];
        const before = originalMap.get(oldSeg.id);
        const after = currentMap.get(newId);
        const startShiftMs = after ? Math.round((after.startTimeInSeconds - before.startTimeInSeconds) * 1000) : 0;
        const endShiftMs = after ? Math.round((after.endTimeInSeconds - before.endTimeInSeconds) * 1000) : 0;
        if (textDiffs.has(oldSeg.id) || timingDiffs.has(oldSeg.id)) {
          events.push({
            kind: "stable",
            label: textDiffs.has(oldSeg.id) && timingDiffs.has(oldSeg.id) ? "text + timing changed" : textDiffs.has(oldSeg.id) ? "text changed" : "timing changed",
            originalSegments: [before],
            currentSegments: after ? [after] : [],
            startTimeInSeconds: before.startTimeInSeconds,
            meta: { startShiftMs, endShiftMs }
          });
        }
        continue;
      }
      if (linkedNewIds.length === 0) {
        events.push({
          kind: "deleted",
          label: "segment deleted",
          originalSegments: [oldSeg],
          currentSegments: [],
          startTimeInSeconds: oldSeg.startTimeInSeconds,
          meta: {}
        });
        continue;
      }
      if (linkedNewIds.length > 1) {
        events.push({
          kind: "split",
          label: "segment split",
          originalSegments: [oldSeg],
          currentSegments: linkedNewIds.map((id) => currentMap.get(id)).filter(Boolean),
          startTimeInSeconds: oldSeg.startTimeInSeconds,
          meta: { pieces: linkedNewIds.length }
        });
      }
    }

    for (const newSeg of currentSegments) {
      const linkedOldIds = links.newToOld.get(newSeg.id) || [];
      if (stableNew.has(newSeg.id)) continue;
      if (linkedOldIds.length === 0) {
        events.push({
          kind: "added",
          label: "segment added",
          originalSegments: [],
          currentSegments: [newSeg],
          startTimeInSeconds: newSeg.startTimeInSeconds,
          meta: {}
        });
        continue;
      }
      if (linkedOldIds.length > 1 && !consumedNewByMerge.has(newSeg.id)) {
        consumedNewByMerge.add(newSeg.id);
        events.push({
          kind: "merge",
          label: "segments merged",
          originalSegments: linkedOldIds.map((id) => originalMap.get(id)).filter(Boolean),
          currentSegments: [newSeg],
          startTimeInSeconds: newSeg.startTimeInSeconds,
          meta: { pieces: linkedOldIds.length }
        });
      }
    }

    events.sort((a, b) => a.startTimeInSeconds - b.startTimeInSeconds);
    return { events, originalSegments, currentSegments, stablePairs: links.stablePairs, textDiffs, timingDiffs, links };
  }

  function buildPromptDrivenAnalysis(prepared, originalState, currentState) {
    const promptPacket = prepared && prepared.promptPacket ? prepared.promptPacket : {};
    const structuralDiff = promptPacket && promptPacket.structuralDiff ? promptPacket.structuralDiff : null;
    const localTextEvidence = promptPacket && promptPacket.localTextEvidence ? promptPacket.localTextEvidence : null;
    return {
      mode: structuralDiff ? "structural" : "legacy",
      structuralDiff,
      localTextEvidence,
      originalSegments: originalState && Array.isArray(originalState.annotations) ? originalState.annotations : [],
      currentSegments: currentState && Array.isArray(currentState.annotations) ? currentState.annotations : []
    };
  }

  function diffWords(before, after) {
    const a = normalizeWhitespace(before).split(" ").filter(Boolean);
    const b = normalizeWhitespace(after).split(" ").filter(Boolean);
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

    for (let i = a.length - 1; i >= 0; i -= 1) {
      for (let j = b.length - 1; j >= 0; j -= 1) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const parts = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        parts.push({ type: "same", value: a[i] });
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        parts.push({ type: "del", value: a[i] });
        i += 1;
      } else {
        parts.push({ type: "add", value: b[j] });
        j += 1;
      }
    }
    while (i < a.length) parts.push({ type: "del", value: a[i++] });
    while (j < b.length) parts.push({ type: "add", value: b[j++] });
    return parts.map((part) => `<span class="diff-${part.type}">${escapeHtml(part.value)}</span>`).join(" ");
  }

  function renderEmpty(el, message) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function setRawOutput(payload) {
    els.rawOut.textContent = JSON.stringify(payload || {}, null, 2);
  }

  function renderMetricGrid(prepared, llm, context, analysis) {
    if (!prepared) {
      renderEmpty(els.metricGrid, "Run Prepare or Generate, or load a history entry.");
      els.contextMeta.textContent = "";
      return;
    }

    const overview = prepared.promptPacket && prepared.promptPacket.overview ? prepared.promptPacket.overview : {};
    const stats = prepared.stats || {};
    const structuralDiff = prepared.promptPacket && prepared.promptPacket.structuralDiff ? prepared.promptPacket.structuralDiff : null;
    const segmentationOverview = structuralDiff && structuralDiff.segmentation ? structuralDiff.segmentation.overview : {};
    const timestampOverview = structuralDiff && structuralDiff.timestamp ? structuralDiff.timestamp.overview : {};
    const cards = [
      ["Review Action", context && context.reviewActionId ? context.reviewActionId : "-"],
      ["Source", context && context.sourceLabel ? context.sourceLabel : "live"],
      ["Logged / Prepared", context && context.loggedAt ? formatDate(context.loggedAt) : formatDate(prepared.preparedAt)],
      ["Original Segments", overview.originalSegments],
      ["Current Segments", overview.currentSegments],
      ["Original Words", overview.originalWords ?? (stats.original && stats.original.words)],
      ["Current Words", overview.currentWords ?? (stats.current && stats.current.words)],
      ["Segment Delta", overview.segmentCountDelta],
      ["Local Text Changes", overview.localTextChangeCount ?? "-"],
      ["Structural Diff", overview.hasStructuralDiff ? "yes" : "no"],
      ["Split / Merge", String((segmentationOverview.splitCount ?? 0)) + " / " + String((segmentationOverview.mergeCount ?? 0))],
      ["Added / Deleted", String((segmentationOverview.addedCount ?? 0)) + " / " + String((segmentationOverview.deletedCount ?? 0))],
      ["Timeline F1", timestampOverview.f1 ?? "-"],
      ["Avg Shift Ms", timestampOverview.avgShiftMs ?? "-"],
      ["Extracted Changes", extractChanges(prepared.promptPacket).length],
      ["Deterministic Rules", runDeterministicRules(prepared.promptPacket).length],
      ["Matched Templates", llm && Array.isArray(llm.matchedTemplateIds) ? llm.matchedTemplateIds.length : 0],
      ["Feedback Items", llm && Array.isArray(llm.feedback) ? llm.feedback.length : 0],
      ["Model", llm && llm.model ? llm.model : "-"],
      ["Prompt Chars", prepared.prompts ? prepared.prompts.systemPrompt.length + prepared.prompts.userPrompt.length : "-"]
    ];

    els.metricGrid.innerHTML = cards
      .map(([label, value]) => `<article class="stat-card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(String(value ?? "-"))}</div></article>`)
      .join("");

    const metaBits = [];
    if (context && context.eventType) metaBits.push(context.eventType);
    if (prepared.metricsVersion) metaBits.push("metrics " + prepared.metricsVersion);
    if (prepared.promptVersion) metaBits.push("prompt " + prepared.promptVersion);
    if (llm && llm.templateRegistryVersion) metaBits.push("registry " + llm.templateRegistryVersion);
    els.contextMeta.textContent = metaBits.join(" | ");
  }

  function renderFeedback(llm) {
    const feedback = llm && Array.isArray(llm.feedback) ? llm.feedback : [];
    const matchedIds = llm && Array.isArray(llm.matchedTemplateIds) ? llm.matchedTemplateIds : [];
    if (!feedback.length) {
      renderEmpty(els.feedbackCards, "No LLM feedback attached to this payload.");
      return;
    }

    els.feedbackCards.innerHTML = feedback.map((item, idx) => {
      const score = Number(item.score);
      const scoreClass = score === 1 ? "s1" : score === 2 ? "s2" : "s3";
      const templateId = Array.isArray(matchedIds) && matchedIds[idx] ? matchedIds[idx] : "";
      const isDeterministic = templateId && !!DETERMINISTIC_TEMPLATES[templateId];
      const sourceBadge = templateId
        ? (isDeterministic
          ? '<span class="source-badge source-deterministic">deterministic</span>'
          : '<span class="source-badge source-llm">LLM</span>')
        : '';
      return `
        <article class="feedback-card">
          <div class="score ${scoreClass}">Score ${escapeHtml(String(score))}</div>
          <h3>${escapeHtml(item.category || "Unknown")}</h3>
          <p>${escapeHtml(item.note || "")}</p>
          <div class="source-row">
            ${sourceBadge}
            ${templateId ? '<span class="template-id">' + escapeHtml(templateId) + '</span>' : ''}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderChangeList(prepared, llm) {
    if (!prepared || !prepared.promptPacket) {
      renderEmpty(els.changeListSummary, "");
      renderEmpty(els.changeListCards, "Change list will appear here after running Prepare or Generate.");
      return;
    }

    const changes = extractChanges(prepared.promptPacket);
    const deterministicFindings = runDeterministicRules(prepared.promptPacket);
    const classMap = llm && llm.rawContent ? buildClassificationMap(llm.rawContent) : { byChange: {}, byTemplate: {}, all: [] };

    // Summary pills
    const typeCounts = {};
    for (const c of changes) {
      typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
    }
    const summaryPills = Object.keys(typeCounts).map((type) => {
      return '<div class="pill badge-type badge-' + escapeHtml(type) + '">' + escapeHtml(type) + ': ' + escapeHtml(String(typeCounts[type])) + '</div>';
    });
    if (deterministicFindings.length > 0) {
      summaryPills.push('<div class="pill source-deterministic">' + deterministicFindings.length + ' deterministic</div>');
    }
    if (classMap.all.length > 0) {
      summaryPills.push('<div class="pill source-llm">' + classMap.all.length + ' LLM classifications</div>');
    }
    els.changeListSummary.innerHTML = summaryPills.join("");

    if (changes.length === 0 && deterministicFindings.length === 0) {
      renderEmpty(els.changeListCards, "No changes extracted from this prompt packet.");
      return;
    }

    // Render change cards
    const cards = changes.map((change) => {
      const classifications = classMap.byChange[change.index] || [];
      const classHtml = classifications.length > 0
        ? '<div class="change-classification">\u2192 ' + classifications.map((id) => '<code>' + escapeHtml(id) + '</code>').join(", ") + '</div>'
        : '<div class="change-classification" style="color:#bbb">no match</div>';

      return `
        <article class="change-card">
          <div class="change-index">${escapeHtml(String(change.index))}</div>
          <div class="change-body">
            <div class="change-desc">${escapeHtml(change.description)}</div>
            ${classHtml}
          </div>
          <div class="badge-type badge-${escapeHtml(change.type)}">${escapeHtml(change.type)}</div>
        </article>
      `;
    });

    // Append deterministic findings as special cards
    for (const templateId of deterministicFindings) {
      cards.push(`
        <article class="change-card">
          <div class="change-index" style="background:rgba(184,92,56,0.14);color:var(--accent-2);">\u2713</div>
          <div class="change-body">
            <div class="change-desc">Deterministic threshold rule</div>
            <div class="change-classification"><span class="source-badge source-deterministic">deterministic</span> <code>${escapeHtml(templateId)}</code></div>
          </div>
          <div class="badge-type badge-TIMESTAMP">THRESHOLD</div>
        </article>
      `);
    }

    els.changeListCards.innerHTML = cards.join("");
  }

  function renderEventMeta(event) {
    if (event.kind === "split" || event.kind === "merge") {
      return escapeHtml(String(event.meta.pieces || 0)) + " linked segments";
    }
    if (event.kind === "stable") {
      const parts = [];
      if (typeof event.meta.startShiftMs === "number") parts.push("start " + event.meta.startShiftMs + "ms");
      if (typeof event.meta.endShiftMs === "number") parts.push("end " + event.meta.endShiftMs + "ms");
      return escapeHtml(parts.join(" | "));
    }
    return "";
  }

  function renderOfficialSegmentationEvent(sample) {
    const changedTokens = Array.isArray(sample.changedTokens) ? sample.changedTokens : [];
    const referenceSegments = Array.isArray(sample.referenceSegments) ? sample.referenceSegments : [];
    const hypothesisSegments = Array.isArray(sample.hypothesisSegments) ? sample.hypothesisSegments : [];
    const badgeClass = sample.relationship === "merged" ? "merge" : (sample.relationship || "stable");
    return `
      <article class="segment-card">
        <header>
          <div>
            <div class="badge badge-${escapeHtml(badgeClass)}">${escapeHtml(sample.relationship || "changed")}</div>
            <div class="microcopy">${escapeHtml(String(sample.referenceSegmentCount || 0))} -> ${escapeHtml(String(sample.hypothesisSegmentCount || 0))} segments | severity ${escapeHtml(sample.structuralSeverity || "n/a")}</div>
          </div>
          <div class="microcopy">sub ${escapeHtml(String(sample.substitutions || 0))} | ins ${escapeHtml(String(sample.insertions || 0))} | del ${escapeHtml(String(sample.deletions || 0))}</div>
        </header>
        <div class="segment-columns">
          <div>
            <div class="microcopy">Initial</div>
            <div class="text-box">${escapeHtml(sample.referenceText || "-")}</div>
            ${renderOfficialMappingSegments(referenceSegments)}
          </div>
          <div>
            <div class="microcopy">Final</div>
            <div class="text-box">${escapeHtml(sample.hypothesisText || "-")}</div>
            ${renderOfficialMappingSegments(hypothesisSegments)}
          </div>
        </div>
        <div class="text-box">
          <div class="microcopy">Changed Tokens</div>
          <div class="diff-text">${renderOfficialChangedTokens(changedTokens)}</div>
        </div>
      </article>
    `;
  }

  function renderOfficialChangedTokens(tokens) {
    if (!tokens || !tokens.length) {
      return '<div class="empty-state">No changed tokens captured.</div>';
    }
    return tokens.map((token) => {
      const status = token.status === "added" ? "diff-add" : token.status === "removed" ? "diff-del" : "diff-same";
      return `<span class="${status}">${escapeHtml(token.value || "")}</span>`;
    }).join(" ");
  }

  function renderOfficialMappingSegments(segments) {
    if (!segments || !segments.length) {
      return '<div class="empty-state">No member segments.</div>';
    }
    return segments.map((segment) => {
      const range = Array.isArray(segment.wordRange) && segment.wordRange.length === 2
        ? `${segment.wordRange[0]} -> ${segment.wordRange[1]}`
        : "-";
      return `
        <div class="mini-segment mapping-segment">
          <div>${escapeHtml(segment.text || "")}</div>
          <div class="microcopy">${escapeHtml(segment.annotationId || "-")} | ${escapeHtml(segment.startTimeInSeconds != null ? formatSeconds(segment.startTimeInSeconds) : "-")} -> ${escapeHtml(segment.endTimeInSeconds != null ? formatSeconds(segment.endTimeInSeconds) : "-")}</div>
          <div class="microcopy">wordRange ${escapeHtml(String(range))}</div>
        </div>
      `;
    }).join("");
  }

  function renderOfficialTimestampSummary(timestamp) {
    if (!timestamp || !timestamp.overview) {
      return "";
    }
    const overview = timestamp.overview;
    return [
      ["precision", overview.precision, "stable"],
      ["recall", overview.recall, "stable"],
      ["f1", overview.f1, "stable"],
      ["avg shift ms", overview.avgShiftMs, "changed"],
      ["within 50ms", overview.within50ms, "stable"],
      ["within 100ms", overview.within100ms, "stable"],
      ["unmatched", overview.unmatchedSegments, "risky"]
    ].map(([label, value, klass]) => `<div class="pill ${klass}">${escapeHtml(label)}: ${escapeHtml(String(value ?? "-"))}</div>`).join("");
  }

  function renderOfficialWordAccuracy(wordAccuracy) {
    if (!wordAccuracy) {
      return "";
    }
    const overview = wordAccuracy.overview || {};
    const speakers = Array.isArray(wordAccuracy.speakerBreakdown) ? wordAccuracy.speakerBreakdown : [];
    const samples = Array.isArray(wordAccuracy.wordDiffSamples) ? wordAccuracy.wordDiffSamples : [];
    const blocks = [];
    blocks.push(`
      <article class="metric-dump-card">
        <h3>Official Word Accuracy</h3>
        <pre>${escapeHtml(JSON.stringify(overview, null, 2))}</pre>
      </article>
    `);
    if (speakers.length) {
      blocks.push(`
        <article class="metric-dump-card">
          <h3>Per Speaker</h3>
          <pre>${escapeHtml(JSON.stringify(speakers, null, 2))}</pre>
        </article>
      `);
    }
    if (samples.length) {
      blocks.push(`
        <article class="metric-dump-card">
          <h3>Word Diff Samples</h3>
          <pre>${escapeHtml(JSON.stringify(samples, null, 2))}</pre>
        </article>
      `);
    }
    return blocks.join("");
  }

  function renderSegmentCollection(segments) {
    if (!segments || !segments.length) return `<div class="empty-state">None</div>`;
    return segments.map((segment) => `
      <div class="mini-segment">
        <div>${escapeHtml(segment.content || "")}</div>
        <div class="microcopy">${escapeHtml(segment.id)} | ${escapeHtml(formatSeconds(segment.startTimeInSeconds))} -> ${escapeHtml(formatSeconds(segment.endTimeInSeconds))}</div>
      </div>
    `).join("");
  }

  function renderSegmentationEvent(event) {
    return `
      <article class="segment-card">
        <header>
          <div>
            <div class="badge badge-${escapeHtml(event.kind)}">${escapeHtml(event.label)}</div>
            <div class="microcopy">${escapeHtml(formatSeconds(event.startTimeInSeconds))}</div>
          </div>
          <div class="microcopy">${renderEventMeta(event)}</div>
        </header>
        <div class="segment-columns">
          <div>
            <div class="microcopy">Initial</div>
            ${renderSegmentCollection(event.originalSegments)}
          </div>
          <div>
            <div class="microcopy">Final</div>
            ${renderSegmentCollection(event.currentSegments)}
          </div>
        </div>
      </article>
    `;
  }

  function classifyOriginalSegment(segment, analysis) {
    const linkedNew = analysis.links.oldToNew.get(segment.id) || [];
    if (linkedNew.length === 0) return "deleted";
    if (linkedNew.length > 1) return "split";
    if (analysis.textDiffs.has(segment.id) || analysis.timingDiffs.has(segment.id)) return "changed";
    return "stable";
  }

  function classifyCurrentSegment(segment, analysis) {
    const linkedOld = analysis.links.newToOld.get(segment.id) || [];
    if (linkedOld.length === 0) return "added";
    if (linkedOld.length > 1) return "merge";
    const oldId = linkedOld[0];
    if (analysis.textDiffs.has(oldId) || analysis.timingDiffs.has(oldId)) return "changed";
    return "stable";
  }

  function renderSegmentLane(title, segments, side, analysis) {
    return `
      <div class="lane">
        <h3>${escapeHtml(title)}</h3>
        ${segments.map((segment) => `
          <div class="timeline-segment ${escapeHtml(side === "original" ? classifyOriginalSegment(segment, analysis) : classifyCurrentSegment(segment, analysis))}">
            <div>${escapeHtml(segment.content || "")}</div>
            <div class="meta-line">${escapeHtml(segment.id)} | ${escapeHtml(formatSeconds(segment.startTimeInSeconds))} -> ${escapeHtml(formatSeconds(segment.endTimeInSeconds))}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderSegmentation(prepared, analysis) {
    if (!prepared || !analysis) {
      renderEmpty(els.segmentationSummary, "Segmentation diff will appear here.");
      renderEmpty(els.segmentationEvents, "No events.");
      renderEmpty(els.segmentLanes, "No segment lanes.");
      return;
    }
    if (analysis.mode === "structural" && analysis.structuralDiff) {
      const segmentation = analysis.structuralDiff.segmentation || {};
      const segmentationOverview = segmentation.overview || {};
      const timestamp = analysis.structuralDiff.timestamp || {};
      els.segmentationSummary.innerHTML = [
        ["mappings", segmentationOverview.mappingCount, "stable"],
        ["modified", segmentationOverview.modifiedCount, "changed"],
        ["split", segmentationOverview.splitCount, "risky"],
        ["merge", segmentationOverview.mergeCount, "risky"],
        ["added", segmentationOverview.addedCount, "changed"],
        ["deleted", segmentationOverview.deletedCount, "changed"]
      ].map(([label, value, klass]) => `<div class="pill ${klass}">${escapeHtml(label)}: ${escapeHtml(String(value ?? "-"))}</div>`).join("") +
      renderOfficialTimestampSummary(timestamp);

      const samples = Array.isArray(segmentation.samples) ? segmentation.samples : [];
      if (!samples.length) {
        renderEmpty(els.segmentationEvents, "No non-unchanged official segmentation samples.");
      } else {
        els.segmentationEvents.innerHTML = samples.map((sample) => renderOfficialSegmentationEvent(sample)).join("");
      }

      els.segmentLanes.innerHTML = [
        renderSegmentLane("Initial Segments", analysis.originalSegments, "original", buildSegmentationAnalysis({ annotations: analysis.originalSegments }, { annotations: analysis.currentSegments })),
        renderSegmentLane("Final Segments", analysis.currentSegments, "current", buildSegmentationAnalysis({ annotations: analysis.originalSegments }, { annotations: analysis.currentSegments }))
      ].join("");
      return;
    }

    els.segmentationSummary.innerHTML = [
      ["stable 1:1", analysis.stablePairs.length, "stable"],
      ["text changed", analysis.textDiffs.size, "changed"],
      ["timing changed", analysis.timingDiffs.size, "changed"],
      ["structural events", analysis.events.length, "risky"]
    ].map(([label, value, klass]) => `<div class="pill ${klass}">${escapeHtml(label)}: ${escapeHtml(String(value))}</div>`).join("");

    if (!analysis.events.length) {
      renderEmpty(els.segmentationEvents, "No split / merge / add / delete events detected.");
    } else {
      els.segmentationEvents.innerHTML = analysis.events.map((event) => renderSegmentationEvent(event)).join("");
    }

    els.segmentLanes.innerHTML = [
      renderSegmentLane("Initial Segments", analysis.originalSegments, "original", analysis),
      renderSegmentLane("Final Segments", analysis.currentSegments, "current", analysis)
    ].join("");
  }

  function renderTextDiffRows(prepared, analysis) {
    if (!analysis) {
      renderEmpty(els.textDiffRows, "Text diff rows will appear here.");
      return;
    }

    const localTextEvidence = prepared && prepared.promptPacket && prepared.promptPacket.localTextEvidence
      ? prepared.promptPacket.localTextEvidence
      : null;
    if (localTextEvidence && Array.isArray(localTextEvidence.changedPairs)) {
      const rows = localTextEvidence.changedPairs.map((pair) => `
        <article class="row-card">
          <header>
            <div>
              <div class="badge badge-stable">local changed pair</div>
              <div class="microcopy">tags ${escapeHtml(String(pair.beforeTagCount || 0))} -> ${escapeHtml(String(pair.afterTagCount || 0))}</div>
            </div>
          </header>
          <div class="diff-columns">
            <div class="text-box">
              <div class="microcopy">Initial</div>
              <div>${escapeHtml(pair.before || "")}</div>
            </div>
            <div class="text-box">
              <div class="microcopy">Final</div>
              <div>${escapeHtml(pair.after || "")}</div>
            </div>
          </div>
          <div class="text-box">
            <div class="microcopy">Diff</div>
            <div class="diff-text">${diffWords(pair.before || "", pair.after || "")}</div>
          </div>
        </article>
      `);

      if (!rows.length) {
        renderEmpty(els.textDiffRows, "No local changed text/tag rows.");
      } else {
        els.textDiffRows.innerHTML = rows.join("");
      }
      return;
    }

    const originalMap = new Map(analysis.originalSegments.map((segment) => [segment.id, segment]));
    const currentMap = new Map(analysis.currentSegments.map((segment) => [segment.id, segment]));
    const rows = analysis.stablePairs.map((pair) => {
      const before = originalMap.get(pair.oldId);
      const after = currentMap.get(pair.newId);
      if (!before || !after) return null;
      const beforeText = normalizeWhitespace(before.content);
      const afterText = normalizeWhitespace(after.content);
      const startShiftMs = Math.round((after.startTimeInSeconds - before.startTimeInSeconds) * 1000);
      const endShiftMs = Math.round((after.endTimeInSeconds - before.endTimeInSeconds) * 1000);
      const changed = beforeText !== afterText || Math.abs(startShiftMs) >= 120 || Math.abs(endShiftMs) >= 120;
      if (!changed) return null;
      return `
        <article class="row-card">
          <header>
            <div>
              <div class="badge badge-stable">${escapeHtml(before.id)} -> ${escapeHtml(after.id)}</div>
              <div class="microcopy">start shift ${escapeHtml(String(startShiftMs))}ms | end shift ${escapeHtml(String(endShiftMs))}ms</div>
            </div>
          </header>
          <div class="diff-columns">
            <div class="text-box">
              <div class="microcopy">Initial</div>
              <div>${escapeHtml(beforeText)}</div>
            </div>
            <div class="text-box">
              <div class="microcopy">Final</div>
              <div>${escapeHtml(afterText)}</div>
            </div>
          </div>
          <div class="text-box">
            <div class="microcopy">Diff</div>
            <div class="diff-text">${diffWords(beforeText, afterText)}</div>
          </div>
        </article>
      `;
    }).filter(Boolean);

    if (!rows.length) {
      renderEmpty(els.textDiffRows, "No one-to-one row changes detected. Structural changes are shown in Segmentation.");
      return;
    }
    els.textDiffRows.innerHTML = rows.join("");
  }

  function renderPrompts(prepared) {
    if (!prepared || !prepared.prompts) {
      els.promptOut.textContent = "No prompt loaded.";
      return;
    }
    els.promptOut.textContent = prepared.prompts.preview || ["SYSTEM:", prepared.prompts.systemPrompt || "", "", "USER:", prepared.prompts.userPrompt || ""].join("\n");
  }

  function renderMetricsDump(prepared, llm, context) {
    if (!prepared) {
      renderEmpty(els.metricsDump, "Metrics payload will appear here.");
      return;
    }
    const blocks = [
      ["stats", prepared.stats || {}],
      ["featurePacket", prepared.featurePacket || {}],
      ["promptPacket", prepared.promptPacket || {}],
      ["structuralDiff", prepared.promptPacket && prepared.promptPacket.structuralDiff ? prepared.promptPacket.structuralDiff || {} : {}],
      ["llm", llm || {}],
      ["context", context || {}]
    ];
    els.metricsDump.innerHTML = blocks.map(([title, value]) => `
      <article class="metric-dump-card">
        <h3>${escapeHtml(title)}</h3>
        <pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>
      </article>
    `).join("");
  }

  function renderAll(payload, prepared, llm, context) {
    appState.latestPayload = payload;
    appState.latestPrepared = prepared;
    appState.latestLlm = llm;
    appState.latestContext = context || {};
    appState.original = context && context.original ? context.original : appState.original;
    appState.current = context && context.current ? context.current : appState.current;
    const fallbackAnalysis = appState.original && appState.current ? buildSegmentationAnalysis(appState.original, appState.current) : null;
    const analysis = prepared && appState.original && appState.current
      ? buildPromptDrivenAnalysis(prepared, appState.original, appState.current)
      : fallbackAnalysis;
    renderMetricGrid(prepared, llm, context, analysis);
    renderFeedback(llm);
    renderChangeList(prepared, llm);
    renderSegmentation(prepared, analysis);
    renderTextDiffRows(prepared, fallbackAnalysis);
    renderPrompts(prepared);
    renderMetricsDump(prepared, llm, context);
    setRawOutput(payload);
  }

  function resetPanels() {
    renderMetricGrid(null, null, null, null);
    renderFeedback(null);
    renderChangeList(null, null);
    renderSegmentation(null, null);
    renderTextDiffRows(null);
    renderPrompts(null);
    renderMetricsDump(null, null, null);
    setRawOutput({});
  }

  function collectStateInputs() {
    const original = parseStateInput(els.originalInput.value);
    const current = parseStateInput(els.currentInput.value);
    const reviewActionId = String(els.reviewActionId.value || "").trim() || current.actionId || original.actionId;
    if (!reviewActionId) {
      throw new Error("reviewActionId is required (directly or inside state actionId).");
    }
    els.reviewActionId.value = reviewActionId;
    return { reviewActionId, original, current };
  }

  async function onPrepare() {
    try {
      const input = collectStateInputs();
      const baseCandidates = buildBaseCandidates(els.backendUrl.value);
      setStatus("Preparing prompt and metrics...", false);
      const prepared = await requestJsonWithFallback("POST", "/api/review/prepare", input, baseCandidates);
      renderAll({ prepared, llm: null }, prepared, null, {
        sourceLabel: "prepare only",
        reviewActionId: input.reviewActionId,
        original: input.original,
        current: input.current
      });
      setStatus("Prepared successfully.", false);
    } catch (error) {
      setStatus("Prepare failed: " + (error instanceof Error ? error.message : String(error)), true);
    }
  }

  async function onGenerate() {
    try {
      const input = collectStateInputs();
      const baseCandidates = buildBaseCandidates(els.backendUrl.value);
      setStatus("Calling backend /api/review/generate...", false);
      const data = await requestJsonWithFallback("POST", "/api/review/generate", input, baseCandidates);
      renderAll(data, data.prepared || null, data.llm || null, {
        sourceLabel: "live generate",
        reviewActionId: input.reviewActionId,
        original: input.original,
        current: input.current,
        loggedAt: data.llm && data.llm.receivedAt ? data.llm.receivedAt : data.prepared && data.prepared.preparedAt
      });
      setStatus("Generated with LLM query workflow.", false);
      refreshHistory().catch(() => {});
    } catch (error) {
      setStatus("Generate failed: " + (error instanceof Error ? error.message : String(error)), true);
    }
  }

  function renderHistoryList() {
    if (!appState.historyItems.length) {
      renderEmpty(els.historyList, "No history items loaded. Enter Basic Auth credentials and refresh.");
      return;
    }
    els.historyList.innerHTML = appState.historyItems.map((item) => `
      <article class="history-item ${item.historyId === appState.selectedHistoryId ? "active" : ""}" data-history-id="${escapeHtml(item.historyId)}">
        <h3>${escapeHtml(item.reviewActionId)}</h3>
        <div class="history-meta">${escapeHtml(formatDate(item.loggedAt))}</div>
        <div class="history-meta">${escapeHtml(item.eventType || "")}</div>
        <div class="history-meta">seg ${escapeHtml(String(item.originalSegments))} -> ${escapeHtml(String(item.currentSegments))} | text ${escapeHtml(String(item.localTextChangeCount ?? item.textDiffCount ?? 0))} | structural ${escapeHtml(String((item.structuralDiffUsed ?? item.babelDiffUsed) ? "yes" : "no"))}</div>
        <div class="history-meta">templates ${escapeHtml(String((item.matchedTemplateIds || []).length))} | feedback ${escapeHtml(String(item.feedbackCount || 0))}</div>
      </article>
    `).join("");
  }

  async function refreshHistory() {
    try {
      const baseCandidates = buildBaseCandidates(els.backendUrl.value);
      const authHeader = getHistoryAuthHeader();
      const params = new URLSearchParams();
      params.set("limit", "60");
      if (els.historySearch.value.trim()) params.set("query", els.historySearch.value.trim());
      if (els.reviewActionId.value.trim()) params.set("reviewActionId", els.reviewActionId.value.trim());
      if (els.historyEventType.value) params.set("eventType", els.historyEventType.value);
      setStatus("Loading protected history...", false);
      const data = await requestJsonWithFallback("GET", "/api/review-history?" + params.toString(), null, baseCandidates, authHeader ? { Authorization: authHeader } : {});
      appState.historyItems = Array.isArray(data.items) ? data.items : [];
      renderHistoryList();
      setStatus("History loaded.", false);
    } catch (error) {
      renderHistoryList();
      setStatus("History load failed: " + (error instanceof Error ? error.message : String(error)), true);
    }
  }

  async function loadHistoryDetail(historyId) {
    try {
      const baseCandidates = buildBaseCandidates(els.backendUrl.value);
      const authHeader = getHistoryAuthHeader();
      if (!authHeader) throw new Error("History Basic Auth credentials are required.");
      setStatus("Loading history entry " + historyId + "...", false);
      const detail = await requestJsonWithFallback("GET", "/api/review-history/" + encodeURIComponent(historyId), null, baseCandidates, { Authorization: authHeader });
      appState.selectedHistoryId = historyId;
      renderHistoryList();
      els.reviewActionId.value = detail.reviewActionId || "";
      els.originalInput.value = JSON.stringify(detail.original || {}, null, 2);
      els.currentInput.value = JSON.stringify(detail.current || {}, null, 2);
      renderAll(detail, detail.reconstructedPrepared || null, detail.aiReview && typeof detail.aiReview === "object" ? detail.aiReview : null, {
        sourceLabel: "history",
        reviewActionId: detail.reviewActionId,
        eventType: detail.eventType,
        loggedAt: detail.loggedAt,
        historyId: detail.historyId,
        original: detail.original,
        current: detail.current,
        metadata: detail.metadata || {},
        loggedMetrics: detail.metricsAnalysis || {}
      });
      setStatus("History entry loaded.", false);
    } catch (error) {
      setStatus("History detail failed: " + (error instanceof Error ? error.message : String(error)), true);
    }
  }

  function loadDemo() {
    const original = {
      actionId: "demo-review-action-id",
      actionLevel: 1,
      actionDecision: "pending",
      annotations: [
        { id: "seg-a", reviewActionId: "demo-review-action-id", type: "transcription", content: "Hello, how are you doing today?", processedRecordingId: "rec-1", startTimeInSeconds: 1.0, endTimeInSeconds: 3.2, metadata: null },
        { id: "seg-b", reviewActionId: "demo-review-action-id", type: "transcription", content: "I am fine, thank you for asking.", processedRecordingId: "rec-1", startTimeInSeconds: 3.2, endTimeInSeconds: 5.8, metadata: null },
        { id: "seg-c", reviewActionId: "demo-review-action-id", type: "transcription", content: "We should meet later and review the notes.", processedRecordingId: "rec-1", startTimeInSeconds: 6.0, endTimeInSeconds: 9.4, metadata: null }
      ],
      recordings: [
        { id: "rec-map-1", transcriptionChunkId: "chunk-1", processedRecordingId: "rec-1", speaker: 1, startTimeInSeconds: 0.5, endTimeInSeconds: 10.0 }
      ],
      lintErrors: [],
      capturedAt: new Date().toISOString()
    };

    const current = {
      actionId: "demo-review-action-id",
      actionLevel: 2,
      actionDecision: "pending",
      annotations: [
        { id: "seg-a", reviewActionId: "demo-review-action-id", type: "transcription", content: "Hello, how are you today?", processedRecordingId: "rec-1", startTimeInSeconds: 1.1, endTimeInSeconds: 3.0, metadata: null },
        { id: "seg-b1", reviewActionId: "demo-review-action-id", type: "transcription", content: "I am fine.", processedRecordingId: "rec-1", startTimeInSeconds: 3.1, endTimeInSeconds: 4.1, metadata: null },
        { id: "seg-b2", reviewActionId: "demo-review-action-id", type: "transcription", content: "Thank you for asking.", processedRecordingId: "rec-1", startTimeInSeconds: 4.1, endTimeInSeconds: 5.9, metadata: null },
        { id: "seg-c-merged", reviewActionId: "demo-review-action-id", type: "transcription", content: "We should meet later and review the notes together.", processedRecordingId: "rec-1", startTimeInSeconds: 6.0, endTimeInSeconds: 9.8, metadata: null },
        { id: "seg-new", reviewActionId: "demo-review-action-id", type: "transcription", content: "See you soon.", processedRecordingId: "rec-1", startTimeInSeconds: 10.0, endTimeInSeconds: 10.8, metadata: null }
      ],
      recordings: [
        { id: "rec-map-1", transcriptionChunkId: "chunk-1", processedRecordingId: "rec-1", speaker: 1, startTimeInSeconds: 0.5, endTimeInSeconds: 11.0 }
      ],
      lintErrors: [],
      capturedAt: new Date().toISOString()
    };

    els.originalInput.value = JSON.stringify(original, null, 2);
    els.currentInput.value = JSON.stringify(current, null, 2);
    els.reviewActionId.value = "demo-review-action-id";
    appState.selectedHistoryId = "";
    renderHistoryList();
    setStatus("Demo states loaded.", false);
  }

  els.demoBtn.addEventListener("click", loadDemo);
  els.prepareBtn.addEventListener("click", onPrepare);
  els.generateBtn.addEventListener("click", onGenerate);
  els.historyRefreshBtn.addEventListener("click", () => { refreshHistory().catch(() => {}); });
  els.originalFile.addEventListener("change", async (event) => {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    await handleStateFileUpload(file, els.originalInput, "ORIGINAL");
  });
  els.currentFile.addEventListener("change", async (event) => {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    await handleStateFileUpload(file, els.currentInput, "CURRENT");
  });
  els.historyList.addEventListener("click", (event) => {
    const item = event.target && event.target.closest ? event.target.closest("[data-history-id]") : null;
    if (!item) return;
    const historyId = item.getAttribute("data-history-id");
    if (historyId) loadHistoryDetail(historyId).catch(() => {});
  });
  els.historySearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") refreshHistory().catch(() => {});
  });
  els.historyPassword.addEventListener("keydown", (event) => {
    if (event.key === "Enter") refreshHistory().catch(() => {});
  });

  resetPanels();
  loadDemo();
})();
