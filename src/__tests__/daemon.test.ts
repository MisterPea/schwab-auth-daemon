import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { tick, REFRESH_TOKEN_EXPIRY_MS, NOTIFY_THRESHOLD_MS } from '../daemon.js';
import type { TokenSet } from '@misterpea/schwab-node';

function makeToken(refreshAgeMs: number): TokenSet {
  return {
    access_token: 'access',
    refresh_token: 'refresh',
    token_type: 'Bearer',
    expires_in: 1800,
    obtained_at: Date.now() - 2000,
    refresh_obtained_at: Date.now() - refreshAgeMs,
  };
}

function makeStore(token: TokenSet | null) {
  return { load: vi.fn().mockResolvedValue(token) } as any;
}

function makeAuth() {
  return { getAuth: vi.fn().mockResolvedValue({}) } as any;
}

describe('tick', () => {
  let notify: Mock<(msg: string) => void>;

  beforeEach(() => {
    notify = vi.fn<(msg: string) => void>();
  });

  it('no token — skips getAuth, no notify', async () => {
    const store = makeStore(null);
    const auth = makeAuth();

    await tick(store, auth, notify);

    expect(auth.getAuth).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('refresh token expired — skips getAuth, notifies', async () => {
    const store = makeStore(makeToken(REFRESH_TOKEN_EXPIRY_MS + 1000));
    const auth = makeAuth();

    await tick(store, auth, notify);

    expect(auth.getAuth).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledOnce();
    expect(notify.mock.calls[0][0]).toMatch(/expired/i);
  });

  it('refresh token nearing expiry — notifies AND calls getAuth', async () => {
    const age = REFRESH_TOKEN_EXPIRY_MS - NOTIFY_THRESHOLD_MS + 1000;
    const store = makeStore(makeToken(age));
    const auth = makeAuth();

    await tick(store, auth, notify);

    expect(notify).toHaveBeenCalledOnce();
    expect(auth.getAuth).toHaveBeenCalledOnce();
  });

  it('healthy token — calls getAuth, no notify', async () => {
    const store = makeStore(makeToken(1000));
    const auth = makeAuth();

    await tick(store, auth, notify);

    expect(auth.getAuth).toHaveBeenCalledOnce();
    expect(notify).not.toHaveBeenCalled();
  });

  it('getAuth failure — catches error, does not rethrow', async () => {
    const store = makeStore(makeToken(1000));
    const auth = { getAuth: vi.fn().mockRejectedValue(new Error('network error')) } as any;

    await expect(tick(store, auth, notify)).resolves.toBeUndefined();
  });

  it('token exactly at expiry boundary — treats as expired', async () => {
    const store = makeStore(makeToken(REFRESH_TOKEN_EXPIRY_MS));
    const auth = makeAuth();

    await tick(store, auth, notify);

    expect(auth.getAuth).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledOnce();
  });
});
