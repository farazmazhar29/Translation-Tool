import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, can, post, put, type S } from '@/shared/api/client'
import { useAuth } from '@/features/auth'
import { ENTRY_CATEGORIES, ENTRY_STATUSES } from '../constants'
import { toBody, type Form as FormValues } from '../lib/entry'
import { useAction, useFields } from '@/shared/lib/hooks'
import { optionsOf } from '@/shared/lib/ui'
import { Checkbox, SelectField, TextArea, TextField } from '@/shared/components/form'
import { Form } from '@/shared/components/layout'

type Entry = S['GlossaryOut']

export const EntryForm = ({ initial, id, onDone }: { initial: FormValues; id?: number; onDone: () => void }) => {
  const { t } = useTranslation(['glossary', 'common'])
  const { user } = useAuth()
  const { values: f, set } = useFields(initial)
  const [force, setForce] = useState(false)
  const save = useAction(
    () => (id ? put(`/glossary/${id}`, { ...toBody(f, force) }) : post('/glossary', { ...toBody(f, force) })),
    { onSuccess: onDone },
  )
  const dups =
    save.error instanceof ApiError && save.error.status === 409
      ? (save.error.detail as { duplicates: Entry[] }).duplicates
      : []
  return (
    <Form
      onSubmit={() => {
        save.mutate()
      }}
      submitLabel={t('common:save')}
      disabled={save.isPending}
      error={dups.length ? null : save.error}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label={t('form.german')} value={f.de} onChange={set('de')} />
        <TextField label={t('form.english')} value={f.en} disabled={f.dnt} onChange={set('en')} />
        <TextField label={t('form.synonymsDe')} value={f.synDe} onChange={set('synDe')} />
        <TextField label={t('form.synonymsEn')} value={f.synEn} onChange={set('synEn')} />
      </div>
      <TextArea label={t('form.description')} rows={2} value={f.description} onChange={set('description')} />
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <SelectField
          hideLabel
          label={t('categoryLabel')}
          className="!w-auto"
          value={f.category}
          options={optionsOf(ENTRY_CATEGORIES, (c) => t(`category.${c}`))}
          onChange={(category) => {
            set('category')(category as FormValues['category'])
          }}
        />
        <Checkbox label={t('form.doNotTranslate')} checked={f.dnt} onChange={set('dnt')} />
        {can(user, 'reviewer') && (
          <SelectField
            hideLabel
            label={t('statusLabel')}
            className="!w-auto"
            value={f.status}
            options={optionsOf(ENTRY_STATUSES, (s) => t(`status.${s}`))}
            onChange={(status) => {
              set('status')(status as FormValues['status'])
            }}
          />
        )}
      </div>
      {dups.length > 0 && (
        <div className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          <strong>{t('form.duplicateFound')}</strong>
          <ul className="list-disc pl-5">
            {dups.map((d) => (
              <li key={d.id}>{Object.values(d.terms).join(' → ')}</li>
            ))}
          </ul>
          <Checkbox label={t('form.saveAnyway')} checked={force} onChange={setForce} className="mt-1" />
        </div>
      )}
    </Form>
  )
}
