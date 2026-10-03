import type { S } from '../api/client'

export const settings = (): S['SettingsOut'] => ({
  llm_provider: 'mock',
  llm_model: 'test',
  default_source_lang: 'auto',
  default_target_langs: ['en'],
  default_export_format: 'docx',
  default_export_mode: 'translation',
  colors: { technical: '#3b82f6', glossary: '#22c55e', ambiguous: '#f59e0b', unknown: '#ef4444', protected: '#a855f7' },
  gemini_key_configured: false,
})

export const term = (over: Partial<S['Term']> = {}): S['Term'] => ({
  source: 'Korpus',
  target: 'carcass',
  category: 'glossary',
  alternatives: [],
  description: '',
  glossary_id: null,
  dnt: false,
  ok: true,
  ...over,
})

export const segment = (over: Partial<S['SegmentOut']> = {}): S['SegmentOut'] => ({
  id: 7,
  idx: 0,
  source_text: 'Der Korpus ist weiß.',
  locator: {},
  translations: {
    en: {
      text: 'The carcass is white.',
      original_text: 'The carcass is white.',
      terms: [term()],
      comment: '',
      edited: false,
      edited_by: '',
    },
  },
  ...over,
})

export const project = (over: Partial<S['ProjectOut']> = {}): S['ProjectOut'] => ({
  id: 1,
  name: 'Testprojekt',
  customer: '',
  filename: 'test.docx',
  file_type: 'docx',
  source_lang: 'auto',
  detected_lang: 'de',
  target_langs: ['en'],
  status: 'approved',
  archived: false,
  job_state: 'done',
  job_progress: 100,
  job_error: '',
  structure: {},
  created_by: 'translator',
  created_at: '2026-10-01T10:00:00',
  updated_at: '2026-10-01T10:00:00',
  ...over,
})
