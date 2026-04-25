import { execSync } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import readline from 'node:readline/promises';
import { configure } from './configure.js';
import { login } from './login.js';
import { clearCredentials } from './credentialStore.js';
import { KeychainTokenStore } from './KeychainTokenStore.js';

const LABEL = 'com.schwab-auth-daemon';
const PLIST_PATH = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const KEYCHAIN_SERVICE = process.env.SCHWAB_KEYCHAIN_SERVICE ?? 'schwab-node';

function nodePath(): string {
  return execSync('which node', { encoding: 'utf8' }).trim();
}

function schwabAuthPath(): string {
  return execSync('which schwab-auth', { encoding: 'utf8' }).trim();
}

function uid(): string {
  return execSync('id -u', { encoding: 'utf8' }).trim();
}

function run(cmd: string): void {
  try {
    execSync(cmd, { stdio: 'ignore' });
  } catch {
    // best-effort launchctl calls
  }
}

export function generatePlist(
  workingDir: string,
  logDir: string,
  nodeExec: string,
  schwabAuthExec: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${nodeExec}</string>
    <string>${schwabAuthExec}</string>
    <string>daemon</string>
  </array>

  <key>RunAtLoad</key>
  <false/>

  <key>KeepAlive</key>
  <true/>

  <key>WorkingDirectory</key>
  <string>${workingDir}</string>

  <key>StandardOutPath</key>
  <string>${join(logDir, 'daemon.log')}</string>

  <key>StandardErrorPath</key>
  <string>${join(logDir, 'daemon.error.log')}</string>
</dict>
</plist>
`;
}

export async function install(): Promise<void> {
  if (process.platform !== 'darwin') {
    console.error('schwab-auth install is only supported on macOS.');
    process.exit(1);
  }

  if (existsSync(PLIST_PATH)) {
    console.log(`Daemon already installed at ${PLIST_PATH}`);
    console.log('Run schwab-auth uninstall first to reinstall.');
    process.exit(1);
  }

  // Step 1: configure credentials
  await configure({ skipReauth: true });

  // Step 2: authenticate
  console.log('');
  await login();

  // Step 3: write plist
  const workingDir = process.cwd();
  const logDir = join(workingDir, 'logs');
  await mkdir(logDir, { recursive: true });

  const plist = generatePlist(workingDir, logDir, nodePath(), schwabAuthPath());
  await writeFile(PLIST_PATH, plist, 'utf8');
  console.log(`\nPlist written to ${PLIST_PATH}`);

  // Step 4: load and start
  run(`launchctl load ${PLIST_PATH}`);
  run(`launchctl kickstart gui/${uid()}/${LABEL}`);
  console.log('Daemon started.');
  console.log('\nDone. Run schwab-auth status to verify.');
}

export async function uninstall(): Promise<void> {
  // Stop and unload daemon
  run(`launchctl kill SIGTERM gui/${uid()}/${LABEL}`);
  run(`launchctl unload ${PLIST_PATH}`);

  if (existsSync(PLIST_PATH)) {
    await rm(PLIST_PATH);
    console.log('Plist removed.');
  } else {
    console.log('No plist found.');
  }

  // Optionally clear credentials and token
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const clearCreds = (await rl.question('Clear saved credentials from keychain? [y/N]: ')).trim().toLowerCase();
    if (clearCreds === 'y') {
      await clearCredentials();
      console.log('Credentials cleared.');
    }

    const clearToken = (await rl.question('Clear stored token from keychain? [y/N]: ')).trim().toLowerCase();
    if (clearToken === 'y') {
      const store = new KeychainTokenStore(KEYCHAIN_SERVICE);
      await store.clear();
      console.log('Token cleared.');
    }
  } finally {
    rl.close();
  }

  console.log('Uninstall complete.');
}
