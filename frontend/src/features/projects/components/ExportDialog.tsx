import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { download, get, post, type S } from '@/shared/api/client'
import { EXPORT_FORMATS, EXPORT_MODES } from '@/shared/constants'
import { COLUMN, defaultLayout } from '../constants'
import { useAction, useFields } from '@/shared/lib/hooks'
import { optionsOf, useSettings, type Option } from '@/shared/lib/ui'
import { Checkbox, SelectField, TextField } from '@/shared/components/form'
import { Btn, ErrorText, Modal } from '@/shared/components/ui'

type Layout = ReturnType<typeof defaultLayout>
type ColumnKey = 'source_col' | 'target_col' | 'comment_col' | 'location_col'

export const ExportDialog = ({
  project,
  lang,
  onClose,
  onDone,
}: {
  project: S['ProjectOut']
  lang: string
  onClose: () => void
  onDone: () => void
}) => {
  const { t } = useTranslation(['projects', 'common'])
  const settings = useSettings()
  const { values: o, set } = useFields({
    format: settings?.default_export_format ?? 'docx',
    mode: settings?.default_export_mode ?? 'translation',
    report: false,
    comments: false,
    archive: true,
  })
  const {
    values: layout,
    setValues: setLayout,
    set: setLayoutField,
  } = useFields<Layout>(defaultLayout(t('export.sheetName')))
  const [templateName, setTemplateName] = useState('')
  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => get<S['TemplateOut'][]>('/export-templates'),
  })
  const run = useAction(
    async () => {
      const file = await post<S['ExportFileOut']>(`/projects/${project.id}/export`, {
        lang, // the project's target language: the only one there is
        format: o.format,
        mode: o.mode,
        include_report: o.report,
        include_comments: o.comments,
        archive_after: o.archive,
        config: o.format === 'xlsx' ? { ...layout } : null,
      })
      await download(`/exports/${file.id}/download`, file.filename)
    },
    { onSuccess: onDone },
  )
  const saveTemplate = useAction(
    () => post('/export-templates', { name: templateName, format: 'xlsx', config: { ...layout } }),
    {
      invalidate: ['templates'],
      onSuccess: () => {
        setTemplateName('')
      },
    },
  )
  const applyTemplate = (id: string): void => {
    const template = templates.find((tpl) => String(tpl.id) === id)
    if (template) setLayout({ ...defaultLayout(t('export.sheetName')), ...(template.config as Partial<Layout>) })
  }
  const column = (key: ColumnKey, label: string) => (
    <TextField
      label={label}
      className="uppercase"
      maxLength={3}
      value={layout[key]}
      onChange={(letters) => {
        if (COLUMN.test(letters)) setLayoutField(key)(letters.toUpperCase())
      }}
    />
  )

  return (
    <Modal title={t('export.title')} onClose={onClose} wide>
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label={t('export.format')}
          value={o.format}
          onChange={set('format')}
          options={optionsOf(EXPORT_FORMATS, (f) => t(`common:exportFormat.${f}`))}
        />
        <SelectField
          label={t('export.content')}
          value={o.mode}
          onChange={set('mode')}
          options={optionsOf(EXPORT_MODES, (m) => t(`common:exportMode.${m}`))}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        <Checkbox label={t('export.report')} checked={o.report} onChange={set('report')} />
        <Checkbox label={t('export.comments')} checked={o.comments} onChange={set('comments')} />
        <Checkbox label={t('export.archiveAfter')} checked={o.archive} onChange={set('archive')} />
      </div>
      {o.format === 'xlsx' && (
        <details className="mt-4 rounded-md border p-3" open>
          <summary className="cursor-pointer text-sm font-semibold">{t('export.advanced')}</summary>
          <div className="mt-3 space-y-3">
            {templates.length > 0 && (
              <SelectField
                label={t('export.loadTemplate')}
                value=""
                onChange={applyTemplate}
                options={[
                  ['', t('export.chooseTemplate')],
                  ...templates.map((tpl): Option => [String(tpl.id), tpl.name]),
                ]}
              />
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {column('source_col', t('export.sourceCol'))}
              {column('target_col', t('export.targetCol'))}
              {column('comment_col', t('export.commentCol'))}
              {column('location_col', t('export.locationCol'))}
              <TextField
                label={t('export.startRow')}
                type="number"
                min={1}
                value={layout.start_row}
                onChange={(row) => {
                  setLayoutField('start_row')(Math.max(1, Number(row)))
                }}
              />
              <TextField
                label={t('export.sheetLabel')}
                value={layout.sheet_name}
                onChange={setLayoutField('sheet_name')}
              />
              <Checkbox
                label={t('export.header')}
                checked={layout.header}
                onChange={setLayoutField('header')}
                className="self-end pb-2"
              />
            </div>
            <p className="text-xs text-stone-600">{t('export.sourceColHint')}</p>
            <div className="flex gap-2">
              <TextField
                hideLabel
                label={t('export.templateName')}
                placeholder={t('export.templatePlaceholder')}
                value={templateName}
                onChange={setTemplateName}
              />
              <Btn
                disabled={!templateName.trim() || saveTemplate.isPending}
                onClick={() => {
                  saveTemplate.mutate()
                }}
              >
                {t('export.saveTemplate')}
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
          {run.isPending ? t('export.generating') : t('export.run')}
        </Btn>
      </div>
    </Modal>
  )
}
