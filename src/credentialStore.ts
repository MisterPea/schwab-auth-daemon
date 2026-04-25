import keytar from 'keytar';

const CONFIG_SERVICE = 'schwab-auth-config';
const CONFIG_ACCOUNT = 'credentials';

export type SchwabCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export async function saveCredentials(creds: SchwabCredentials): Promise<void> {
  await keytar.setPassword(CONFIG_SERVICE, CONFIG_ACCOUNT, JSON.stringify(creds));
}

export async function loadCredentials(): Promise<SchwabCredentials | null> {
  const raw = await keytar.getPassword(CONFIG_SERVICE, CONFIG_ACCOUNT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SchwabCredentials;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await keytar.deletePassword(CONFIG_SERVICE, CONFIG_ACCOUNT);
}
