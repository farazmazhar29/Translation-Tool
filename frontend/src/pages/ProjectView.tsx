import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CATEGORIES, LANGS, can, download, get, post, put, type Lang, type S } from '../api/client'
import { useAuth } from '../auth-context'
import { ExportDialog } from '../components/ExportDialog'
import { Highlighted } from '../components/Highlighted'
import { TermDialog } from '../components/TermDialog'
import { Btn, Card, ErrorText, Modal, StatusBadge } from '../components/ui'
import { fmtDate, input, useSettings } from '../lib/ui'

type Segment = S['SegmentOut']
const EDITABLE = ['new', 'preview_ready', 'in_review']
const SEV: Record<string, string> = {
  error: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-50 text-blue-800',
}

interface RowProps {
  seg: Segment
  lang: string
  editable: boolean
  onTerm: (seg: Segment, t: S['Term']) => void
  onSave: (seg: Segment, body: S['SegmentEdit']) => void
  onRegenerate: (seg: Segment) => void
  busy: boolean
}

function Row({ seg, lang, editable, onTerm, onSave, onRegenerate, busy }: RowProps) {
  const tr = seg.translations[lang]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? tr?.text ?? ''
  const [showComment, setShowComment] = useState(!!tr?.comment)
  const [comment, setComment] = useState(tr?.comment ?? '')
  const terms = tr?.terms ?? []
  const missing = terms.some((t) => !t.ok)
  return (
    <div id={`seg-${seg.idx}`} className={`grid gap-3 border-b p-3 md:grid-cols-2 ${missing ? 'bg-red-50/40' : ''}`}>
      <div>
        <span className="mb-1 block text-xs text-slate-600">#{seg.idx + 1}</span>
        <Highlighted
          text={seg.source_text}
          terms={terms}
          side="source"
          onTerm={(t) => {
            onTerm(seg, t)
          }}
        />
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold uppercase text-slate-600 md:hidden">Übersetzung</span>
        <div className="mb-1 flex items-center gap-2 text-xs text-slate-600">
          {tr?.edited && (
            <span className="rounded bg-amber-100 px-1.5 text-amber-800">bearbeitet von {tr.edited_by}</span>
          )}
          {editable && tr && (
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                className="hover:text-red-700"
                onClick={() => {
                  setEditing(!editing)
                }}
              >
                ✎ Bearbeiten
              </button>
              <button
                type="button"
                className="hover:text-red-700"
                disabled={busy}
                onClick={() => {
                  onRegenerate(seg)
                }}
              >
                ↻ Neu erzeugen
              </button>
              <button
                type="button"
                className="hover:text-red-700"
                onClick={() => {
                  setShowComment(!showComment)
                }}
              >
                💬 Kommentar
              </button>
            </span>
          )}
        </div>
        {!tr && <p className="text-sm italic text-slate-600">Noch nicht übersetzt</p>}
        {tr && editing ? (
          <div className="space-y-2">
            <textarea
              className={input}
              rows={Math.max(2, Math.ceil(text.length / 60))}
              value={text}
              onChange={(e) => {
                setDraft(e.target.value)
              }}
            />
            <div className="flex gap-2">
              <Btn
                variant="primary"
                onClick={() => {
                  onSave(seg, { text })
                  setDraft(null)
                  setEditing(false)
                }}
              >
                Übernehmen
              </Btn>
              <Btn
                onClick={() => {
                  setDraft(null)
                  setEditing(false)
                }}
              >
                Abbrechen
              </Btn>
            </div>
          </div>
        ) : (
          tr && (
            <Highlighted
              text={tr.text}
              terms={terms}
              side="target"
              onTerm={(t) => {
                onTerm(seg, t)
              }}
            />
          )
        )}
        {showComment && tr && (
          <textarea
            className={`${input} mt-2`}
            rows={2}
            placeholder="Kommentar …"
            disabled={!editable}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value)
            }}
            onBlur={() => {
              if (comment !== tr.comment) onSave(seg, { comment })
            }}
          />
        )}
      </div>
    </div>
  )
}

