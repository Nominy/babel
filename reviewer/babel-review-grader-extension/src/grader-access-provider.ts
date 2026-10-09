import {
  REVIEW_GRADER_EXTENSION_ID,
  REVIEW_GRADER_ACCESS_PORT,
  REVIEW_GRADER_ACCESS_VERSION,
  REVIEW_GRADER_ACCESS_CAPABILITY,
  REVIEW_GRADER_ACCESS_CLIENT_IDS,
  REVIEW_GRADER_ACCESS_TIMEOUT_MS,
  REVIEW_GRADER_ACCESS_IDLE_MS,
  isReviewGraderAccessRequest,
  type ReviewGraderAccessTimers,
  type ReviewGraderEvent,
  type ReviewGraderPort
} from '@nominy/babel-babel-runtime';

export interface ReviewGraderProviderRuntime {
  readonly id: string;
  readonly lastError?: { readonly message?: string };
  readonly onConnectExternal: ReviewGraderEvent<(port: ReviewGraderPort) => void>;
}

/** The browser supplies sender.id; no page message or claimed identity is accepted. */
export function installReviewGraderAccessProvider(
  runtime: ReviewGraderProviderRuntime,
  timers: ReviewGraderAccessTimers = {
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimeout: handle => globalThis.clearTimeout(handle as number)
  }
): () => void {
  if (runtime.id !== REVIEW_GRADER_EXTENSION_ID) return () => {};
  const sessions = new Set<(revoke: boolean) => void>();
  let disposed = false;

  const onConnect = (port: ReviewGraderPort) => {
    if (disposed || port.name !== REVIEW_GRADER_ACCESS_PORT
      || !port.sender?.id || !REVIEW_GRADER_ACCESS_CLIENT_IDS.includes(port.sender.id)) {
      try { port.disconnect(); } catch {}
      return;
    }
    let nonce: string | null = null;
    let sequence = -1;
    let closed = false;
    let timeout: unknown = null;

    function reply(type: 'grant' | 'revoke') {
      port.postMessage({
        version: REVIEW_GRADER_ACCESS_VERSION, type,
        capability: REVIEW_GRADER_ACCESS_CAPABILITY, nonce, sequence
      });
    }

    function close(revoke: boolean) {
      if (closed) return;
      closed = true;
      if (timeout !== null) timers.clearTimeout(timeout);
      timeout = null;
      sessions.delete(close);
      port.onMessage.removeListener(onMessage);
      port.onDisconnect.removeListener(onDisconnect);
      if (revoke && nonce !== null) {
        try { reply('revoke'); } catch {}
      }
      try { port.disconnect(); } catch {}
    }

    function armTimeout(delay: number) {
      if (timeout !== null) timers.clearTimeout(timeout);
      timeout = timers.setTimeout(() => close(true), delay);
    }

    function onMessage(message: unknown) {
      if (closed) return;
      if (!isReviewGraderAccessRequest(message)
        || (nonce === null ? message.type !== 'request'
          : message.type !== 'heartbeat' || message.nonce !== nonce || message.sequence !== sequence + 1)) {
        close(true);
        return;
      }
      nonce = message.nonce;
      sequence = message.sequence;
      armTimeout(REVIEW_GRADER_ACCESS_IDLE_MS);
      try { reply('grant'); } catch { close(false); }
    }

    function onDisconnect() {
      void runtime.lastError;
      close(false);
    }

    sessions.add(close);
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(onDisconnect);
    armTimeout(REVIEW_GRADER_ACCESS_TIMEOUT_MS);
  };

  runtime.onConnectExternal.addListener(onConnect);
  return () => {
    if (disposed) return;
    disposed = true;
    runtime.onConnectExternal.removeListener(onConnect);
    for (const close of sessions) close(true);
  };
}
