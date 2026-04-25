# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-04-25

### Added
- `schwab-auth install` — interactive setup: credentials, HTTPS certs, OAuth flow, launchd plist install
- `schwab-auth login` — re-authenticate with Schwab via browser OAuth flow
- `schwab-auth logout` — clear stored token from keychain
- `schwab-auth configure` — update stored API credentials with optional immediate re-auth
- `schwab-auth status` — display current token state and refresh token expiry countdown
- `schwab-auth daemon` — background token refresh loop (used internally by launchd)
- `schwab-auth uninstall` — stop and remove daemon, optionally clear keychain credentials
- `KeychainTokenStore` — exported class for consumer apps to read the shared token via `createDelegatedAuth()`
- macOS notification when refresh token nears expiry (7-day window)
- `SCHWAB_KEYCHAIN_SERVICE` and `SCHWAB_REFRESH_INTERVAL_MS` env var overrides

[0.1.1]: https://github.com/MisterPea/schwab-auth-daemon/releases/tag/v0.1.1
