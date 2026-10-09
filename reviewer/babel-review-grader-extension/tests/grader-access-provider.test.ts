import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  createReviewGraderAccess,
  REVIEW_GRADER_EXTENSION_ID,
  REVIEW_GRADER_ACCESS_PORT,
  REVIEW_GRADER_ACCESS_CLIENT_IDS,
  REVIEW_GRADER_ACCESS_TIMEOUT_MS,
  REVIEW_GRADER_ACCESS_HEARTBEAT_MS,
  REVIEW_GRADER_ACCESS_RETRY_MS,
  REVIEW_GRADER_ACCESS_IDLE_MS,
  type ReviewGraderPort,
  type ReviewGraderAccessTimers
} from '@nominy/babel-babel-runtime';
import { installReviewGraderAccessProvider } from '../src/grader-access-provider';

class Clock implements ReviewGraderAccessTimers {
  now = 0;
  next = 0;
  tasks = new Map<number, { at: number; callback: () => void }>();
  setTimeout(callback: () => void, delay: number) {
    const id = ++this.next;
    this.tasks.set(id, { at: this.now + delay, callback });
    return id;
  }
  clearTimeout(id: unknown) { this.tasks.delete(id as number); }
  advance(delay: number) {
    const target = this.now + delay;
    for (;;) {
      const due = [...this.tasks].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.tasks.delete(due[0]);
      this.now = due[1].at;
      due[1].callback();
    }
    this.now = target;
  }
}

class Event<Args extends unknown[]> {
  listeners = new Set<(...args: Args) => void>();
  addListener(listener: (...args: Args) => void) { this.listeners.add(listener); }
  removeListener(listener: (...args: Args) => void) { this.listeners.delete(listener); }
  emit(...args: Args) { for (const listener of [...this.listeners]) listener(...args); }
}

class Port implements ReviewGraderPort {
  name = REVIEW_GRADER_ACCESS_PORT;
  onMessage = new Event<[unknown]>();
  onDisconnect = new Event<[]>();
  messages: unknown[] = [];
  closed = false;
  peer?: Port;
  constructor(readonly sender?: { id?: string }) {}
  postMessage(message: unknown) {
    if (this.closed) throw new Error('Disconnected port');
    const cloned = structuredClone(message);
    this.messages.push(cloned);
    this.peer?.onMessage.emit(cloned);
  }
  disconnect() {
    if (this.closed) return;
    this.closed = true;
    if (this.peer) {
      this.peer.closed = true;
      this.peer.onDisconnect.emit();
    }
  }
}

const request = (nonce = 'a'.repeat(32)) => ({
  version: 1, type: 'request', capability: 'audio-enhancement', nonce, sequence: 0
});

function fixture(t: TestContext, id: string = REVIEW_GRADER_EXTENSION_ID) {
  const clock = new Clock();
  let lastErrorReads = 0;
  const runtime = {
    id,
    onConnectExternal: new Event<[ReviewGraderPort]>(),
    get lastError() { lastErrorReads++; return undefined; }
  };
  const dispose = installReviewGraderAccessProvider(runtime, clock);
  t.after(dispose);
  const connect = (sender: string | undefined = REVIEW_GRADER_ACCESS_CLIENT_IDS[0]) => {
    const port = new Port(sender ? { id: sender } : undefined);
    runtime.onConnectExternal.emit(port);
    return port;
  };
  return { clock, runtime, connect, dispose, lastErrorReads: () => lastErrorReads };
}

test('manifest pins the transport identity and admits only the five extension IDs, never web origins', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const derivedId = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32)
    .replace(/[0-9a-f]/g, value => String.fromCharCode(97 + parseInt(value, 16)));
  assert.equal(derivedId, REVIEW_GRADER_EXTENSION_ID);
  assert.deepEqual(manifest.externally_connectable, { ids: [...REVIEW_GRADER_ACCESS_CLIENT_IDS] });
  assert.equal(manifest.permissions.includes('management'), false);
  assert.equal(manifest.background.service_worker, 'dist/background.js');
});

test('each allowlisted Helper or Gold gets only a nonce-bound explicit enhancement grant', t => {
  const f = fixture(t);
  for (const id of REVIEW_GRADER_ACCESS_CLIENT_IDS) {
    const port = f.connect(id);
    assert.equal(port.messages.length, 0);
    const hello = request();
    port.onMessage.emit(hello);
    assert.deepEqual(port.messages, [{ ...hello, type: 'grant' }]);
    const heartbeat = { ...hello, type: 'heartbeat', sequence: 1 };
    port.onMessage.emit(heartbeat);
    assert.deepEqual(port.messages[1], { ...heartbeat, type: 'grant' });
    assert.equal(port.closed, false);
  }
});

test('wrong senders, missing identities, wrong ports and incorrectly installed providers cannot grant', t => {
  const f = fixture(t);
  for (const sender of [undefined, '', REVIEW_GRADER_EXTENSION_ID, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'https://dashboard.babel.audio']) {
    const port = new Port(sender ? { id: sender } : undefined);
    f.runtime.onConnectExternal.emit(port);
    port.onMessage.emit(request());
    assert.equal(port.closed, true);
    assert.equal(port.messages.length, 0);
    assert.equal(port.onMessage.listeners.size, 0);
  }
  const wrongPort = new Port({ id: REVIEW_GRADER_ACCESS_CLIENT_IDS[0] });
  wrongPort.name = 'page-message';
  f.runtime.onConnectExternal.emit(wrongPort);
  assert.equal(wrongPort.closed, true);
  assert.equal(f.clock.tasks.size, 0);
  const wrongInstallation = fixture(t, REVIEW_GRADER_ACCESS_CLIENT_IDS[0]);
  assert.equal(wrongInstallation.runtime.onConnectExternal.listeners.size, 0);
});

