import { CheckCircle2, Download, Pencil, Plus, ScanSearch, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GlossaryOut, SkippedRow } from '@/shared/api/generated'
import { can } from '@/shared/api/session'
import { useAuth } from '@/features/auth'
import { GlossaryService } from '../api/GlossaryService'
import { EntryForm } from '../components/EntryForm'
import { SelectField, TextField } from '@/shared/components/form'
import { PageHeader, Table } from '@/shared/components/layout'
import { useConfirm } from '@/shared/components/confirm'
import { Btn, Card, ErrorText, IconAction, Modal } from '@/shared/components/ui'
import { ENTRY_CATEGORIES, ENTRY_STATUSES, isEntryStatus, STATUS_CLS } from '../constants'
import { EMPTY, toForm, type Form } from '../lib/entry'
import { useRefresh } from '@/shared/api/base'
import { useFields } from '@/shared/lib/hooks'
import { fmtDate, optionsOf } from '@/shared/lib/ui'

type Entry = GlossaryOut

const Glossary = () => {
  const { t } = useTranslation(['glossary', 'common'])
  const { user } = useAuth()
  const { confirm, dialog } = useConfirm()
  const refresh = useRefresh(['glossary'])
  const fileRef = useRef<HTMLInputElement>(null)
  const { values: f, set } = useFields({ q: '', status: '', category: '' })
  const [edit, setEdit] = useState<{ id?: number; form: Form } | null>(null)
  const [versions, setVersions] = useState<Entry | null>(null)
  const [note, setNote] = useState('')
  const [skipped, setSkipped] = useState<SkippedRow[]>([]) // rows of the last import that were not taken
  const { data: entries = [] } = GlossaryService.useFetchEntries(f)
  const { data: vers = [] } = GlossaryService.useFetchEntryVersions(versions?.id)
  const approve = GlossaryService.useSetEntryStatus()
  const remove = GlossaryService.useDeleteEntry()
  const imp = GlossaryService.useImportGlossary((r) => {
    setNote(t('importResult', { created: r.created, updated: r.updated, skipped: r.skipped }))
    setSkipped(r.skipped_rows)
  })
  const scan = GlossaryService.useScanDuplicates((groups) => {
    setSkipped([])
    setNote(
      groups.length
        ? t('duplicatesFound', {
            list: groups.map((x) => t('duplicateItem', { term: x.term, lang: x.lang })).join(', '),
          })
        : t('noDuplicates'),
    )
  })
  const reviewer = can(user, 'reviewer')
  const statusFilter = optionsOf(ENTRY_STATUSES, (s) => t(`status.${s}`), ['', t('statusAll')])
  const categoryFilter = optionsOf(ENTRY_CATEGORIES, (c) => t(`category.${c}`), ['', t('categoryAll')])

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')}>
        <Btn
          onClick={() => {
            scan.mutate()
          }}
        >
          <ScanSearch className="size-4" aria-hidden="true" />
          {t('duplicateScan')}
        </Btn>
        <Btn
          onClick={() => {
            void GlossaryService.exportGlossary()
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          {t('exportExcel')}
        </Btn>
        {reviewer && (
          <Btn onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" aria-hidden="true" />
            {t('importExcel')}
          </Btn>
        )}
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
          <Plus className="size-4" aria-hidden="true" />
          {t('addTerm')}
        </Btn>
      </PageHeader>
      {note && (
        <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900" role="status">
          <p>{note}</p>
          {skipped.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {skipped.map((s) => (
                <li key={s.row}>
                  {t('skippedRow', { row: s.row })}: {t(`skip.${s.code}`, { term: s.term })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ErrorText error={imp.error ?? approve.error ?? remove.error} />
      <Card className="grid gap-3 lg:grid-cols-3">
        <TextField hideLabel label={t('search')} placeholder={t('searchPlaceholder')} value={f.q} onChange={set('q')} />
        <SelectField
          hideLabel
          label={t('statusLabel')}
          value={f.status}
          onChange={set('status')}
          options={statusFilter}
        />
        <SelectField
          hideLabel
          label={t('categoryLabel')}
          value={f.category}
          onChange={set('category')}
          options={categoryFilter}
        />
      </Card>
      <Table
        headers={[
          t('columns.german'),
          t('columns.english'),
          { label: t('columns.synonyms'), className: 'hidden xl:table-cell' },
          { label: t('columns.description'), className: 'hidden 2xl:table-cell' },
          t('columns.status'),
          { label: t('columns.version'), className: 'hidden lg:table-cell' },
          '',
        ]}
      >
        {entries.map((e) => (
          <tr key={e.id} className="align-top hover:bg-stone-50">
            <td className="break-words px-4 py-3 font-medium">{e.terms['de']}</td>
            <td className="px-4 py-3 font-medium">
              {e.do_not_translate ? (
                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-800">
                  {t('doNotTranslateShort')}
                </span>
              ) : (
                e.terms['en']
              )}
            </td>
            <td className="hidden px-4 py-3 text-stone-600 lg:table-cell">
              {Object.values(e.synonyms).flat().join(', ')}
            </td>
            <td className="hidden px-4 py-3 text-stone-600 2xl:table-cell">{e.description}</td>
            <td className="px-4 py-3">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isEntryStatus(e.status) ? STATUS_CLS[e.status] : 'bg-stone-100 text-stone-700'}`}
              >
                {isEntryStatus(e.status) ? t(`status.${e.status}`) : e.status}
              </span>
            </td>
            <td className="hidden px-4 py-3 lg:table-cell">
              <button
                type="button"
                className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-600 transition hover:bg-stone-200"
                onClick={() => {
                  setVersions(e)
                }}
              >
                v{e.version}
              </button>
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-right">
              {reviewer && e.status !== 'approved' && (
                <IconAction
                  label={t('approve')}
                  icon={CheckCircle2}
                  onClick={() => {
                    approve.mutate({ id: e.id, status: 'approved' })
                  }}
                />
              )}
              {reviewer && (
                <IconAction
                  label={t('common:edit')}
                  icon={Pencil}
                  onClick={() => {
                    setEdit({ id: e.id, form: toForm(e) })
                  }}
                />
              )}
              {can(user, 'admin') && (
                <IconAction
                  label={t('common:delete')}
                  icon={Trash2}
                  destructive
                  onClick={() => {
                    void confirm({
                      title: t('deleteTitle'),
                      message: t('confirmDelete'),
                      confirmLabel: t('common:delete'),
                      destructive: true,
                    }).then((ok) => {
                      if (ok) remove.mutate(e.id)
                    })
                  }}
                />
              )}
            </td>
          </tr>
        ))}
      </Table>
      {edit && (
        <Modal
          title={edit.id ? t('editTitle') : t('newTitle')}
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
          {!reviewer && <p className="mt-2 text-xs text-stone-600">{t('translatorHint')}</p>}
        </Modal>
      )}
      {versions && (
        <Modal
          title={t('versionsTitle', { term: versions.terms['de'] ?? '' })}
          onClose={() => {
            setVersions(null)
          }}
        >
          <ul className="divide-y text-sm">
            {vers.map((v) => (
              <li key={v.id} className="py-2">
                <strong>v{v.entry_version}</strong> · {v.action} · {v.changed_by} · {fmtDate(v.changed_at)}
                <div className="text-stone-600">
                  {Object.values(v.data['terms'] as Record<string, string>).join(' → ')} ({String(v.data['status'])})
                </div>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {dialog}
    </div>
  )
}

export default Glossary
