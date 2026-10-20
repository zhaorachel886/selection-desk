export type ProviderId = 'codex' | 'api';
export type Selection = { id: string; text: string; program: string; capturedAt: number; point?: { x: number; y: number }; method?: string };
export type Message = { role: 'user' | 'assistant'; content: string };
export type AnswerRequest = { sessionId: string; selection: Selection; messages: Message[]; signal: AbortSignal; onEvent: (event: AnswerEvent) => void };
export type AnswerEvent = { type: 'delta'; text: string } | { type: 'status'; text: string };
export interface AnswerProvider { id: ProviderId; answer(request: AnswerRequest): Promise<void>; check(): Promise<string>; dispose(): void; }
export type Settings = {
  provider: ProviderId; targetLanguage: string; clipboardFallback: boolean;
  shortcut: string; excludedApps: string[]; startAtLogin: boolean;
  codexPath: string; apiBaseUrl: string; apiModel: string;
};
export const defaultSettings: Settings = {
  provider: 'codex', targetLanguage: '简体中文', clipboardFallback: false,
  shortcut: 'CommandOrControl+Shift+Space', excludedApps: [], startAtLogin: false,
  codexPath: 'codex', apiBaseUrl: 'https://api.openai.com/v1', apiModel: ''
};
export type Conversation = { id: string; selection: Selection; messages: Message[]; status: 'idle' | 'running' | 'error' | 'cancelled'; error?: string; pinned: boolean; provider: ProviderId };
export type ShareRequest = { id: string; client: string; selection: Selection; expiresAt: number };
export type AppState = { selection?: Selection; pendingSelection?: Selection; conversation?: Conversation; shareRequests: ShareRequest[]; settings: Settings; hasApiKey: boolean; hookStatus: string; connectionStatus: string; view: 'toolbar' | 'conversation' | 'settings' | 'consent' };
export type Action =
  | { type: 'translate' }
  | { type: 'ask'; text: string }
  | { type: 'open-question' }
  | { type: 'stop' | 'retry' | 'close' | 'settings' | 'back' | 'use-pending' | 'clear-key' }
  | { type: 'pin'; value: boolean }
  | { type: 'save-settings'; settings: Settings; apiKey?: string }
  | { type: 'consent'; requestId: string; allow: boolean }
  | { type: 'check-provider' }
  | { type: 'export-connector'; client: 'Codex' | 'WorkBuddy' | '千问办公'; transport: 'stdio' | 'http' }
  | { type: 'copy'; text: string };
export interface DesktopBridge { getState(): Promise<AppState>; dispatch(action: Action): Promise<{ ok: boolean; message?: string }>; onState(callback: (state: AppState) => void): () => void; }
declare global { interface Window { desktop: DesktopBridge; } }
