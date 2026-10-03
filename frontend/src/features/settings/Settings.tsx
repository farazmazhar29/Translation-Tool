import { useTranslation } from 'react-i18next'
import { can, put, type S } from '@/shared/api/client'
import { EXPORT_FORMATS, EXPORT_MODES, LANGS, TERM_CATEGORIES } from '@/shared/constants'
import { useAuth } from '@/features/auth'
import { SelectField, TextField } from '@/shared/components/form'
import { Loading, PageHeader } from '@/shared/components/layout'
import { Btn, Card, ErrorText } from '@/shared/components/ui'
import { useAction, useFields } from '@/shared/lib/hooks'
import { optionsOf, useSettings } from '@/shared/lib/ui'
import { PROVIDERS } from './constants'

const SettingsForm = ({ initial }: { initial: S['SettingsOut'] }) => {
  const { t } = useTranslation(['settings', 'common'])
  const { user } = useAuth()
  const { values: s, set } = useFields(initial)
  const save = useAction(() => put<S['SettingsOut']>('/settings', { ...s }), { invalidate: ['settings'] })
  const disabled = !can(user, 'admin')
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t('title')} />
      {disabled && <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('adminOnly')}</p>}
      <Card title={t('aiCard')} className="space-y-3">
        <SelectField
          label={t('provider')}
          disabled={disabled}
          value={s.llm_provider}
          onChange={set('llm_provider')}
          options={optionsOf(PROVIDERS, (p) => t(`providers.${p}`))}
        />
        <TextField label={t('model')} disabled={disabled} value={s.llm_model} onChange={set('llm_model')} />
        <p className="text-xs text-slate-600">
          {t('apiKey', { status: s.gemini_key_configured ? t('keyConfigured') : t('keyMissing') })}
        </p>
      </Card>
      <Card title={t('defaultsCard')} className="grid gap-3 md:grid-cols-2">
        <SelectField
          label={t('defaultExport')}
          disabled={disabled}
          value={s.default_export_format}
          onChange={set('default_export_format')}
          options={optionsOf(EXPORT_FORMATS, (f) => t(`common:exportFormat.${f}`))}
        />
        <SelectField
          label={t('exportContent')}
          disabled={disabled}
          value={s.default_export_mode}
          onChange={set('default_export_mode')}
          options={optionsOf(EXPORT_MODES, (m) => t(`common:exportMode.${m}`))}
        />
        <SelectField
          label={t('defaultTargetLang')}
          disabled={disabled}
          value={s.default_target_langs[0] ?? 'en'}
          onChange={(lang) => {
            set('default_target_langs')([lang])
          }}
          options={optionsOf(LANGS, (l) => t(`common:lang.${l}`))}
        />
      </Card>
      <Card title={t('colorsCard')} className="grid gap-3 md:grid-cols-2">
        {TERM_CATEGORIES.map((category) => (
          <label key={category} className="flex items-center gap-3 text-sm">
            <input
              type="color"
              disabled={disabled}
              value={s.colors[category] ?? '#999999'}
              onChange={(e) => {
                set('colors')({ ...s.colors, [category]: e.target.value })
              }}
            />
            {t(`common:category.${category}`)}
          </label>
        ))}
      </Card>
      <ErrorText error={save.error} />
      {!disabled && (
        <Btn
          variant="primary"
          disabled={save.isPending}
          onClick={() => {
            save.mutate()
          }}
        >
          {save.isSuccess ? t('saved') : t('common:save')}
        </Btn>
      )}
    </div>
  )
}

const Settings = () => {
  const settings = useSettings()
  return settings ? <SettingsForm initial={settings} /> : <Loading />
}

export default Settings
