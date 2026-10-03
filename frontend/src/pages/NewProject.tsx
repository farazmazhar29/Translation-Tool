import { useMutation } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LANGS, post, type Lang, type S } from '../api/client'
import { Btn, Card, ErrorText, Label } from '../components/ui'
import { input, useSettings } from '../lib/ui'

export default function NewProject() {
  const navigate = useNavigate()
  const settings = useSettings()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [customer, setCustomer] = useState('')
  const [source, setSource] = useState('auto')
  const [targets, setTargets] = useState<Lang[]>([])
  const m = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      if (file) fd.append('file', file)
      fd.append('name', name)
      fd.append('customer', customer)
      fd.append('source_lang', source)
      fd.append('target_langs', targets.join(','))
      return post<S['ProjectOut']>('/projects', fd)
    },
    onSuccess: (p) => void navigate(`/projects/${p.id}`),
  })
  const submit = (e: SubmitEvent): void => {
    e.preventDefault()
    m.mutate()
  }
  const toggle = (l: Lang): void => {
    setTargets(targets.includes(l) ? targets.filter((t) => t !== l) : [...targets, l])
  }
  const chosen = targets.length ? targets : (settings?.default_target_langs ?? [])

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Neues Übersetzungsprojekt</h1>
      <Card>
        <label
          className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center focus-within:border-red-600 hover:border-red-400"
          onDragOver={(e) => {
            e.preventDefault()
          }}
          onDrop={(e) => {
            e.preventDefault()
            setFile(e.dataTransfer.files[0] ?? null)
          }}
        >
          <input
            type="file"
            className="sr-only"
            accept=".docx,.xlsx,.pdf"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
            }}
          />
          {file ? <strong>{file.name}</strong> : 'Datei hierher ziehen oder klicken (Word, Excel, PDF)'}
        </label>
        <p className="mt-2 text-xs text-slate-600">
          Nach dem Upload werden Text, Struktur und Sprache automatisch erkannt. InDesign folgt in Phase 2.
        </p>
      </Card>
      <Card className="grid gap-3 md:grid-cols-2">
        <Label text="Projektname (optional)">
          <input
            className={input}
            value={name}
            placeholder="Standard: Dateiname"
            onChange={(e) => {
              setName(e.target.value)
            }}
          />
        </Label>
        <Label text="Kunde">
          <input
            className={input}
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value)
            }}
          />
        </Label>
        <Label text="Ausgangssprache">
          <select
            className={input}
            value={source}
            onChange={(e) => {
              setSource(e.target.value)
            }}
          >
            <option value="auto">Automatisch erkennen</option>
            {Object.entries(LANGS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Zielsprache(n)">
          <div className="flex gap-4 py-1.5">
            {(Object.entries(LANGS) as [Lang, string][]).map(([k, v]) => (
              <label key={k} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.includes(k)}
                  onChange={() => {
                    toggle(k)
                  }}
                />{' '}
                {v}
              </label>
            ))}
          </div>
        </Label>
      </Card>
      <ErrorText error={m.error} />
      <Btn variant="primary" type="submit" disabled={!file || m.isPending}>
        {m.isPending ? 'Wird analysiert …' : 'Projekt anlegen'}
      </Btn>
    </form>
  )
}
