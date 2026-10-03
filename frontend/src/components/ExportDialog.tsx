import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { download, get, post, type S } from '../api/client'
import { Btn, ErrorText, Label, Modal } from './ui'
import { input, useSettings } from '../lib/ui'

type Fmt = 'docx' | 'xlsx' | 'pdf'
type Mode = 'translation' | 'both'
interface Layout {
  sheet_name: string
  source_col: string
  target_col: string
  comment_col: string
  location_col: string
  start_row: number
  header: boolean
}
const DEFAULT_LAYOUT: Layout = {
  sheet_name: 'Übersetzung',
  source_col: 'A',
  target_col: 'B',
  comment_col: 'C',
  location_col: '',
  start_row: 2,
  header: true,
}
const COL = /^[A-Za-z]{0,3}$/

export function ExportDialog({
  project,
  lang,
  onClose,
  onDone,
}: {
  project: S['ProjectOut']
  lang: string
  onClose: () => void
  onDone: () => void
}) {
  const settings = useSettings()
  const qc = useQueryClient()
  const [fmt, setFmt] = useState<Fmt>((settings?.default_export_format as Fmt | undefined) ?? 'docx')
  const [mode, setMode] = useState<Mode>((settings?.default_export_mode as Mode | undefined) ?? 'translation')
  const [report, setReport] = useState(false)
  const [comments, setComments] = useState(false)
  const [archive, setArchive] = useState(true)
  const [exportLang, setExportLang] = useState(lang)
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT)
  const [templateName, setTemplateName] = useState('')
  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => get<S['TemplateOut'][]>('/export-templates'),
  })
  const patch = (p: Partial<Layout>): void => {
    setLayout({ ...layout, ...p })
  }
  const col = (k: 'source_col' | 'target_col' | 'comment_col' | 'location_col') => (
    <input
      className={`${input} uppercase`}
      value={layout[k]}
      maxLength={3}
      onChange={(e) => {
        if (COL.test(e.target.value)) patch({ [k]: e.target.value.toUpperCase() })
      }}
    />
  )

  const run = useMutation({
    mutationFn: async () => {
      const r = await post<S['ExportFileOut']>(`/projects/${project.id}/export`, {
        lang: exportLang,
        format: fmt,
        mode,
        include_report: report,
        include_comments: comments,
        archive_after: archive,
        config: fmt === 'xlsx' ? { ...layout } : null,
      })
      await download(`/exports/${r.id}/download`, r.filename)
    },
    onSuccess: onDone,
  })
  const saveTemplate = useMutation({
    mutationFn: () => post('/export-templates', { name: templateName, format: 'xlsx', config: { ...layout } }),
    onSuccess: async () => {
      setTemplateName('')
      await qc.invalidateQueries({ queryKey: ['templates'] })
    },
  })
  const applyTemplate = (id: string): void => {
    const t = templates.find((x) => String(x.id) === id)
    if (t) setLayout({ ...DEFAULT_LAYOUT, ...(t.config as Partial<Layout>) })
  }

  return (
    <Modal title="Export" onClose={onClose} wide>
      <div className="grid gap-3 md:grid-cols-3">
        <Label text="Format">
          <select
            className={input}
            value={fmt}
            onChange={(e) => {
              setFmt(e.target.value as Fmt)
            }}
          >
            <option value="docx">Word (.docx)</option>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="pdf">PDF</option>
          </select>
        </Label>
        <Label text="Inhalt">
          <select
            className={input}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as Mode)
            }}
          >
            <option value="translation">Nur Übersetzung</option>
            <option value="both">Original + Übersetzung</option>
          </select>
        </Label>
        <Label text="Sprache">
          <select
            className={input}
            value={exportLang}
            onChange={(e) => {
              setExportLang(e.target.value)
            }}
          >
            {project.target_langs.map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </Label>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={report}
            onChange={(e) => {
              setReport(e.target.checked)
            }}
          />{' '}
          Prüfbericht
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={comments}
            onChange={(e) => {
              setComments(e.target.checked)
            }}
          />{' '}
          Kommentare
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={archive}
            onChange={(e) => {
              setArchive(e.target.checked)
            }}
          />{' '}
          Projekt danach archivieren
        </label>
      </div>
      {fmt === 'xlsx' && (
        <details className="mt-4 rounded-md border p-3" open>
          <summary className="cursor-pointer text-sm font-semibold">Erweiterte Einstellungen (Excel-Spalten)</summary>
          <div className="mt-3 space-y-3">
            {templates.length > 0 && (
              <Label text="Vorlage laden">
                <select
                  className={input}
                  defaultValue=""
                  onChange={(e) => {
                    applyTemplate(e.target.value)
                  }}
                >
                  <option value="">— Vorlage wählen —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Label>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Label text="Spalte Ausgangssprache">{col('source_col')}</Label>
              <Label text="Spalte Zielsprache">{col('target_col')}</Label>
              <Label text="Spalte Kommentar">{col('comment_col')}</Label>
              <Label text="Spalte Position">{col('location_col')}</Label>
              <Label text="Startzeile">
                <input
                  className={input}
                  type="number"
                  min={1}
                  value={layout.start_row}
                  onChange={(e) => {
                    patch({ start_row: Math.max(1, Number(e.target.value)) })
                  }}
                />
              </Label>
              <Label text="Blattname">
                <input
                  className={input}
                  value={layout.sheet_name}
                  onChange={(e) => {
                    patch({ sheet_name: e.target.value })
                  }}
                />
              </Label>
              <label className="flex items-end gap-1 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={layout.header}
                  onChange={(e) => {
                    patch({ header: e.target.checked })
                  }}
                />{' '}
                Kopfzeile
              </label>
            </div>
            <p className="text-xs text-slate-600">
              Die Spalte „Ausgangssprache“ wird nur bei „Original + Übersetzung“ geschrieben.
            </p>
            <div className="flex gap-2">
              <input
                className={input}
                placeholder="Name für neue Vorlage"
                value={templateName}
                onChange={(e) => {
                  setTemplateName(e.target.value)
                }}
              />
              <Btn
                disabled={!templateName.trim() || saveTemplate.isPending}
                onClick={() => {
                  saveTemplate.mutate()
                }}
              >
                Als Vorlage speichern
              </Btn>
            </div>
          </div>
        </details>
      )}
      <div className="mt-4 space-y-2">
        <ErrorText error={run.error ?? saveTemplate.error} />
        <Btn
          variant="primary"
          disabled={run.isPending}
          onClick={() => {
            run.mutate()
          }}
        >
          {run.isPending ? 'Wird erzeugt …' : 'Exportieren & herunterladen'}
        </Btn>
      </div>
    </Modal>
  )
}
