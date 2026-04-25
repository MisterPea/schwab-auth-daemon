import keytar from 'keytar';
import type { TokenSet, TokenStore } from '@misterpea/schwab-node';

export class KeychainTokenStore implements TokenStore {
  constructor(
    private readonly service: string,
    private readonly account = 'tokens',
  ) {}

  async load(): Promise<TokenSet | null> {
    const raw = await keytar.getPassword(this.service, this.account);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TokenSet;
    } catch {
      return null;
    }
  }

  async save(tokens: TokenSet): Promise<void> {
    await keytar.setPassword(this.service, this.account, JSON.stringify(tokens));
  }

  async clear(): Promise<void> {
    await keytar.deletePassword(this.service, this.account);
  }
}
