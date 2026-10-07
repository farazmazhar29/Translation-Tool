import { useState } from 'react'
import { FileText, UploadCloud } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LANGS } from '@/shared/constants'
import { SelectField, TargetLanguage, TextField } from '@/shared/components/form'
import { BackLink, Form, PageHeader } from '@/shared/components/layout'
import { Card, LinkBtn } from '@/shared/components/ui'
import { useFields } from '@/shared/lib/hooks'
import { optionsOf } from '@/shared/lib/ui'
import { ProjectService } from '../api/ProjectService'

const NewProject = () => {
  const { t } = useTranslation(['projects', 'common'])
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const { values: f, set } = useFields({ name: '', customer: '', source: 'auto' })
  const create = ProjectService.useCreateProject((p) => void navigate(`/projects/${p.id}`))

  return (
    <Form
      onSubmit={() => {
        if (file) create.mutate({ file, name: f.name, customer: f.customer, sourceLang: f.source })
      }}
      submitLabel={create.isPending ? t('new.analyzing') : t('new.submit')}
      disabled={!file || create.isPending}
      error={create.error}
      className="mx-auto max-w-2xl space-y-4"
      secondary={<LinkBtn to="/projects">{t('common:cancel')}</LinkBtn>}
    >
      <BackLink to="/projects">{t('common:backToProjects')}</BackLink>
      <PageHeader title={t('new.title')} />
      <Card>
        <label
          className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 px-6 py-14 text-center transition focus-within:border-brand hover:border-brand hover:bg-brand-soft/40"
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
          <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
            {file ? <FileText className="size-7" /> : <UploadCloud className="size-7" />}
          </span>
          {file ? (
            <strong className="text-lg">{file.name}</strong>
          ) : (
            <span className="font-semibold">{t('new.dropFile')}</span>
          )}
        </label>
        <p className="mt-3 text-center text-xs text-stone-600">{t('new.hint')}</p>
      </Card>
      <Card className="grid gap-5 lg:grid-cols-2">
        <TextField label={t('new.name')} placeholder={t('new.namePlaceholder')} value={f.name} onChange={set('name')} />
        <TextField label={t('new.customer')} value={f.customer} onChange={set('customer')} />
        <SelectField
          label={t('new.sourceLang')}
          value={f.source}
          onChange={set('source')}
          options={optionsOf(LANGS, (l) => t(`common:lang.${l}`), ['auto', t('new.autoDetect')])}
        />
        <TargetLanguage label={t('new.targetLang')} source={f.source} unknown={t('new.targetAuto')} />
      </Card>
    </Form>
  )
}

export default NewProject
