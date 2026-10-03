import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { post, type Lang, type S } from '@/shared/api/client'
import { LANGS } from '@/shared/constants'
import { LangCheckboxes, SelectField, TextField } from '@/shared/components/form'
import { Form, PageHeader } from '@/shared/components/layout'
import { Card } from '@/shared/components/ui'
import { useAction } from '@/shared/lib/hooks'
import { optionsOf, useSettings } from '@/shared/lib/ui'

const NewProject = () => {
  const { t } = useTranslation(['projects', 'common'])
  const navigate = useNavigate()
  const settings = useSettings()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [customer, setCustomer] = useState('')
  const [source, setSource] = useState('auto')
  const [targets, setTargets] = useState<Lang[]>([])
  const create = useAction(
    () => {
      const fd = new FormData()
      if (file) fd.append('file', file)
      fd.append('name', name)
      fd.append('customer', customer)
      fd.append('source_lang', source)
      fd.append('target_langs', targets.join(','))
      return post<S['ProjectOut']>('/projects', fd)
    },
    { onSuccess: (p) => void navigate(`/projects/${p.id}`) },
  )
  // until the user chooses, the default of the settings is shown as selected (and used by the server)
  const chosen = targets.length ? targets : ((settings?.default_target_langs ?? []) as Lang[])

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
        <TextField label={t('new.name')} placeholder={t('new.namePlaceholder')} value={name} onChange={setName} />
        <TextField label={t('new.customer')} value={customer} onChange={setCustomer} />
        <SelectField
          label={t('new.sourceLang')}
          value={source}
          onChange={setSource}
          options={optionsOf(LANGS, (l) => t(`common:lang.${l}`), ['auto', t('new.autoDetect')])}
        />
        <LangCheckboxes label={t('new.targetLangs')} value={chosen} onChange={setTargets} />
      </Card>
    </Form>
  )
}

export default NewProject
