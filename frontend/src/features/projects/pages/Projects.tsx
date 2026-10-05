import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { can, del, get, post, qs, type S } from '@/shared/api/client'
import { useAuth } from '@/features/auth'
import { SelectField, TextField } from '@/shared/components/form'
import { PageHeader, Table } from '@/shared/components/layout'
import { Btn, Card, LinkBtn, StatusBadge } from '@/shared/components/ui'
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
        <div className="grid gap-2 md:grid-cols-4">
          <TextField
            hideLabel
            label={t('filters.search')}
            placeholder={t('filters.searchPlaceholder')}
            value={f.q}
            onChange={set('q')}
          />
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
            type="date"
            value={f.date_from}
            onChange={set('date_from')}
          />
          <TextField
            hideLabel
            label={t('filters.changedTo')}
            title={t('filters.changedToTitle')}
            type="date"
            value={f.date_to}
            onChange={set('date_to')}
          />
        </div>
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
          t('list.headers.customer'),
          t('list.headers.file'),
          t('list.headers.languages'),
          t('list.headers.status'),
          t('list.headers.changed'),
          t('list.headers.createdBy'),
          '',
        ]}
        rowCount={isLoading ? undefined : projects.length}
        emptyText={t('list.empty')}
      >
        {projects.map((p) => (
          <tr key={p.id} className="hover:bg-stone-50">
            <td className="px-4 py-3 font-semibold">
              <Link to={`/projects/${p.id}`} className="hover:text-brand">
                {p.name}
              </Link>
            </td>
            <td className="px-4 py-3">{p.customer}</td>
            <td className="px-4 py-3 text-stone-600">{p.filename}</td>
            <td className="px-4 py-3 uppercase">
              {(p.source_lang === 'auto' ? p.detected_lang : p.source_lang) || '?'} → {p.target_langs.join(', ')}
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={p.status} />
            </td>
            <td className="px-4 py-3 text-stone-600">{fmtDate(p.updated_at)}</td>
            <td className="px-4 py-3">{p.created_by}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right">
              {can(user, 'translator') && (
                <>
                  <Btn
                    variant="ghost"
                    className="!px-3 !py-1.5"
                    onClick={() => {
                      run(p.id, 'copy')
                    }}
                  >
                    {t('list.copy')}
                  </Btn>
                  <Btn
                    variant="ghost"
                    className="!px-3 !py-1.5"
                    onClick={() => {
                      run(p.id, p.archived ? 'unarchive' : 'archive')
                    }}
                  >
                    {p.archived ? t('list.unarchive') : t('list.archive')}
                  </Btn>
                </>
              )}
              {can(user, 'admin') && (
                <Btn
                  variant="ghost"
                  className="!px-3 !py-1.5"
                  onClick={() => {
                    if (window.confirm(t('list.confirmDelete', { name: p.name }))) run(p.id, 'delete')
                  }}
                >
                  {t('common:delete')}
                </Btn>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

export default Projects
