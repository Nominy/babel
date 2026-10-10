import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  createReviewGraderAccess,
  REVIEW_GRADER_EXTENSION_ID,
  REVIEW_GRADER_TEST_EXTENSION_ID,
  REVIEW_GRADER_EXTENSION_IDS,
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

function fixture(t: TestContext, id: string = REVIEW_GRADER_EXTENSION_ID, clock = new Clock()) {
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

function linkedFixture(t: TestContext, identities: readonly string[]) {
  const clock = new Clock();
  const providers = Object.fromEntries(identities.map(id => [id, fixture(t, id, clock)]));
  const calls: { id: string; port: Port }[] = [];
  let nonce = 0;
  const access = createReviewGraderAccess({
    connect(id, info) {
      assert.equal(info.name, REVIEW_GRADER_ACCESS_PORT);
      const client = new Port({ id });
      calls.push({ id, port: client });
      const provider = providers[id];
      if (!provider?.runtime.onConnectExternal.listeners.size) {
        client.postMessage = () => {
          client.closed = true;
          client.onDisconnect.emit();
        };
      } else {
        const remote = new Port({ id: REVIEW_GRADER_ACCESS_CLIENT_IDS[0] });
        client.peer = remote;
        remote.peer = client;
        provider.runtime.onConnectExternal.emit(remote);
      }
      return client;
    }
  }, { timers: clock, createNonce: () => (++nonce).toString(16).padStart(32, '0') });
  t.after(() => {
    access.dispose();
    assert.equal(clock.tasks.size, 0);
    for (const { port } of calls) {
      assert.equal(port.closed, true);
      assert.equal(port.onMessage.listeners.size, 0);
      assert.equal(port.onDisconnect.listeners.size, 0);
      assert.equal(port.peer?.onMessage.listeners.size ?? 0, 0);
      assert.equal(port.peer?.onDisconnect.listeners.size ?? 0, 0);
    }
  });
  return { access, clock, providers, calls };
}

test('unpacked manifest pins the test identity and admits only the five extension IDs, never web origins', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const derivedId = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32)
    .replace(/[0-9a-f]/g, value => String.fromCharCode(97 + parseInt(value, 16)));
  assert.equal(derivedId, REVIEW_GRADER_TEST_EXTENSION_ID);
  assert.deepEqual(manifest.externally_connectable, { ids: [...REVIEW_GRADER_ACCESS_CLIENT_IDS] });
  assert.equal(manifest.permissions.includes('management'), false);
  assert.equal(manifest.background.service_worker, 'dist/background.js');
});

test('both pinned providers grant each allowlisted Helper or Gold only nonce-bound enhancement access', t => {
  for (const providerId of REVIEW_GRADER_EXTENSION_IDS) {
    const f = fixture(t, providerId);
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
    f.dispose();
    assert.equal(f.clock.tasks.size, 0);
  }
});

