/** Texts of the settings feature (namespace `settings`). German is the reference: `en.ts` must have the same keys. */
export const de = {
  title: 'Einstellungen',
  adminOnly: 'Nur Administratoren können Einstellungen ändern.',
  aiCard: 'KI-Modell & Schnittstellen',
  provider: 'Provider',
  providers: { gemini: 'Google Gemini (API)', mock: 'Mock (offline, nur Test)' },
  model: 'Modell',
  apiKey:
    'API-Schlüssel: {{status}}. Weitere Schnittstellen (z. B. DeepL) lassen sich über die Provider-Schicht ergänzen.',
  keyConfigured: '✔ Gemini-Key ist serverseitig konfiguriert',
  keyMissing: '✖ GEMINI_API_KEY fehlt in der .env',
  defaultsCard: 'Standardwerte',
  defaultExport: 'Standard-Export',
  exportContent: 'Export-Inhalt',
  colorsCard: 'Farben der Hervorhebung',
  saved: 'Gespeichert ✔',
}
