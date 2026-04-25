# schwab-auth-daemon

> **macOS only.** The background daemon uses launchd and macOS Keychain. Windows and Linux are not currently supported.

CLI and background daemon for centralized Schwab OAuth token management across multiple [`@misterpea/schwab-node`](https://github.com/MisterPea/schwab-node) consumers.

## The Problem

Schwab allows **one active OAuth session per account**. Multiple services each managing their own auth will invalidate each other's tokens.

## The Solution

Split auth responsibilities cleanly:

- **`schwab-auth login`** — interactive OAuth in your terminal. Opens browser, completes auth, stores token in the system keychain. Run this whenever auth is needed.
- **`schwab-auth daemon`** — silent background process. Refreshes the access token on a timer using the stored refresh token. Never opens a browser. Alerts you via macOS notification when the refresh token is nearing expiry.

```
┌──────────────────────────────────────┐
│  schwab-auth daemon  (launchd)       │
│  • reads token from keychain         │
│  • refreshes access token silently   │
│  • notifies you when re-auth needed  │
└──────────────────┬───────────────────┘
                   │ keychain
       ┌───────────┴───────────┐
       ▼                       ▼
   Service A              Service B
   createDelegatedAuth()  createDelegatedAuth()
   reads keychain         reads keychain
```

## Setup

### 1. Install globally

```bash
npm install -g @misterpea/schwab-auth-daemon
```

### 2. Create a working directory and run install

```bash
mkdir my-schwab-daemon && cd my-schwab-daemon
schwab-auth install
```

`install` walks you through everything interactively:

1. Prompts for your Schwab API credentials (stored securely in the system keychain — no `.env` file needed)
2. Sets up local HTTPS certs and opens Schwab's OAuth page in your browser
3. Writes the launchd plist with correct absolute paths auto-detected
4. Loads and starts the background daemon

---

## CLI Reference

```bash
schwab-auth <command>
```

| Command | Description |
|---|---|
| `install` | Configure credentials, authenticate, and install the background daemon |
| `uninstall` | Stop the daemon, remove the launchd plist, optionally clear credentials and token |
| `configure` | Update stored Schwab API credentials (prompts to re-authenticate when done) |
| `login` | Re-authenticate with Schwab — opens browser, stores token in keychain |
| `logout` | Clear stored token from keychain |
| `status` | Show current token status and time until refresh token expires |
| `daemon` | Start the background refresh daemon (used internally by launchd) |

### Updating credentials

If your Schwab app credentials change:

```bash
schwab-auth configure
```

Prompts for each field — press Enter to keep the current value. When done, you'll be asked whether to re-authenticate immediately. The daemon picks up the new token on its next tick without a restart.

### Re-authenticating

The refresh token is valid for 7 days. When it nears expiry, the daemon sends a macOS notification. To re-authenticate:

```bash
schwab-auth login
```

The daemon picks up the new token on its next tick — no restart needed.

### Uninstalling

```bash
schwab-auth uninstall
```

Stops and removes the daemon. Prompts whether to also clear credentials and token from the keychain.

### Scheduling (run only during certain hours)

By default the daemon runs continuously (`KeepAlive: true`). To restrict it to specific hours — for example US market hours — create two additional plists: one to start, one to stop.

**`~/Library/LaunchAgents/com.schwab-auth-daemon.start.plist`**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.schwab-auth-daemon.start</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/launchctl</string>
    <string>kickstart</string>
    <string>gui/YOUR_UID/com.schwab-auth-daemon</string>
  </array>

  <!-- Weekdays at 9:25 AM local time -->
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>25</integer></dict>
    <dict><key>Weekday</key><integer>2</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>25</integer></dict>
    <dict><key>Weekday</key><integer>3</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>25</integer></dict>
    <dict><key>Weekday</key><integer>4</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>25</integer></dict>
    <dict><key>Weekday</key><integer>5</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>25</integer></dict>
  </array>
</dict>
</plist>
```

**`~/Library/LaunchAgents/com.schwab-auth-daemon.stop.plist`**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.schwab-auth-daemon.stop</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/launchctl</string>
    <string>kill</string>
    <string>SIGTERM</string>
    <string>gui/YOUR_UID/com.schwab-auth-daemon</string>
  </array>

  <!-- Weekdays at 5:00 PM local time -->
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>17</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Weekday</key><integer>2</integer><key>Hour</key><integer>17</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Weekday</key><integer>3</integer><key>Hour</key><integer>17</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Weekday</key><integer>4</integer><key>Hour</key><integer>17</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Weekday</key><integer>5</integer><key>Hour</key><integer>17</integer><key>Minute</key><integer>0</integer></dict>
  </array>
</dict>
</plist>
```

Replace `YOUR_UID` with the output of `id -u`. Times are in your **local timezone** — adjust if needed to account for EST/EDT offset.

Load both plists:
```bash
launchctl load ~/Library/LaunchAgents/com.schwab-auth-daemon.start.plist
launchctl load ~/Library/LaunchAgents/com.schwab-auth-daemon.stop.plist
```

> **Note:** `KeepAlive: true` in the main plist means launchd will restart the daemon if it crashes — but a clean SIGTERM stop (from the stop plist) is not treated as a crash, so the daemon stays stopped until the start plist fires again.

---

## In Your Other Services

```typescript
import { createDelegatedAuth } from '@misterpea/schwab-node';
import { KeychainTokenStore } from '@misterpea/schwab-auth-daemon';

const auth = createDelegatedAuth(new KeychainTokenStore('schwab-node'));
```

The service reads the token the daemon keeps fresh — no credentials, no refresh logic, no browser prompts.

---

## Environment Variables

All optional. Credentials are stored in the keychain after `schwab-auth install`.

| Variable | Default | Description |
|---|---|---|
| `SCHWAB_KEYCHAIN_SERVICE` | `schwab-node` | Keychain namespace — must match `new KeychainTokenStore()` in all consumer apps |
| `SCHWAB_REFRESH_INTERVAL_MS` | `1200000` | Daemon refresh interval in ms. Keep under 30 min (access token lifetime). |

---

## Disclaimer

This tool manages OAuth authentication only. It is not financial advice and carries no liability for financial losses, missed trades, or API interruptions. See [DISCLAIMER.md](DISCLAIMER.md) for full details.
