/** Texts of the settings feature (namespace `settings`). German is the reference: `en.ts` must have the same keys. */
export const de = {
  title: 'Einstellungen',
  adminOnly: 'Nur Administratoren können Einstellungen ändern.',
  aiCard: 'KI-Modell & Schnittstellen',
  provider: 'Provider',
  providers: { gemini: 'Google Gemini (API)' },
  model: 'Modell',
  offlineMock:
    'Der Server läuft im Offline-Testmodus (LLM_PROVIDER=mock): Übersetzt werden nur einzelne bekannte Wörter, die Auswahl unten wird nicht verwendet.',
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
