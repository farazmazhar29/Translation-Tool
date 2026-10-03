import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CATEGORIES, can, put, type S } from '../api/client'
import { useAuth } from '../auth-context'
import { Btn, Card, ErrorText, Label } from '../components/ui'
import { input, useSettings } from '../lib/ui'

export default function Settings() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const loaded = useSettings()
  const [draft, setS] = useState<S['SettingsOut'] | null>(null)
  const s = draft ?? loaded
  const save = useMutation({
    mutationFn: (v: S['SettingsOut']) => put<S['SettingsOut']>('/settings', { ...v }),
    onSuccess: (v) => {
      qc.setQueryData(['settings'], v)
    },
  })
  if (!s) return <p className="text-slate-600">Laden …</p>
  const admin = can(user, 'admin')
  const patch = (p: Partial<S['SettingsOut']>): void => {
    setS({ ...s, ...p })
  }
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Einstellungen</h1>
      {!admin && (
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nur Administratoren können Einstellungen ändern.
        </p>
      )}
      <Card title="KI-Modell & Schnittstellen" className="space-y-3">
        <Label text="Provider">
          <select
            className={input}
            disabled={!admin}
            value={s.llm_provider}
            onChange={(e) => {
              patch({ llm_provider: e.target.value })
            }}
          >
            <option value="gemini">Google Gemini (API)</option>
            <option value="mock">Mock (offline, nur Test)</option>
          </select>
        </Label>
        <Label text="Modell">
          <input
            className={input}
            disabled={!admin}
            value={s.llm_model}
            onChange={(e) => {
              patch({ llm_model: e.target.value })
            }}
          />
        </Label>
        <p className="text-xs text-slate-600">
          API-Schlüssel:{' '}
          {s.gemini_key_configured
            ? '✔ Gemini-Key ist serverseitig konfiguriert'
            : '✖ GEMINI_API_KEY fehlt in der .env'}
          . Weitere Schnittstellen (z. B. DeepL) lassen sich über die Provider-Schicht ergänzen.
        </p>
      </Card>
      <Card title="Standardwerte" className="grid gap-3 md:grid-cols-2">
        <Label text="Standard-Export">
          <select
            className={input}
            disabled={!admin}
            value={s.default_export_format}
            onChange={(e) => {
              patch({ default_export_format: e.target.value })
            }}
          >
            <option value="docx">Word</option>
            <option value="xlsx">Excel</option>
            <option value="pdf">PDF</option>
          </select>
        </Label>
        <Label text="Export-Inhalt">
          <select
            className={input}
            disabled={!admin}
            value={s.default_export_mode}
            onChange={(e) => {
              patch({ default_export_mode: e.target.value })
            }}
          >
            <option value="translation">Nur Übersetzung</option>
            <option value="both">Original + Übersetzung</option>
          </select>
        </Label>
        <Label text="Standard-Zielsprache">
          <select
            className={input}
            disabled={!admin}
            value={s.default_target_langs[0] ?? 'en'}
            onChange={(e) => {
              patch({ default_target_langs: [e.target.value] })
            }}
          >
            <option value="en">Englisch</option>
            <option value="de">Deutsch</option>
          </select>
        </Label>
      </Card>
      <Card title="Farben der Hervorhebung" className="grid gap-3 md:grid-cols-2">
        {Object.entries(CATEGORIES).map(([k, label]) => (
          <label key={k} className="flex items-center gap-3 text-sm">
            <input
              type="color"
              disabled={!admin}
              value={s.colors[k] ?? '#999999'}
              onChange={(e) => {
                patch({ colors: { ...s.colors, [k]: e.target.value } })
              }}
            />
            {label}
          </label>
        ))}
      </Card>
      <ErrorText error={save.error} />
      {admin && (
        <Btn
          variant="primary"
          disabled={save.isPending}
          onClick={() => {
            save.mutate(s)
          }}
        >
          {save.isSuccess ? 'Gespeichert ✔' : 'Speichern'}
        </Btn>
      )}
    </div>
  )
}
