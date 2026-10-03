import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LANGS, STATUS, can, del, get, post, qs, type S } from '../api/client'
import { useAuth } from '../auth-context'
import { Btn, Card, StatusBadge } from '../components/ui'
import { fmtDate, input } from '../lib/ui'

type Filters = Record<
  'q' | 'status' | 'archived' | 'lang' | 'customer' | 'editor' | 'term' | 'date_from' | 'date_to',
  string
>

export default function Projects() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [f, setF] = useState<Filters>({
    q: '',
    status: params.get('status') ?? '',
    archived: 'no',
    lang: '',
    customer: '',
    editor: '',
    term: '',
    date_from: '',
    date_to: '',
  })
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', f],
    queryFn: () => get<S['ProjectOut'][]>(`/projects${qs(f)}`),
  })
  const { data: editors = [] } = useQuery({ queryKey: ['editors'], queryFn: () => get<string[]>('/users/names') })
  const refresh = (): Promise<void> => qc.invalidateQueries({ queryKey: ['projects'] })
  const act = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'archive' | 'unarchive' | 'copy' | 'delete' }) =>
      action === 'delete' ? del(`/projects/${id}`) : post(`/projects/${id}/${action}`),
    onSuccess: refresh,
  })
  const set =
    (k: keyof Filters) =>
    (e: { target: { value: string } }): void => {
      setF({ ...f, [k]: e.target.value })
    }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projekte</h1>
        <Link
          to="/projects/new"
          className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
        >
          + Neues Projekt
        </Link>
      </div>
      <Card>
        <div className="grid gap-2 md:grid-cols-4">
          <input
            className={input}
            aria-label="Suche"
            placeholder="Suche: Projekt, Datei, Kunde"
            value={f.q}
            onChange={set('q')}
          />
          <input
            className={input}
            aria-label="Begriff"
            placeholder="Begriff (Original/Übersetzung)"
            value={f.term}
            onChange={set('term')}
          />
          <input
            className={input}
            aria-label="Kunde"
            placeholder="Kunde"
            value={f.customer}
            onChange={set('customer')}
          />
          <select aria-label="Bearbeiter" className={input} value={f.editor} onChange={set('editor')}>
            <option value="">Bearbeiter: alle</option>
            {editors.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <select aria-label="Status" className={input} value={f.status} onChange={set('status')}>
            <option value="">Status: alle</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <select aria-label="Sprache" className={input} value={f.lang} onChange={set('lang')}>
            <option value="">Sprache: alle</option>
            {Object.entries(LANGS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            className={input}
            type="date"
            aria-label="Geändert von"
            title="Von"
            value={f.date_from}
            onChange={set('date_from')}
          />
          <input
            className={input}
            type="date"
            aria-label="Geändert bis"
            title="Bis"
            value={f.date_to}
            onChange={set('date_to')}
          />
        </div>
        <div className="mt-2 flex gap-3 text-sm">
          {[
            ['no', 'Aktive'],
            ['only', 'Archivierte'],
            ['all', 'Alle'],
          ].map(([v, l]) => (
            <label key={v} className="flex items-center gap-1">
              <input
                type="radio"
                checked={f.archived === v}
                onChange={() => {
                  setF({ ...f, archived: v ?? 'no' })
                }}
              />{' '}
              {l}
            </label>
          ))}
        </div>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              {['Projekt', 'Kunde', 'Datei', 'Sprachen', 'Status', 'Geändert', 'Erstellt von', ''].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">
                  <Link to={`/projects/${p.id}`} className="hover:text-red-700">
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{p.customer}</td>
                <td className="px-3 py-2 text-slate-600">{p.filename}</td>
                <td className="px-3 py-2 uppercase">
                  {(p.source_lang === 'auto' ? p.detected_lang : p.source_lang) || '?'} → {p.target_langs.join(', ')}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-3 py-2 text-slate-600">{fmtDate(p.updated_at)}</td>
                <td className="px-3 py-2">{p.created_by}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {can(user, 'translator') && (
                    <>
                      <Btn
                        variant="ghost"
                        onClick={() => {
                          act.mutate({ id: p.id, action: 'copy' })
                        }}
                      >
                        Kopieren
                      </Btn>
                      <Btn
                        variant="ghost"
                        onClick={() => {
                          act.mutate({ id: p.id, action: p.archived ? 'unarchive' : 'archive' })
                        }}
                      >
                        {p.archived ? 'Wiederherstellen' : 'Archivieren'}
                      </Btn>
                    </>
                  )}
                  {can(user, 'admin') && (
                    <Btn
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`„${p.name}“ löschen?`)) act.mutate({ id: p.id, action: 'delete' })
                      }}
                    >
                      Löschen
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && projects.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-600">
                  Keine Projekte gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