test('initial malformed requests and unsolicited heartbeats fail closed without a grant', t => {
  const f = fixture(t);
  for (const message of [
    null, [], {}, { ...request(), type: 'grant' }, { ...request(), type: 'heartbeat', sequence: 1 },
    { ...request(), capability: 'all' }, { ...request(), version: 2 }, { ...request(), sequence: 1 },
    { ...request(), nonce: 'short' }, { ...request(), extra: true }
  ]) {
    const port = f.connect();
    port.onMessage.emit(message);
    assert.equal(port.closed, true);
    assert.equal(port.messages.length, 0);
    assert.equal(port.onMessage.listeners.size, 0);
  }
  assert.equal(f.clock.tasks.size, 0);
});

test('nonce substitution, repeated handshake and out-of-order or replayed heartbeats revoke existing grants', t => {
  const f = fixture(t);
  for (const invalid of [
    request(),
    { ...request('b'.repeat(32)), type: 'heartbeat', sequence: 1 },
    { ...request(), type: 'heartbeat', sequence: 2 },
    { ...request(), type: 'heartbeat', sequence: 0 },
    { ...request(), type: 'heartbeat', sequence: 1.5 }
  ]) {
    const port = f.connect();
    port.onMessage.emit(request());
    port.onMessage.emit(invalid);
    assert.deepEqual(port.messages, [{ ...request(), type: 'grant' }, { ...request(), type: 'revoke' }]);
    assert.equal(port.closed, true);
  }
  const port = f.connect();
  port.onMessage.emit(request());
  const heartbeat = { ...request(), type: 'heartbeat', sequence: 1 };
  port.onMessage.emit(heartbeat);
  port.onMessage.emit(heartbeat);
  assert.deepEqual(port.messages[2], { ...heartbeat, type: 'revoke' });
  assert.equal(port.closed, true);
});

test('provider bounds silent handshakes and idle grants, renewing only on valid traffic', t => {
  const f = fixture(t);
  const silent = f.connect();
  f.clock.advance(REVIEW_GRADER_ACCESS_TIMEOUT_MS);
  assert.equal(silent.closed, true);
  assert.equal(silent.messages.length, 0);
  const port = f.connect();
  port.onMessage.emit(request());
  f.clock.advance(REVIEW_GRADER_ACCESS_IDLE_MS - 1);
  assert.equal(port.closed, false);
  const heartbeat = { ...request(), type: 'heartbeat', sequence: 1 };
  port.onMessage.emit(heartbeat);
  f.clock.advance(REVIEW_GRADER_ACCESS_IDLE_MS - 1);
  assert.equal(port.closed, false);
  f.clock.advance(1);
  assert.equal(port.closed, true);
  assert.deepEqual(port.messages.at(-1), { ...heartbeat, type: 'revoke' });
  assert.equal(f.clock.tasks.size, 0);
});

test('provider disposal revokes every lease, releases all listeners and timers, and is idempotent', t => {
  const f = fixture(t);
  const ports = [f.connect(), f.connect()];
  for (const port of ports) port.onMessage.emit(request());
  f.dispose();
  f.dispose();
  for (const port of ports) {
    assert.deepEqual(port.messages.at(-1), { ...request(), type: 'revoke' });
    assert.equal(port.closed, true);
    assert.equal(port.onMessage.listeners.size, 0);
    assert.equal(port.onDisconnect.listeners.size, 0);
  }
  assert.equal(f.runtime.onConnectExternal.listeners.size, 0);
  assert.equal(f.clock.tasks.size, 0);
});

test('client and actual provider exchange grants, retain heartbeat leases and revoke on provider shutdown', async t => {
  const f = fixture(t);
  const clients: Port[] = [];
  let nonce = 0;
  const access = createReviewGraderAccess({
    connect(id, info) {
      assert.equal(id, REVIEW_GRADER_EXTENSION_ID);
      assert.equal(info.name, REVIEW_GRADER_ACCESS_PORT);
      const client = new Port();
      const provider = new Port({ id: REVIEW_GRADER_ACCESS_CLIENT_IDS[0] });
      client.peer = provider;
      provider.peer = client;
      clients.push(client);
      f.runtime.onConnectExternal.emit(provider);
      return client;
    }
  }, { timers: f.clock, createNonce: () => (++nonce).toString(16).padStart(32, '0') });
  t.after(() => access.dispose());
  const changes: boolean[] = [];
  access.subscribe(value => changes.push(value));
  assert.equal(await access.start(), true);
  const signal = await access.acquire();
  assert.ok(signal);
  f.clock.advance(REVIEW_GRADER_ACCESS_HEARTBEAT_MS * 4);
  assert.equal(signal.aborted, false);
  assert.equal(await access.acquire(), signal);
  assert.equal(clients[0].messages.length, 5);
  f.dispose();
  assert.equal(signal.aborted, true);
  assert.equal(access.isAvailable(), false);
  assert.deepEqual(changes, [false, true, false]);
  const disposeReplacement = installReviewGraderAccessProvider(f.runtime, f.clock);
  t.after(disposeReplacement);
  f.clock.advance(REVIEW_GRADER_ACCESS_RETRY_MS);
  const renewed = await access.acquire();
  assert.ok(renewed);
  assert.notEqual(renewed, signal);
  assert.equal(renewed.aborted, false);
  access.dispose();
  assert.equal(renewed.aborted, true);
  assert.equal(f.lastErrorReads(), 1);
  assert.equal(f.clock.tasks.size, 0);
});
