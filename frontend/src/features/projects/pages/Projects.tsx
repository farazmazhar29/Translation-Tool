import { useQuery } from '@tanstack/react-query'
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
        <div className="mt-2 flex gap-3 text-sm">
          {ARCHIVE_VALUES.map((value) => (
            <label key={value} className="flex items-center gap-1">
              <input
                type="radio"
                checked={f.archived === value}
                onChange={() => {
                  set('archived')(value)
                }}
              />{' '}
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
                      run(p.id, 'copy')
                    }}
                  >
                    {t('list.copy')}
                  </Btn>
                  <Btn
                    variant="ghost"
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
