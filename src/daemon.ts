import { SchwabAuth } from '@misterpea/schwab-node';
import type { TokenSet } from '@misterpea/schwab-node';
import { execSync } from 'node:child_process';
import { KeychainTokenStore } from './KeychainTokenStore.js';
import { loadCredentials } from './credentialStore.js';

const REFRESH_INTERVAL_MS =
  parseInt(process.env.SCHWAB_REFRESH_INTERVAL_MS ?? '') || 20 * 60 * 1000;
const KEYCHAIN_SERVICE = process.env.SCHWAB_KEYCHAIN_SERVICE ?? 'schwab-node';

export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
export const NOTIFY_THRESHOLD_MS = 48 * 60 * 60 * 1000;

function defaultNotify(message: string): void {
  try {
    execSync(
      `osascript -e 'display notification "${message}" with title "Schwab Auth"'`,
      { stdio: 'ignore' },
    );
  } catch {
    // osascript unavailable
  }
}

export async function tick(
  store: KeychainTokenStore,
  auth: SchwabAuth,
  notify = defaultNotify,
): Promise<void> {
  const token = await store.load();

  if (!token) {
    console.error('[schwab-auth] No token in keychain. Run: schwab-auth login');
    return;
  }

  const age = Date.now() - token.refresh_obtained_at;

  if (age >= REFRESH_TOKEN_EXPIRY_MS) {
    console.error('[schwab-auth] Refresh token expired. Run: schwab-auth login');
    notify('Schwab session expired — run: schwab-auth login');
    return;
  }

  if (age > REFRESH_TOKEN_EXPIRY_MS - NOTIFY_THRESHOLD_MS) {
    const hoursLeft = Math.floor((REFRESH_TOKEN_EXPIRY_MS - age) / (60 * 60 * 1000));
    console.log(`[schwab-auth] Refresh token expires in ~${hoursLeft}h`);
    notify(`Schwab token expires in ~${hoursLeft}h — run: schwab-auth login`);
  }

  try {
    await auth.getAuth();
  } catch (err) {
    console.error('[schwab-auth] Token refresh failed:', err instanceof Error ? err.message : err);
  }
}

export async function startDaemon(): Promise<void> {
  const store = new KeychainTokenStore(KEYCHAIN_SERVICE);
  const auth = new SchwabAuth({
    tokenMode: 'managed',
    tokenStore: store,
    secrets: {
      getClientId: async () => (await loadCredentials())?.clientId,
      getClientSecret: async () => (await loadCredentials())?.clientSecret,
      getRedirectUri: async () => (await loadCredentials())?.redirectUri,
    },
  });

  process.on('SIGTERM', () => {
    console.log('[schwab-auth] Daemon shutting down');
    process.exit(0);
  });
  process.on('SIGINT', () => {
    console.log('[schwab-auth] Daemon shutting down');
    process.exit(0);
  });

  await tick(store, auth);
  setInterval(() => tick(store, auth), REFRESH_INTERVAL_MS);
  console.log(`[schwab-auth] Daemon running — refresh every ${REFRESH_INTERVAL_MS / 60000} min`);
}
