import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Preferences } from '../src/main/preferences';
import { defaultSettings } from '../src/shared/types';
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe cleanup'); rmSync(dir, { recursive: true, force: true }); } });
function directory() { const dir = mkdtempSync(join(tmpdir(), 'selection-desk-')); dirs.push(dir); return dir; }
function encryption() {
  const key = randomBytes(32);
  return {
    isEncryptionAvailable: () => true,
    encryptString(text: string) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]); },
    decryptString(value: Buffer) { const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12)); decipher.setAuthTag(value.subarray(12, 28)); return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8'); }
  };
}
it('keeps independent client identities across restarts without storing plaintext credentials', () => {
  const dir = directory(), crypto = encryption();
  const prefs = new Preferences(dir, crypto);
  prefs.save(defaultSettings, 'fixture-private-key');
  const a = prefs.token('Codex'), b = prefs.token('WorkBuddy');
  expect(a).not.toBe(b);
  expect(prefs.authenticate(a)).toBe('Codex');
  expect(prefs.authenticate(b)).toBe('WorkBuddy');
  expect(prefs.authenticate('f'.repeat(64))).toBeUndefined();
  const restart = new Preferences(dir, crypto);
  expect(restart.token('Codex')).toBe(a);
  expect(restart.apiKey()).toBe('fixture-private-key');
  const stored = readFileSync(join(dir, 'preferences.enc'));
  expect(stored.includes(Buffer.from('fixture-private-key'))).toBe(false);
  expect(stored.includes(Buffer.from(a))).toBe(false);
});
it('fails closed on decryption failures and on unavailable protected storage', () => {
  const dir = directory(), crypto = encryption();
  new Preferences(dir, crypto).save(defaultSettings, 'key');
  const before = readFileSync(join(dir, 'preferences.enc'));
  expect(() => new Preferences(dir, encryption())).toThrow(/无法解密/);
  expect(readFileSync(join(dir, 'preferences.enc'))).toEqual(before);
  const unavailable = new Preferences(directory(), { ...crypto, isEncryptionAvailable: () => false });
  expect(() => unavailable.token('Codex')).toThrow(/加密存储不可用/);
  expect(unavailable.authenticate('a'.repeat(64))).toBeUndefined();
});
