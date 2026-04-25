#!/usr/bin/env node
import { login, logout } from './login.js';
import { startDaemon } from './daemon.js';
import { configure } from './configure.js';
import { install, uninstall } from './install.js';
import { KeychainTokenStore } from './KeychainTokenStore.js';

const KEYCHAIN_SERVICE = process.env.SCHWAB_KEYCHAIN_SERVICE ?? 'schwab-node';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const [, , command] = process.argv;

async function status(): Promise<void> {
  const store = new KeychainTokenStore(KEYCHAIN_SERVICE);
  const token = await store.load();

  if (!token) {
    console.log('No token found.');
    console.log('Run: schwab-auth login');
    return;
  }

  const age = Date.now() - token.refresh_obtained_at;
  const remaining = REFRESH_TOKEN_EXPIRY_MS - age;
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  console.log(`Keychain service : ${KEYCHAIN_SERVICE}`);

  if (remaining <= 0) {
    console.log('Refresh token    : EXPIRED');
    console.log('Action required  : schwab-auth login');
  } else if (remaining < NOTIFY_THRESHOLD_MS) {
    console.log(`Refresh token    : expires in ${days}d ${hours}h (renew soon)`);
    console.log('Recommendation   : schwab-auth login');
  } else {
    console.log(`Refresh token    : expires in ${days}d ${hours}h`);
    console.log('Status           : OK');
  }
}

const NOTIFY_THRESHOLD_MS = 48 * 60 * 60 * 1000;

switch (command) {
  case 'configure':
    await configure();
    break;

  case 'install':
    await install();
    break;

  case 'uninstall':
    await uninstall();
    break;

  case 'login':
    await login();
    break;

  case 'logout':
    await logout();
    break;

  case 'status':
    await status();
    break;

  case 'daemon':
    await startDaemon();
    break;

  default:
    console.log(`schwab-auth — macOS only (requires launchd and macOS Keychain)

Usage: schwab-auth <command>

Commands:
  install      Configure credentials, authenticate, and install the background daemon
  uninstall    Stop the daemon and remove it from launchd
  configure    Update stored Schwab API credentials
  login        Re-authenticate with Schwab (opens browser, stores token in keychain)
  logout       Clear stored token from keychain
  status       Show current token status and time until expiry
  daemon       Start the background token refresh daemon (used internally by launchd)

Environment variables (optional — credentials are stored in keychain after install):
  SCHWAB_KEYCHAIN_SERVICE    Keychain namespace for token storage  (default: schwab-node)
  SCHWAB_REFRESH_INTERVAL_MS Daemon refresh interval in ms         (default: 1200000)
`);
}
