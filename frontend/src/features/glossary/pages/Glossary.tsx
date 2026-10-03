import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { can, del, download, get, post, qs, type S } from '@/shared/api/client'
import { useAuth } from '@/features/auth'
import { EntryForm } from '../components/EntryForm'
import { SelectField, TextField } from '@/shared/components/form'
import { PageHeader, Table } from '@/shared/components/layout'
import { Btn, Card, ErrorText, Modal } from '@/shared/components/ui'
import { ENTRY_CATEGORIES, ENTRY_STATUSES, isEntryStatus, STATUS_CLS } from '../constants'
import { EMPTY, toForm, type Form } from '../lib/entry'
import { useAction, useFields, useInvalidate } from '@/shared/lib/hooks'
import { fmtDate, optionsOf } from '@/shared/lib/ui'

type Entry = S['GlossaryOut']

const Glossary = () => {
  const { t } = useTranslation(['glossary', 'common'])
  const { user } = useAuth()
  const refresh = useInvalidate(['glossary'])
  const fileRef = useRef<HTMLInputElement>(null)
  const { values: f, set } = useFields({ q: '', status: '', category: '' })
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
  const act = useAction(
    ({ id, status }: { id: number; status?: string }) =>
      status ? post(`/glossary/${id}/status?status=${status}`) : del(`/glossary/${id}`),
    { invalidate: ['glossary'] },
  )
  const imp = useAction(
    (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return post<S['ImportResult']>('/glossary/import/xlsx', fd)
    },
    {
      invalidate: ['glossary'],
      onSuccess: (r) => {
        setNote(t('importResult', { created: r.created, updated: r.updated, skipped: r.skipped }))
      },
    },
  )
  const scan = useAction(() => get<S['DuplicateGroup'][]>('/glossary/duplicates/scan'), {
    onSuccess: (groups) => {
      setNote(
        groups.length
          ? t('duplicatesFound', {
              list: groups.map((x) => t('duplicateItem', { term: x.term, lang: x.lang })).join(', '),
            })
          : t('noDuplicates'),
      )
    },
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
          {t('duplicateScan')}
        </Btn>
        <Btn
          onClick={() => {
            void download('/glossary/export/xlsx', 'glossar.xlsx')
          }}
        >
          {t('exportExcel')}
        </Btn>
        {reviewer && <Btn onClick={() => fileRef.current?.click()}>{t('importExcel')}</Btn>}
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
          {t('addTerm')}
        </Btn>
      </PageHeader>
      {note && <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-800">{note}</p>}
      <ErrorText error={imp.error ?? act.error} />
      <Card className="grid gap-2 md:grid-cols-3">
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
          t('columns.synonyms'),
          t('columns.description'),
          t('columns.status'),
          t('columns.version'),
          '',
        ]}
      >
        {entries.map((e) => (
          <tr key={e.id} className="align-top hover:bg-slate-50">
            <td className="px-3 py-2 font-medium">{e.terms['de']}</td>
            <td className="px-3 py-2 font-medium">
              {e.do_not_translate ? <em className="text-purple-700">{t('doNotTranslateShort')}</em> : e.terms['en']}
            </td>
            <td className="px-3 py-2 text-slate-600">{Object.values(e.synonyms).flat().join(', ')}</td>
            <td className="px-3 py-2 text-slate-600">{e.description}</td>
            <td className={`px-3 py-2 ${isEntryStatus(e.status) ? STATUS_CLS[e.status] : ''}`}>
              {isEntryStatus(e.status) ? t(`status.${e.status}`) : e.status}
            </td>
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
              {reviewer && (
                <>
                  {e.status !== 'approved' && (
                    <Btn
                      variant="ghost"
                      onClick={() => {
                        act.mutate({ id: e.id, status: 'approved' })
                      }}
                    >
                      {t('approve')}
                    </Btn>
                  )}
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      setEdit({ id: e.id, form: toForm(e) })
                    }}
                  >
                    {t('common:edit')}
                  </Btn>
                </>
              )}
              {can(user, 'admin') && (
                <Btn
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(t('confirmDelete'))) act.mutate({ id: e.id })
                  }}
                >
                  {t('common:delete')}
                </Btn>
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
          {!reviewer && <p className="mt-2 text-xs text-slate-600">{t('translatorHint')}</p>}
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

export default Glossary
