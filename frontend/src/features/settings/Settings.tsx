import { useTranslation } from 'react-i18next'
import { can } from '@/shared/api/session'
import type { SettingsOut } from '@/shared/api/generated'
import { EXPORT_FORMATS, EXPORT_MODES, TERM_CATEGORIES } from '@/shared/constants'
import { useAuth } from '@/features/auth'
import { SelectField } from '@/shared/components/form'
import { Loading, PageHeader } from '@/shared/components/layout'
import { Btn, Card, ErrorText } from '@/shared/components/ui'
import { SettingsService } from '@/shared/api/services/SettingsService'
import { useFields } from '@/shared/lib/hooks'
import { optionsOf } from '@/shared/lib/ui'
import { PROVIDERS } from './constants'

const SettingsForm = ({ initial }: { initial: SettingsOut }) => {
  const { t } = useTranslation(['settings', 'common'])
  const { user } = useAuth()
  const { values: s, set } = useFields(initial)
  const save = SettingsService.useUpdateSettings()
  const disabled = !can(user, 'admin')
  const modelsOf = (provider: string): string[] => s.model_choices[provider] ?? []
  const models = modelsOf(s.llm_provider)
  // a stored model the list no longer has stays visible (and fails on saving), instead of being silently swapped
  const modelOptions = models.includes(s.llm_model) ? models : [s.llm_model, ...models]
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t('title')} />
      {disabled && <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('adminOnly')}</p>}
      <Card title={t('aiCard')} className="space-y-3">
        <SelectField
          label={t('provider')}
          disabled={disabled}
          value={s.llm_provider}
          onChange={(provider) => {
            set('llm_provider')(provider)
            const next = modelsOf(provider)
            if (next[0] && !next.includes(s.llm_model)) set('llm_model')(next[0])
          }}
          options={optionsOf(PROVIDERS, (p) => t(`providers.${p}`))}
        />
        {models.length > 0 ? (
          <SelectField
            label={t('model')}
            disabled={disabled}
            value={s.llm_model}
            onChange={set('llm_model')}
            options={optionsOf(modelOptions, (m) => m)}
          />
        ) : (
          <p className="text-sm text-stone-600">{t('noModel')}</p>
        )}
        <p className="rounded-xl bg-stone-100 px-4 py-3 text-xs text-stone-600">
          {t('apiKey', { status: s.gemini_key_configured ? t('keyConfigured') : t('keyMissing') })}
        </p>
      </Card>
      <Card title={t('defaultsCard')}>
        <div className="grid gap-5 lg:grid-cols-2">
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
        </div>
      </Card>
      <Card title={t('colorsCard')}>
        <div className="grid gap-4 sm:grid-cols-2">
          {TERM_CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-3 text-sm font-medium">
              <input
                type="color"
                className="size-9 shrink-0 cursor-pointer rounded-full border border-line bg-transparent p-0.5 disabled:cursor-not-allowed [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
                disabled={disabled}
                value={s.colors[category] ?? '#999999'}
                onChange={(e) => {
                  set('colors')({ ...s.colors, [category]: e.target.value })
                }}
              />
              {t(`common:category.${category}`)}
            </label>
          ))}
        </div>
      </Card>
      <ErrorText error={save.error} />
      {!disabled && (
        <Btn
          variant="primary"
          disabled={save.isPending}
          onClick={() => {
            save.mutate(s)
          }}
        >
          {save.isSuccess ? t('saved') : t('common:save')}
        </Btn>
      )}
    </div>
  )
}

const Settings = () => {
  const { data: settings } = SettingsService.useFetchSettings()
  return settings ? <SettingsForm initial={settings} /> : <Loading />
}

export default Settings
