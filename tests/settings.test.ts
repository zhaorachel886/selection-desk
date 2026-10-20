import { expect, it } from 'vitest';
import { actionSchema, settingsSchema } from '../src/main/validation';
import { defaultSettings } from '../src/shared/types';
it('rejects insecure remote model endpoints and unexpected IPC fields', () => {
  expect(settingsSchema.safeParse({ ...defaultSettings, apiBaseUrl: 'http://example.com/v1' }).success).toBe(false);
  expect(settingsSchema.safeParse({ ...defaultSettings, apiBaseUrl: 'http://127.0.0.1:11434/v1' }).success).toBe(true);
  expect(settingsSchema.safeParse({ ...defaultSettings, apiBaseUrl: 'https://user:password@example.com/v1' }).success).toBe(false);
  expect(actionSchema.safeParse({ type: 'close', command: 'calc.exe' }).success).toBe(false);
  expect(actionSchema.safeParse({ type: 'export-connector', client: 'attacker', transport: 'http' }).success).toBe(false);
});
