import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { defaultSettings, type Settings } from '../shared/types';
import { settingsSchema } from './validation';

type CryptoStore = { isEncryptionAvailable(): boolean; encryptString(text: string): Buffer; decryptString(value: Buffer): string };
type Stored = { version: 1; settings: Settings; apiKey: string; clients: Record<string, string> };
export class Preferences {
  readonly loaded: boolean;
  private data: Stored = { version: 1, settings: { ...defaultSettings }, apiKey: '', clients: {} };
  constructor(private readonly directory: string, private readonly crypto: CryptoStore) {
    const file = join(directory, 'preferences.enc');
    this.loaded = existsSync(file);
    if (existsSync(file)) {
      try {
        const data = JSON.parse(crypto.decryptString(readFileSync(file)));
        if (data.version !== 1 || typeof data.apiKey !== 'string' || !data.clients || Object.entries(data.clients).some(([name, token]) => !['Codex', 'WorkBuddy', '千问办公'].includes(name) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))) throw new Error('invalid');
        this.data = { version: 1, settings: settingsSchema.parse(data.settings), apiKey: data.apiKey, clients: data.clients };
      } catch { throw new Error('无法解密或读取设置，请保留 preferences.enc 并检查当前 Windows 用户。'); }
    }
  }
  settings(): Settings { return structuredClone(this.data.settings); }
  apiKey() { return this.data.apiKey; }
  private write(next: Stored) {
    if (!this.crypto.isEncryptionAvailable()) throw new Error('系统加密存储不可用，无法保存设置或密钥。');
    mkdirSync(this.directory, { recursive: true });
    const file = join(this.directory, 'preferences.enc');
    writeFileSync(file + '.tmp', this.crypto.encryptString(JSON.stringify(next)));
    renameSync(file + '.tmp', file); this.data = next;
  }
  save(settings: Settings, apiKey?: string) { this.write({ ...this.data, settings: settingsSchema.parse(settings), apiKey: apiKey === undefined ? this.data.apiKey : apiKey }); }
  token(client: string): string {
    if (!['Codex', 'WorkBuddy', '千问办公'].includes(client)) throw new Error('未知连接器');
    if (this.data.clients[client]) return this.data.clients[client];
    const token = randomBytes(32).toString('hex');
    this.write({ ...this.data, clients: { ...this.data.clients, [client]: token } });
    return token;
  }
  authenticate(token: string): string | undefined {
    if (!/^[a-f0-9]{64}$/.test(token)) return;
    return Object.entries(this.data.clients).find(([, stored]) => timingSafeEqual(Buffer.from(token), Buffer.from(stored)))?.[0];
  }
}