test('wrong senders, missing identities, wrong ports and incorrectly installed providers cannot grant', t => {
  const f = fixture(t);
  for (const sender of [undefined, '', ...REVIEW_GRADER_EXTENSION_IDS, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'https://dashboard.babel.audio']) {
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
  for (const id of [REVIEW_GRADER_ACCESS_CLIENT_IDS[0], 'abkaoilaiihoinpajpmdepcmehphihoc', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '']) {
    const wrongInstallation = fixture(t, id);
    assert.equal(wrongInstallation.runtime.onConnectExternal.listeners.size, 0);
    const port = wrongInstallation.connect();
    port.onMessage.emit(request());
    assert.equal(port.messages.length, 0);
    assert.equal(port.onMessage.listeners.size, 0);
    assert.equal(wrongInstallation.clock.tasks.size, 0);
  }
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

test('real providers support production-only, test-only, both and neither without delaying immediate fallback', async t => {
  for (const identities of [
    [REVIEW_GRADER_EXTENSION_ID],
    [REVIEW_GRADER_TEST_EXTENSION_ID],
    REVIEW_GRADER_EXTENSION_IDS,
    []
  ]) {
    await t.test(identities.join(',') || 'neither', async child => {
      const f = linkedFixture(child, identities);
      const expected = identities.includes(REVIEW_GRADER_EXTENSION_ID) ? REVIEW_GRADER_EXTENSION_ID
        : identities.includes(REVIEW_GRADER_TEST_EXTENSION_ID) ? REVIEW_GRADER_TEST_EXTENSION_ID : null;
      assert.equal(await f.access.start(), expected !== null);
      assert.deepEqual(f.calls.map(call => call.id), expected === REVIEW_GRADER_EXTENSION_ID
        ? [REVIEW_GRADER_EXTENSION_ID] : REVIEW_GRADER_EXTENSION_IDS);
      assert.equal(f.clock.now, 0);
      const signal = await f.access.acquire();
      if (expected) {
        assert.ok(signal);
        assert.equal(f.calls.at(-1)?.id, expected);
        f.clock.advance(REVIEW_GRADER_ACCESS_HEARTBEAT_MS * 4);
        assert.equal(signal.aborted, false);
        assert.equal(await f.access.acquire(), signal);
        assert.equal(f.calls.at(-1)?.port.messages.length, 5);
        assert.equal(f.calls.length, expected === REVIEW_GRADER_EXTENSION_ID ? 1 : 2);
      } else {
        assert.equal(signal, null);
        assert.equal(f.clock.tasks.size, 1);
      }
      f.access.dispose();
      if (signal) assert.equal(signal.aborted, true);
      assert.equal(f.clock.tasks.size, 0);
    });
  }
});

test('real provider revocation fails over in both directions and fresh retries prefer production', async t => {
  const f = linkedFixture(t, REVIEW_GRADER_EXTENSION_IDS);
  const production = f.providers[REVIEW_GRADER_EXTENSION_ID]!;
  const testing = f.providers[REVIEW_GRADER_TEST_EXTENSION_ID]!;
  const changes: boolean[] = [];
  f.access.subscribe(value => changes.push(value));
  assert.equal(await f.access.start(), true);
  const first = await f.access.acquire();
  assert.ok(first);
  production.dispose();
  assert.equal(first.aborted, true);
  const second = await f.access.acquire();
  assert.ok(second);
  assert.notEqual(second, first);
  assert.equal(f.calls.at(-1)?.id, REVIEW_GRADER_TEST_EXTENSION_ID);
  assert.deepEqual(changes, [false, true, false, true]);

  const disposeProduction = installReviewGraderAccessProvider(production.runtime, f.clock);
  t.after(disposeProduction);
  f.clock.advance(REVIEW_GRADER_ACCESS_HEARTBEAT_MS * 2);
  assert.equal(await f.access.acquire(), second);
  assert.equal(f.calls.length, 2);
  testing.dispose();
  assert.equal(second.aborted, true);
  const third = await f.access.acquire();
  assert.ok(third);
  assert.notEqual(third, second);
  assert.equal(f.calls.at(-1)?.id, REVIEW_GRADER_EXTENSION_ID);
  assert.deepEqual(changes, [false, true, false, true, false, true]);

  disposeProduction();
  assert.equal(third.aborted, true);
  assert.equal(await f.access.acquire(), null);
  assert.equal(f.calls.length, 4);
  assert.equal(f.clock.tasks.size, 1);
  const disposeReplacement = installReviewGraderAccessProvider(production.runtime, f.clock);
  t.after(disposeReplacement);
  f.clock.advance(REVIEW_GRADER_ACCESS_RETRY_MS);
  const renewed = await f.access.acquire();
  assert.ok(renewed);
  assert.notEqual(renewed, third);
  assert.equal(f.calls.at(-1)?.id, REVIEW_GRADER_EXTENSION_ID);
  assert.equal(renewed.aborted, false);
  f.access.dispose();
  assert.equal(renewed.aborted, true);
  assert.equal(production.lastErrorReads(), 1);
  assert.equal(testing.lastErrorReads(), 0);
  assert.equal(f.clock.tasks.size, 0);
});
