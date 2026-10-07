import type { TFunction } from 'i18next'
import type { QualityWarning } from '@/shared/api/generated'

/**
 * The sentence of a quality finding in the language of the interface. The API sends a `code` and its `params`;
 * findings that were stored before the codes existed only have the German `message`, which is shown as it is.
 */
export const findingText = (finding: QualityWarning, t: TFunction<'projects'>): string => {
  const values: Record<string, unknown> = finding.params // interpolation values of any kind
  return finding.code ? t(`quality.findings.${finding.code}`, values) : finding.message
}
