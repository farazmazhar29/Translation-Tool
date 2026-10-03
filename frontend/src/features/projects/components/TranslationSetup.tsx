import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { post, type Lang, type S } from '@/shared/api/client'
import { LangCheckboxes, SelectField } from '@/shared/components/form'
import { Btn } from '@/shared/components/ui'
import { LANGS } from '@/shared/constants'
import { optionsOf } from '@/shared/lib/ui'
import type { Run } from '../types'

/** Source language, target languages and the button that starts (or restarts) the translation. */
export const TranslationSetup = ({
  project: p,
  hasTranslation,
  run,
}: {
  project: S['ProjectDetail']
  hasTranslation: boolean
  run: Run
}) => {
  const { t } = useTranslation(['projects', 'common'])
  const [srcPick, setSrcPick] = useState<string | null>(null)
  const [targetsPick, setTargetsPick] = useState<Lang[] | null>(null)
  const src = srcPick ?? p.source_lang
  const targets = targetsPick ?? (p.target_langs as Lang[])
  return (
    <div className="mt-4 flex flex-wrap items-end gap-4 border-t pt-4">
      <SelectField
        label={t('view.sourceLang')}
        className="!w-auto"
        value={src}
        onChange={setSrcPick}
        options={optionsOf(LANGS, (l) => t(`common:lang.${l}`), [
          'auto',
          p.detected_lang ? t('view.autoDetected', { lang: p.detected_lang.toUpperCase() }) : t('view.auto'),
        ])}
      />
      <LangCheckboxes label={t('view.targetLangs')} value={targets} onChange={setTargetsPick} />
      <Btn
        variant="primary"
        disabled={p.job_state === 'running' || targets.length === 0}
        onClick={() => {
          if (!hasTranslation || window.confirm(t('view.confirmOverwrite'))) {
            run(() => post(`/projects/${p.id}/translate`, { source_lang: src, target_langs: targets }))
          }
        }}
      >
        {hasTranslation ? t('view.retranslate') : t('view.startTranslation')}
      </Btn>
      <span className="text-xs text-slate-600">{t('view.previewOnly')}</span>
    </div>
  )
}
