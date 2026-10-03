import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { post, type Lang, type S } from '@/shared/api/client'
import { LANGS } from '@/shared/constants'
import { LangCheckboxes, SelectField, TextField } from '@/shared/components/form'
import { Form, PageHeader } from '@/shared/components/layout'
import { Card } from '@/shared/components/ui'
import { useAction, useFields } from '@/shared/lib/hooks'
import { optionsOf, useSettings } from '@/shared/lib/ui'

const NewProject = () => {
  const { t } = useTranslation(['projects', 'common'])
  const navigate = useNavigate()
  const settings = useSettings()
  const [file, setFile] = useState<File | null>(null)
  const { values: f, set } = useFields<{ name: string; customer: string; source: string; targets: Lang[] }>({
    name: '',
    customer: '',
    source: 'auto',
    targets: [],
  })
  const create = useAction(
    () => {
      const fd = new FormData()
      if (file) fd.append('file', file)
      fd.append('name', f.name)
      fd.append('customer', f.customer)
      fd.append('source_lang', f.source)
      fd.append('target_langs', f.targets.join(','))
      return post<S['ProjectOut']>('/projects', fd)
    },
    { onSuccess: (p) => void navigate(`/projects/${p.id}`) },
  )
  // until the user chooses, the default of the settings is shown as selected (and used by the server)
  const chosen = f.targets.length ? f.targets : ((settings?.default_target_langs ?? []) as Lang[])

  return (
    <Form
      onSubmit={() => {
        create.mutate()
      }}
      submitLabel={create.isPending ? t('new.analyzing') : t('new.submit')}
      disabled={!file || create.isPending}
      error={create.error}
      className="mx-auto max-w-2xl space-y-4"
    >
      <PageHeader title={t('new.title')} />
      <Card>
        <label
          className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center focus-within:border-red-600 hover:border-red-400"
          onDragOver={(e) => {
            e.preventDefault()
          }}
          onDrop={(e) => {
            e.preventDefault()
            setFile(e.dataTransfer.files[0] ?? null)
          }}
        >
          <input
            type="file"
            className="sr-only"
            accept=".docx,.xlsx,.pdf"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
            }}
          />
          {file ? <strong>{file.name}</strong> : t('new.dropFile')}
        </label>
        <p className="mt-2 text-xs text-slate-600">{t('new.hint')}</p>
      </Card>
      <Card className="grid gap-3 md:grid-cols-2">
        <TextField label={t('new.name')} placeholder={t('new.namePlaceholder')} value={f.name} onChange={set('name')} />
        <TextField label={t('new.customer')} value={f.customer} onChange={set('customer')} />
        <SelectField
          label={t('new.sourceLang')}
          value={f.source}
          onChange={set('source')}
          options={optionsOf(LANGS, (l) => t(`common:lang.${l}`), ['auto', t('new.autoDetect')])}
        />
        <LangCheckboxes label={t('new.targetLangs')} value={chosen} onChange={set('targets')} />
      </Card>
    </Form>
  )
}

export default NewProject
