import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { can, del, download, get, post, qs, type S } from '../api/client'
import { useAuth } from '../auth-context'
import { EntryForm } from '../components/EntryForm'
import { EMPTY, STATUS_LABEL, toForm, type Form } from '../lib/entry'
import { Btn, Card, ErrorText, Modal } from '../components/ui'
import { fmtDate, input } from '../lib/ui'

type Entry = S['GlossaryOut']
const STATUS_CLS: Record<string, string> = {
  approved: 'text-green-700',
  draft: 'text-amber-700',
  rejected: 'text-red-700',
}

export default function Glossary() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [f, setF] = useState({ q: '', status: '', category: '' })
  const [edit, setEdit] = useState<{ id?: number; form: Form } | null>(null)
  const [versions, setVersions] = useState<Entry | null>(null)
  const [note, setNote] = useState('')
  const { data: entries = [] } = useQuery({
    queryKey: ['glossary', f],
    queryFn: () => get<Entry[]>(`/glossary${qs(f)}`),
  })
  const { data: vers = [] } = useQuery({
    queryKey: ['glossary-versions', versions?.id],
    queryFn: () => get<S['GlossaryVersionOut'][]>(`/glossary/${String(versions?.id)}/versions`),
    enabled: !!versions,
  })
  const refresh = (): Promise<void> => qc.invalidateQueries({ queryKey: ['glossary'] })
  const act = useMutation({
    mutationFn: ({ id, status }: { id: number; status?: string }) =>
      status ? post(`/glossary/${id}/status?status=${status}`) : del(`/glossary/${id}`),
    onSuccess: refresh,
  })
  const imp = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return post<S['ImportResult']>('/glossary/import/xlsx', fd)
    },
    onSuccess: async (r) => {
      setNote(
        `Import: ${String(r.created)} neu, ${String(r.updated)} aktualisiert, ${String(r.skipped)} übersprungen (Dubletten/ungültig).`,
      )
      await refresh()
    },
  })
  const scan = useMutation({
    mutationFn: () => get<S['DuplicateGroup'][]>('/glossary/duplicates/scan'),
    onSuccess: (g) => {
      setNote(
        g.length ? `Dubletten: ${g.map((x) => `„${x.term}“ (${x.lang})`).join(', ')}` : 'Keine Dubletten gefunden ✔',
      )
    },
  })
  const set =
    (k: keyof typeof f) =>
    (e: { target: { value: string } }): void => {
      setF({ ...f, [k]: e.target.value })
    }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Glossar</h1>
        <div className="flex flex-wrap gap-2">
          <Btn
            onClick={() => {
              scan.mutate()
            }}
          >
            Dublettenprüfung
          </Btn>
          <Btn
            onClick={() => {
              void download('/glossary/export/xlsx', 'glossar.xlsx')
            }}
          >
            Export Excel
          </Btn>
          {can(user, 'reviewer') && <Btn onClick={() => fileRef.current?.click()}>Import Excel</Btn>}
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) imp.mutate(file)
              e.target.value = ''
            }}
          />
          <Btn
            variant="primary"
            onClick={() => {
              setEdit({ form: EMPTY })
            }}
          >
            + Begriff
          </Btn>
        </div>
      </div>
      {note && <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-800">{note}</p>}
      <ErrorText error={imp.error ?? act.error} />
      <Card className="grid gap-2 md:grid-cols-3">
        <input
          className={input}
          aria-label="Suche"
          placeholder="Suche (Begriff, Synonym, Beschreibung)"
          value={f.q}
          onChange={set('q')}
        />
        <select aria-label="Status" className={input} value={f.status} onChange={set('status')}>
          <option value="">Status: alle</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select aria-label="Kategorie" className={input} value={f.category} onChange={set('category')}>
          <option value="">Kategorie: alle</option>
          <option value="technical">Fachbegriff</option>
          <option value="product">Produktname</option>
        </select>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              {['Deutsch', 'Englisch', 'Synonyme', 'Beschreibung', 'Status', 'Version', ''].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((e) => (
              <tr key={e.id} className="align-top hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{e.terms['de']}</td>
                <td className="px-3 py-2 font-medium">
                  {e.do_not_translate ? <em className="text-purple-700">nicht übersetzen</em> : e.terms['en']}
                </td>
                <td className="px-3 py-2 text-slate-600">{Object.values(e.synonyms).flat().join(', ')}</td>
                <td className="px-3 py-2 text-slate-600">{e.description}</td>
                <td className={`px-3 py-2 ${STATUS_CLS[e.status] ?? ''}`}>{STATUS_LABEL[e.status] ?? e.status}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-blue-700 hover:underline"
                    onClick={() => {
                      setVersions(e)
                    }}
                  >
                    v{e.version}
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {can(user, 'reviewer') && (
                    <>
                      {e.status !== 'approved' && (
                        <Btn
                          variant="ghost"
                          onClick={() => {
                            act.mutate({ id: e.id, status: 'approved' })
                          }}
                        >
                          Freigeben
                        </Btn>
                      )}
                      <Btn
                        variant="ghost"
                        onClick={() => {
                          setEdit({ id: e.id, form: toForm(e) })
                        }}
                      >
                        Bearbeiten
                      </Btn>
                    </>
                  )}
                  {can(user, 'admin') && (
                    <Btn
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm('Begriff löschen?')) act.mutate({ id: e.id })
                      }}
                    >
                      Löschen
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {edit && (
        <Modal
          title={edit.id ? 'Begriff bearbeiten' : 'Neuer Glossarbegriff'}
          onClose={() => {
            setEdit(null)
          }}
          wide
        >
          <EntryForm
            initial={edit.form}
            id={edit.id}
            onDone={() => {
              setEdit(null)
              void refresh()
            }}
          />
          {!can(user, 'reviewer') && (
            <p className="mt-2 text-xs text-slate-600">
              Neue Begriffe von Übersetzern sind Entwürfe und werden von einem Prüfer freigegeben.
            </p>
          )}
        </Modal>
      )}
      {versions && (
        <Modal
          title={`Versionen: ${versions.terms['de'] ?? ''}`}
          onClose={() => {
            setVersions(null)
          }}
        >
          <ul className="divide-y text-sm">
            {vers.map((v) => (
              <li key={v.id} className="py-2">
                <strong>v{v.entry_version}</strong> · {v.action} · {v.changed_by} · {fmtDate(v.changed_at)}
                <div className="text-slate-600">
                  {Object.values(v.data['terms'] as Record<string, string>).join(' → ')} ({String(v.data['status'])})
                </div>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  )
}
