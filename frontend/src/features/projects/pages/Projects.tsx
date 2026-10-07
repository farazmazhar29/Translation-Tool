import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Archive, ArchiveRestore, Copy, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { can, del, get, post, qs, type S } from '@/shared/api/client'
import { useAuth } from '@/features/auth'
import { SelectField, TextField } from '@/shared/components/form'
import { PageHeader, Table } from '@/shared/components/layout'
import { useConfirm } from '@/shared/components/confirm'
import { Card, IconAction, LinkBtn, StatusBadge } from '@/shared/components/ui'
import { useAction, useFields } from '@/shared/lib/hooks'
import { LANGS, STATUSES } from '@/shared/constants'
import { fmtDate, optionsOf, type Option } from '@/shared/lib/ui'
import { ARCHIVE_VALUES } from '../constants'

type Filters = Record<
  'q' | 'status' | 'archived' | 'lang' | 'customer' | 'editor' | 'term' | 'date_from' | 'date_to',
  string
>
type Action = 'archive' | 'unarchive' | 'copy' | 'delete'

const Projects = () => {
  const { t } = useTranslation(['projects', 'common'])
  const { user } = useAuth()
  const { confirm, dialog } = useConfirm()
  const [moreFilters, setMoreFilters] = useState(false)
  const [params] = useSearchParams()
  const { values: f, set } = useFields<Filters>({
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
  const act = useAction(
    ({ id, action }: { id: number; action: Action }) =>
      action === 'delete' ? del(`/projects/${id}`) : post(`/projects/${id}/${action}`),
    { invalidate: ['projects'] },
  )
  const run = (id: number, action: Action): void => {
    act.mutate({ id, action })
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('list.title')}>
        <LinkBtn to="/projects/new" variant="primary">
          <Plus className="size-4" aria-hidden="true" />
          {t('list.newProject')}
        </LinkBtn>
      </PageHeader>
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TextField
            hideLabel
            label={t('filters.search')}
            placeholder={t('filters.searchPlaceholder')}
            value={f.q}
            onChange={set('q')}
          />
          <div className={`${moreFilters ? 'contents' : 'hidden'} lg:contents`}>
            <TextField
              hideLabel
              label={t('filters.term')}
              placeholder={t('filters.termPlaceholder')}
              value={f.term}
              onChange={set('term')}
            />
            <TextField
              hideLabel
              label={t('filters.customer')}
              placeholder={t('filters.customer')}
              value={f.customer}
              onChange={set('customer')}
            />
            <SelectField
              hideLabel
              label={t('filters.editor')}
              value={f.editor}
              onChange={set('editor')}
              options={[['', t('filters.editorAll')], ...editors.map((name): Option => [name, name])]}
            />
            <SelectField
              hideLabel
              label={t('filters.status')}
              value={f.status}
              onChange={set('status')}
              options={optionsOf(STATUSES, (s) => t(`common:status.${s}`), ['', t('filters.statusAll')])}
            />
            <SelectField
              hideLabel
              label={t('filters.language')}
              value={f.lang}
              onChange={set('lang')}
              options={optionsOf(LANGS, (l) => t(`common:lang.${l}`), ['', t('filters.langAll')])}
            />
            <TextField
              hideLabel
              label={t('filters.changedFrom')}
              title={t('filters.changedFromTitle')}
              prefix={t('filters.changedFromTitle')}
              type="date"
              value={f.date_from}
              onChange={set('date_from')}
            />
            <TextField
              hideLabel
              label={t('filters.changedTo')}
              title={t('filters.changedToTitle')}
              prefix={t('filters.changedToTitle')}
              type="date"
              value={f.date_to}
              onChange={set('date_to')}
            />
          </div>
        </div>
        <button
          type="button"
          aria-expanded={moreFilters}
          className="mt-3 text-sm font-semibold text-brand-dark hover:underline lg:hidden"
          onClick={() => {
            setMoreFilters(!moreFilters)
          }}
        >
          {moreFilters ? t('filters.fewer') : t('filters.more')}
        </button>
        <div className="mt-4 flex w-fit rounded-full bg-stone-100 p-1 text-sm">
          {ARCHIVE_VALUES.map((value) => (
            <label
              key={value}
              className="cursor-pointer rounded-full px-4 py-1.5 font-semibold text-stone-600 transition has-[:checked]:bg-white has-[:checked]:text-ink has-[:checked]:shadow-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand"
            >
              <input
                type="radio"
                className="sr-only"
                checked={f.archived === value}
                onChange={() => {
                  set('archived')(value)
                }}
              />
              {t(`filters.archive.${value}`)}
            </label>
          ))}
        </div>
      </Card>
      <Table
        headers={[
          t('list.headers.project'),
          { label: t('list.headers.customer'), className: 'hidden 2xl:table-cell' },
          { label: t('list.headers.languages'), className: 'hidden lg:table-cell' },
          t('list.headers.status'),
          { label: t('list.headers.changed'), className: 'hidden xl:table-cell' },
          { label: t('list.headers.createdBy'), className: 'hidden 2xl:table-cell' },
          '',
        ]}
        rowCount={isLoading ? undefined : projects.length}
        emptyText={t('list.empty')}
      >
        {projects.map((p) => (
          <tr key={p.id}>
            <td className="w-full max-w-0 px-4 py-3">
              <Link to={`/projects/${p.id}`} className="block truncate font-semibold hover:text-brand">
                {p.name}
              </Link>
              <span className="block truncate text-xs text-stone-600">{p.filename}</span>
            </td>
            <td className="hidden whitespace-nowrap px-4 py-3 2xl:table-cell">{p.customer}</td>
            <td className="hidden whitespace-nowrap px-4 py-3 uppercase lg:table-cell">
              {(p.source_lang === 'auto' ? p.detected_lang : p.source_lang) || '?'} → {p.target_langs.join(', ')}
            </td>
            <td className="whitespace-nowrap px-3 py-3">
              <StatusBadge status={p.status} archived={p.archived} />
            </td>
            <td className="hidden whitespace-nowrap px-4 py-3 text-stone-600 xl:table-cell">{fmtDate(p.updated_at)}</td>
            <td className="hidden whitespace-nowrap px-4 py-3 2xl:table-cell">{p.created_by}</td>
            <td className="whitespace-nowrap py-3 pl-1 pr-3 text-right">
              {can(user, 'translator') && (
                <>
                  <IconAction
                    label={t('list.copy')}
                    icon={Copy}
                    onClick={() => {
                      run(p.id, 'copy')
                    }}
                  />
                  <IconAction
                    label={p.archived ? t('list.unarchive') : t('list.archive')}
                    icon={p.archived ? ArchiveRestore : Archive}
                    onClick={() => {
                      run(p.id, p.archived ? 'unarchive' : 'archive')
                    }}
                  />
                </>
              )}
              {can(user, 'admin') && (
                <IconAction
                  label={t('common:delete')}
                  icon={Trash2}
                  destructive
                  onClick={() => {
                    void confirm({
                      title: t('list.deleteTitle'),
                      message: t('list.confirmDelete', { name: p.name }),
                      confirmLabel: t('common:delete'),
                      destructive: true,
                    }).then((ok) => {
                      if (ok) run(p.id, 'delete')
                    })
                  }}
                />
              )}
            </td>
          </tr>
        ))}
      </Table>
      {dialog}
    </div>
  )
}

export default Projects
