import readline from 'node:readline/promises';
import { loadCredentials, saveCredentials, type SchwabCredentials } from './credentialStore.js';
import { login } from './login.js';

async function prompt(rl: readline.Interface, question: string, current?: string, masked = false): Promise<string> {
  const hint = current ? (masked ? `[***]` : `[${current}]`) : '';
  const answer = (await rl.question(`${question} ${hint}: `)).trim();
  return answer || current || '';
}

export async function configure(options?: { skipReauth?: boolean }): Promise<SchwabCredentials> {
  const existing = await loadCredentials();

  console.log('\nConfigure Schwab API credentials');
  console.log('Press Enter to keep existing value.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const clientId = await prompt(rl, 'Schwab Client ID', existing?.clientId ?? '');
    const clientSecret = await prompt(rl, 'Schwab Client Secret', existing?.clientSecret ?? '', true);
    const redirectUri = await prompt(rl, 'Redirect URI', existing?.redirectUri ?? 'https://127.0.0.1:8443');

    if (!clientId) throw new Error('Client ID is required.');
    if (!clientSecret) throw new Error('Client Secret is required.');
    if (!redirectUri) throw new Error('Redirect URI is required.');

    const creds: SchwabCredentials = { clientId, clientSecret, redirectUri };
    await saveCredentials(creds);
    console.log('\nCredentials saved to keychain.');

    if (!options?.skipReauth) {
      const reauth = (await rl.question('Re-authenticate now? [Y/n]: ')).trim().toLowerCase();
      if (reauth !== 'n') {
        await login();
      }
    }

    return creds;
  } finally {
    rl.close();
  }
}
