import type { Texts } from '@/shared/i18n'
import type { de } from './de'

export const en: Texts<typeof de> = {
  title: 'Settings',
  adminOnly: 'Only administrators can change settings.',
  aiCard: 'AI model & interfaces',
  provider: 'Provider',
  providers: { gemini: 'Google Gemini (API)', mock: 'Mock (offline, test only)' },
  model: 'Model',
  noModel: 'The offline mode needs no model.',
  apiKey: 'API key: {{status}}. Further interfaces (e.g. DeepL) can be added via the provider layer.',
  keyConfigured: '✔ Gemini key is configured on the server',
  keyMissing: '✖ GEMINI_API_KEY is missing in the .env',
  defaultsCard: 'Defaults',
  defaultExport: 'Default export',
  exportContent: 'Export content',
  colorsCard: 'Highlight colours',
  saved: 'Saved ✔',
}
