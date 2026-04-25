import { SchwabAuth } from '@misterpea/schwab-node';
import { setupCerts } from '@misterpea/schwab-node/scripts/setup-certs';
import { KeychainTokenStore } from './KeychainTokenStore.js';
import { loadCredentials } from './credentialStore.js';

const KEYCHAIN_SERVICE = process.env.SCHWAB_KEYCHAIN_SERVICE ?? 'schwab-node';

function makeAuth(store: KeychainTokenStore): SchwabAuth {
  return new SchwabAuth({
    tokenMode: 'managed',
    tokenStore: store,
    secrets: {
      getClientId: async () => (await loadCredentials())?.clientId,
      getClientSecret: async () => (await loadCredentials())?.clientSecret,
      getRedirectUri: async () => (await loadCredentials())?.redirectUri,
    },
  });
}

export async function login(): Promise<void> {
  const creds = await loadCredentials();
  const redirectUri = creds?.redirectUri ?? process.env.SCHWAB_REDIRECT_URI;

  console.log('[schwab-auth] Setting up certificates...');
  await setupCerts({ callbackUrl: redirectUri });

  const store = new KeychainTokenStore(KEYCHAIN_SERVICE);
  const auth = makeAuth(store);

  await auth.clearAuth();
  console.log('[schwab-auth] Opening browser for Schwab OAuth...');
  await auth.getAuth();
  console.log('[schwab-auth] Authenticated. Token stored in keychain.');
}

export async function logout(): Promise<void> {
  const store = new KeychainTokenStore(KEYCHAIN_SERVICE);
  await store.clear();
  console.log('[schwab-auth] Token cleared from keychain.');
}
