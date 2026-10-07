import { useApiRequest, useMutation, unwrap } from '../base'
import { API_CONFIG } from '../config'
import { SettingsApiFactory, type SettingsOut } from '../generated'

const api = SettingsApiFactory(API_CONFIG)

/**
 * The application settings. Shared, not in the settings feature: highlight colours and export defaults are read
 * all over the app, and `shared/` must not import features.
 */
export const SettingsService = {
  useFetchSettings() {
    return useApiRequest({ key: ['settings'], apiCall: () => api.getSettings() })
  },

  /** Admins only; unknown keys are ignored by the server. */
  useUpdateSettings() {
    return useMutation((settings: SettingsOut) => unwrap(api.putSettings({ requestBody: { ...settings } })), {
      invalidate: ['settings'],
    })
  },
}
