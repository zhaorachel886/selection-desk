import { z } from 'zod';
export const settingsSchema = z.object({
  provider: z.enum(['codex', 'api']), targetLanguage: z.string().trim().min(1).max(40),
  clipboardFallback: z.boolean(), shortcut: z.string().trim().min(1).max(80),
  excludedApps: z.array(z.string().trim().min(1).max(100)).max(100), startAtLogin: z.boolean(),
  codexPath: z.string().trim().min(1).max(1000), apiBaseUrl: z.string().url().max(2000).refine(value => {
    const url = new URL(value);
    return !url.username && !url.password && (url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  }, '模型地址必须为 HTTPS，本机服务可使用 HTTP'), apiModel: z.string().trim().max(200)
}).strict();
export const actionSchema = z.discriminatedUnion('type', [
  ...(['translate', 'open-question', 'stop', 'retry', 'close', 'settings', 'back', 'use-pending', 'clear-key', 'check-provider'] as const).map(type => z.object({ type: z.literal(type) }).strict()),
  z.object({ type: z.literal('ask'), text: z.string().trim().min(1).max(20_000) }).strict(),
  z.object({ type: z.literal('pin'), value: z.boolean() }).strict(),
  z.object({ type: z.literal('save-settings'), settings: settingsSchema, apiKey: z.string().max(4096).optional() }).strict(),
  z.object({ type: z.literal('consent'), requestId: z.string().uuid(), allow: z.boolean() }).strict(),
  z.object({ type: z.literal('export-connector'), client: z.enum(['Codex', 'WorkBuddy', '千问办公']), transport: z.enum(['stdio', 'http']) }).strict(),
  z.object({ type: z.literal('copy'), text: z.string().max(500_000) }).strict()
] as unknown as [z.ZodDiscriminatedUnionOption<'type'>, ...z.ZodDiscriminatedUnionOption<'type'>[]]);
