import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectOut } from '@/shared/api/generated'
import { EXPORT_FORMATS, EXPORT_MODES, isOneOf } from '@/shared/constants'
import { ExportService } from '../api/ExportService'
import { COLUMN, defaultLayout } from '../constants'
import { useFields } from '@/shared/lib/hooks'
import { optionsOf, type Option } from '@/shared/lib/ui'
import { SettingsService } from '@/shared/api/services/SettingsService'
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
  project: ProjectOut
  lang: string
  onClose: () => void
  onDone: () => void
}) => {
  const { t } = useTranslation(['projects', 'common'])
  const { data: settings } = SettingsService.useFetchSettings()
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
  const { data: templates = [] } = ExportService.useFetchTemplates()
  const run = ExportService.useExportProject(onDone)
  const saveTemplate = ExportService.useCreateTemplate(() => {
    setTemplateName('')
  })
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
                  saveTemplate.mutate({ name: templateName, format: 'xlsx', config: { ...layout } })
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
            run.mutate({
              pid: project.id,
              request: {
                lang, // the project's target language: the only one there is
                format: isOneOf(EXPORT_FORMATS, o.format) ? o.format : 'docx',
                mode: isOneOf(EXPORT_MODES, o.mode) ? o.mode : 'translation',
                include_report: o.report,
                include_comments: o.comments,
                archive_after: o.archive,
                config: o.format === 'xlsx' ? { ...layout } : null,
              },
            })
          }}
        >
          {run.isPending ? t('export.generating') : t('export.run')}
        </Btn>
      </div>
    </Modal>
  )
}