export default function ProjectView() {
  const id = Number(useParams()['id'])
  const { user } = useAuth()
  const qc = useQueryClient()
  const colors = useSettings()?.colors
  const [picked, setLang] = useState('')
  const [panel, setPanel] = useState<'quality' | 'history' | null>(null)
  const [dialog, setDialog] = useState<{ seg: Segment; term: S['Term'] } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [cfg, setCfg] = useState<{ src: string; targets: Lang[] } | null>(null)

  const { data: p, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => get<S['ProjectDetail']>(`/projects/${id}`),
    refetchInterval: (q) => (q.state.data?.job_state === 'running' ? 1500 : false),
  })
  const lang = p?.target_langs.includes(picked) ? picked : (p?.target_langs[0] ?? '')
  const {
    data: quality,
    refetch: refetchQuality,
    isFetching: qualityLoading,
  } = useQuery({
    queryKey: ['quality', id, lang],
    queryFn: () => get<S['QualityOut']>(`/projects/${id}/quality?lang=${lang}`),
    enabled: panel === 'quality' && !!lang,
  })
  const { data: history } = useQuery({
    queryKey: ['history', id],
    queryFn: () => get<S['HistoryOut']>(`/projects/${id}/history`),
    enabled: panel === 'history',
  })
  const refresh = async (): Promise<void> => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['project', id] }),
      qc.invalidateQueries({ queryKey: ['quality', id] }),
      qc.invalidateQueries({ queryKey: ['history', id] }),
    ])
  }
  const act = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: refresh })
  const call = (fn: () => Promise<unknown>): void => {
    act.mutate(fn)
  }

  if (error) return <ErrorText error={error} />
  if (!p) return <p className="text-slate-600">Laden …</p>

  const editable = EDITABLE.includes(p.status)
  const isTranslator = can(user, 'translator')
  const isReviewer = can(user, 'reviewer')
  const running = p.job_state === 'running'
  const hasTranslation = p.segments.some((s) => Object.keys(s.translations).length > 0)
  const src = cfg?.src ?? p.source_lang
  const targets = cfg?.targets ?? (p.target_langs as Lang[])
  const srcLang = p.source_lang === 'auto' ? p.detected_lang : p.source_lang
  const save = (seg: Segment, body: S['SegmentEdit']): void => {
    call(() => put(`/segments/${seg.id}/${lang}`, { ...body }))
  }
  const approve = async (): Promise<void> => {
    const q = await get<S['QualityOut']>(`/projects/${id}/quality`)
    const msg = q.warnings.length
      ? `Es gibt ${String(q.warnings.length)} Warnung(en), davon ${String(q.errors)} Fehler. Trotzdem freigeben?`
      : 'Übersetzung jetzt freigeben? Danach wird die finale Fassung gespeichert.'
    if (window.confirm(msg)) call(() => post(`/projects/${id}/approve`))
  }
  const toggleTarget = (l: Lang): void => {
    setCfg({ src, targets: targets.includes(l) ? targets.filter((t) => t !== l) : [...targets, l] })
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{p.name}</h1>
            <p className="text-sm text-slate-600">
              {p.filename} · {p.file_type.toUpperCase()} · {p.segments.length} Segmente
              {p.customer && ` · ${p.customer}`} · erstellt von {p.created_by}, {fmtDate(p.created_at)}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Erkannte Sprache: <strong>{p.detected_lang ? p.detected_lang.toUpperCase() : 'unklar'}</strong> ·
              Struktur:{' '}
              {Object.entries(p.structure)
                .filter(([, v]) => typeof v === 'number')
                .map(([k, v]) => `${String(v)} ${k}`)
                .join(', ')}
            </p>
          </div>
          <StatusBadge status={p.status} />
        </div>
        {editable && isTranslator && (
          <div className="mt-4 flex flex-wrap items-end gap-4 border-t pt-4">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-600">Ausgangssprache</span>
              <select
                className={`${input} !w-auto`}
                value={src}
                onChange={(e) => {
                  setCfg({ src: e.target.value, targets })
                }}
              >
                <option value="auto">Automatisch{p.detected_lang && ` (${p.detected_lang.toUpperCase()})`}</option>
                {Object.entries(LANGS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-sm">
              <span className="mb-1 block text-xs text-slate-600">Zielsprachen</span>
              <div className="flex gap-3 py-1.5">
                {(Object.entries(LANGS) as [Lang, string][]).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={targets.includes(k)}
                      onChange={() => {
                        toggleTarget(k)
                      }}
                    />{' '}
                    {v}
                  </label>
                ))}
              </div>
            </div>
            <Btn
              variant="primary"
              disabled={running || targets.length === 0}
              onClick={() => {
                if (
                  !hasTranslation ||
                  window.confirm('Bestehende Übersetzungen und manuelle Änderungen werden überschrieben. Fortfahren?')
                ) {
                  call(() => post(`/projects/${id}/translate`, { source_lang: src, target_langs: targets }))
                }
              }}
            >
              {hasTranslation ? 'Neu übersetzen' : 'Übersetzung starten'}
            </Btn>
            <span className="text-xs text-slate-600">Erzeugt zunächst nur eine Vorschau.</span>
          </div>
        )}
        {running && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded bg-slate-200">
              <div className="h-full bg-red-600 transition-all" style={{ width: `${String(p.job_progress)}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-600">Übersetzung läuft … {p.job_progress}%</p>
          </div>
        )}
        {p.job_state === 'error' && (
          <div className="mt-3">
            <ErrorText error={new Error(p.job_error)} />
          </div>
        )}
        <ErrorText error={act.error} />
      </Card>

      {hasTranslation && (
        <div className="flex flex-wrap items-center gap-2">
          {p.target_langs.length > 1 && (
            <div className="mr-2 flex overflow-hidden rounded-md border">
              {p.target_langs.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setLang(l)
                  }}
                  className={`px-3 py-1.5 text-sm ${l === lang ? 'bg-red-700 text-white' : 'bg-white'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          <Btn
            onClick={() => {
              setPanel(panel === 'quality' ? null : 'quality')
            }}
          >
            Qualitätsprüfung
          </Btn>
          <Btn
            onClick={() => {
              setPanel(panel === 'history' ? null : 'history')
            }}
          >
            Verlauf
          </Btn>
          {isTranslator && p.status === 'preview_ready' && (
            <Btn
              onClick={() => {
                call(() => post(`/projects/${id}/submit-review`))
              }}
            >
              Zur Prüfung senden
            </Btn>
          )}
          {isReviewer && p.status === 'in_review' && (
            <Btn
              variant="danger"
              onClick={() => {
                call(() => post(`/projects/${id}/reject`))
              }}
            >
              Zurückweisen
            </Btn>
          )}
          {isReviewer && (p.status === 'preview_ready' || p.status === 'in_review') && (
            <Btn
              variant="primary"
              onClick={() => {
                void approve()
              }}
            >
              Übersetzung freigeben
            </Btn>
          )}
          {(p.status === 'approved' || p.status === 'archived') && (
            <Btn
              variant="primary"
              onClick={() => {
                setExporting(true)
              }}
            >
              Exportieren
            </Btn>
          )}
          {isTranslator && (p.status === 'approved' || p.status === 'archived') && (
            <Btn
              onClick={() => {
                call(() => post(`/projects/${id}/reopen`))
              }}
            >
              Erneut öffnen
            </Btn>
          )}
          <Btn
            variant="ghost"
            onClick={() => {
              void download(`/projects/${id}/original`, p.filename)
            }}
          >
            Originaldatei
          </Btn>
          {isTranslator && !editable && (
            <span className="text-xs text-slate-600">Freigegeben – zum Bearbeiten erneut öffnen.</span>
          )}
        </div>
      )}

      {hasTranslation && (
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(CATEGORIES).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded"
                style={{ background: `${colors?.[k] ?? '#999'}55`, borderBottom: `2px solid ${colors?.[k] ?? '#999'}` }}
              />{' '}
              {label}
            </span>
          ))}
        </div>
      )}

      {panel === 'quality' && (
        <Card title="Qualitätsprüfung">
          <div className="mb-2 flex items-center gap-3 text-sm">
            <Btn
              onClick={() => {
                void refetchQuality()
              }}
            >
              Erneut prüfen
            </Btn>
            {qualityLoading
              ? 'Prüfe …'
              : quality &&
                `${String(quality.warnings.length)} Hinweis(e), ${String(quality.errors)} Fehler · Glossarversion ${String(quality.glossary_version)}`}
          </div>
          {quality?.warnings.length === 0 && <p className="text-sm text-green-700">✔ Keine Probleme gefunden.</p>}
          <ul className="space-y-1 text-sm">
            {quality?.warnings.map((w, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`w-full rounded px-2 py-1 text-left ${SEV[w.severity] ?? ''}`}
                  onClick={() =>
                    document
                      .getElementById(`seg-${String(w.idx)}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                >
                  <strong>{w.idx >= 0 ? `#${String(w.idx + 1)}` : '•'}</strong> {w.message}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {panel === 'history' && (
        <Card title="Projekthistorie">
          {history?.releases.length === 0 && <p className="text-sm text-slate-600">Noch keine Freigabe.</p>}
          <ul className="divide-y text-sm">
            {history?.releases.map((r) => (
              <li key={r.id} className="py-2">
                <strong>Freigabe #{r.id}</strong> · {r.approved_by} · {fmtDate(r.created_at)} · Glossarversion{' '}
                {r.glossary_version} · {r.change_count} Änderung(en) · Bearbeiter: {r.editors.join(', ')} ·{' '}
                {r.warnings.length} Warnung(en)
              </li>
            ))}
          </ul>
          {history && history.exports.length > 0 && (
            <h3 className="mb-1 mt-3 text-xs font-semibold uppercase text-slate-600">Exportdateien</h3>
          )}
          <ul className="space-y-1 text-sm">
            {history?.exports.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-blue-700 hover:underline"
                  onClick={() => {
                    void download(`/exports/${e.id}/download`, e.filename)
                  }}
                >
                  {e.filename}
                </button>
                <span className="text-xs text-slate-600">
                  {e.created_by} · {fmtDate(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasTranslation && (
        <Card className="p-0">
          <div className="grid border-b bg-slate-50 text-xs font-semibold uppercase text-slate-600 md:grid-cols-2">
            <span className="p-3">Original ({srcLang.toUpperCase() || '?'})</span>
            <span className="hidden p-3 md:block">Übersetzung ({lang.toUpperCase()})</span>
          </div>
          {p.segments.map((seg) => (
            <Row
              key={seg.id}
              seg={seg}
              lang={lang}
              editable={editable && isTranslator}
              busy={act.isPending}
              onTerm={(s, t) => {
                setDialog({ seg: s, term: t })
              }}
              onSave={save}
              onRegenerate={(s) => {
                call(() => post(`/segments/${s.id}/${lang}/retranslate`))
              }}
            />
          ))}
        </Card>
      )}
      {!hasTranslation && !running && (
        <Card>
          <p className="text-sm text-slate-600">
            Die Datei wurde analysiert. Wählen Sie die Sprachen und starten Sie die Übersetzung, um eine Vorschau zu
            erzeugen.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            {p.segments.slice(0, 15).map((s) => (
              <li key={s.id}>{s.source_text.slice(0, 160)}</li>
            ))}
          </ol>
        </Card>
      )}

      {dialog && (
        <TermDialog
          term={dialog.term}
          seg={dialog.seg}
          lang={lang}
          src={srcLang}
          projectId={id}
          editable={editable && isTranslator}
          onClose={() => {
            setDialog(null)
          }}
          onSegmentText={(text) => {
            save(dialog.seg, { text })
          }}
          onChanged={() => {
            void refresh()
          }}
        />
      )}
      {exporting && (
        <ExportDialog
          project={p}
          lang={lang}
          onClose={() => {
            setExporting(false)
          }}
          onDone={() => {
            setExporting(false)
            void refresh()
          }}
        />
      )}
      {act.isPending && (
        <Modal title="Bitte warten …" onClose={() => undefined}>
          <p className="text-sm text-slate-600">Die Aktion wird ausgeführt.</p>
        </Modal>
      )}
    </div>
  )
}
