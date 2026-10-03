import { useMutation } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import { ApiError, can, post, put, type S } from '../api/client'
import { useAuth } from '../auth-context'
import { STATUS_LABEL, toBody, type Form } from '../lib/entry'
import { input } from '../lib/ui'
import { Btn, ErrorText, Label } from './ui'

type Entry = S['GlossaryOut']

export function EntryForm({ initial, id, onDone }: { initial: Form; id?: number; onDone: () => void }) {
  const { user } = useAuth()
  const [f, setF] = useState(initial)
  const [force, setForce] = useState(false)
  const save = useMutation({
    mutationFn: () =>
      id ? put(`/glossary/${id}`, { ...toBody(f, force) }) : post('/glossary', { ...toBody(f, force) }),
    onSuccess: onDone,
  })
  const dups =
    save.error instanceof ApiError && save.error.status === 409
      ? (save.error.detail as { duplicates: Entry[] }).duplicates
      : []
  const patch = (p: Partial<Form>): void => {
    setF({ ...f, ...p })
  }
  const submit = (e: SubmitEvent): void => {
    e.preventDefault()
    save.mutate()
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Label text="Deutsch">
          <input
            className={input}
            value={f.de}
            onChange={(e) => {
              patch({ de: e.target.value })
            }}
          />
        </Label>
        <Label text="Englisch">
          <input
            className={input}
            value={f.en}
            disabled={f.dnt}
            onChange={(e) => {
              patch({ en: e.target.value })
            }}
          />
        </Label>
        <Label text="Synonyme DE (Trennung mit ;)">
          <input
            className={input}
            value={f.synDe}
            onChange={(e) => {
              patch({ synDe: e.target.value })
            }}
          />
        </Label>
        <Label text="Synonyme EN (Trennung mit ;)">
          <input
            className={input}
            value={f.synEn}
            onChange={(e) => {
              patch({ synEn: e.target.value })
            }}
          />
        </Label>
      </div>
      <Label text="Beschreibung">
        <textarea
          className={input}
          rows={2}
          value={f.description}
          onChange={(e) => {
            patch({ description: e.target.value })
          }}
        />
      </Label>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <select
          className={`${input} !w-auto`}
          value={f.category}
          onChange={(e) => {
            patch({ category: e.target.value as Form['category'] })
          }}
        >
          <option value="technical">Fachbegriff</option>
          <option value="product">Produktname</option>
        </select>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={f.dnt}
            onChange={(e) => {
              patch({ dnt: e.target.checked })
            }}
          />{' '}
          Nicht übersetzen
        </label>
        {can(user, 'reviewer') && (
          <select
            className={`${input} !w-auto`}
            value={f.status}
            onChange={(e) => {
              patch({ status: e.target.value as Form['status'] })
            }}
          >
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        )}
      </div>
      {dups.length > 0 && (
        <div className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Dublette gefunden:</strong>
          <ul className="list-disc pl-5">
            {dups.map((d) => (
              <li key={d.id}>{Object.values(d.terms).join(' → ')}</li>
            ))}
          </ul>
          <label className="mt-1 flex items-center gap-1">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => {
                setForce(e.target.checked)
              }}
            />{' '}
            Trotzdem speichern
          </label>
        </div>
      )}
      {!dups.length && <ErrorText error={save.error} />}
      <Btn variant="primary" type="submit" disabled={save.isPending}>
        Speichern
      </Btn>
    </form>
  )
}
