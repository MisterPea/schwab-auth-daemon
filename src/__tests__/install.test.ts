import { describe, it, expect } from 'vitest';
import { generatePlist } from '../install.js';

const NODE = '/usr/local/bin/node';
const SCHWAB_AUTH = '/usr/local/bin/schwab-auth';
const WORK_DIR = '/Users/someone/schwab-daemon';
const LOG_DIR = '/Users/someone/schwab-daemon/logs';

describe('generatePlist', () => {
  it('contains correct label', () => {
    const plist = generatePlist(WORK_DIR, LOG_DIR, NODE, SCHWAB_AUTH);
    expect(plist).toContain('<string>com.schwab-auth-daemon</string>');
  });

  it('contains node and schwab-auth paths', () => {
    const plist = generatePlist(WORK_DIR, LOG_DIR, NODE, SCHWAB_AUTH);
    expect(plist).toContain(`<string>${NODE}</string>`);
    expect(plist).toContain(`<string>${SCHWAB_AUTH}</string>`);
  });

  it('contains daemon subcommand', () => {
    const plist = generatePlist(WORK_DIR, LOG_DIR, NODE, SCHWAB_AUTH);
    expect(plist).toContain('<string>daemon</string>');
  });

  it('contains working directory', () => {
    const plist = generatePlist(WORK_DIR, LOG_DIR, NODE, SCHWAB_AUTH);
    expect(plist).toContain(`<string>${WORK_DIR}</string>`);
  });

  it('contains stdout and stderr log paths', () => {
    const plist = generatePlist(WORK_DIR, LOG_DIR, NODE, SCHWAB_AUTH);
    expect(plist).toContain(`${LOG_DIR}/daemon.log`);
    expect(plist).toContain(`${LOG_DIR}/daemon.error.log`);
  });

  it('has KeepAlive true', () => {
    const plist = generatePlist(WORK_DIR, LOG_DIR, NODE, SCHWAB_AUTH);
    const keepAliveIdx = plist.indexOf('<key>KeepAlive</key>');
    expect(plist.slice(keepAliveIdx)).toMatch(/<true\/>/);
  });

  it('reflects custom paths correctly', () => {
    const plist = generatePlist('/custom/work', '/custom/logs', '/custom/node', '/custom/schwab-auth');
    expect(plist).toContain('<string>/custom/node</string>');
    expect(plist).toContain('<string>/custom/schwab-auth</string>');
    expect(plist).toContain('<string>/custom/work</string>');
    expect(plist).toContain('/custom/logs/daemon.log');
  });
});
