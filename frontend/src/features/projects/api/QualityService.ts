import { useApiRequest, unwrap } from '@/shared/api/base'
import { API_CONFIG } from '@/shared/api/config'
import { QualityApiFactory } from '@/shared/api/generated'

const api = QualityApiFactory(API_CONFIG)

export const QualityService = {
  /** The findings of the quality check for the target language. */
  useFetchQuality(pid: number, lang: string) {
    return useApiRequest({
      key: ['quality', pid, lang],
      apiCall: () => api.getQuality({ pid, lang }),
      preventRequest: !lang,
    })
  },

  /** The same check once, e.g. to ask about open problems before approving. */
  getQuality: (pid: number) => unwrap(api.getQuality({ pid })),

  /** All accepted findings of the project (their `key`); [] reopens all. Run through the project page. */
  acceptFindings: (pid: number, keys: string[]) => unwrap(api.acceptFindings({ pid, acceptedIn: { keys } })),
}
