import type { Texts } from '../index'
import type { de } from './de'

export const en: Texts<typeof de> = {
  appName: 'Rotpunkt Translation',
  brandProduct: 'Translation',
  backToProjects: 'Back to projects',
  loading: 'Loading …',
  unknownError: 'Unknown error',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  edit: 'Edit',
  close: 'Close',
  menu: 'Menu',
  logout: 'Log out',
  language: 'Interface language',
  crash: {
    title: 'Something went wrong',
    text: 'The page could not be displayed. Your data is not lost.',
    home: 'Back to start page',
  },
  nav: {
    dashboard: 'Dashboard',
    projects: 'Projects',
    glossary: 'Glossary',
    users: 'Users',
    settings: 'Settings',
  },
  lang: { de: 'German', en: 'English' },
  role: { translator: 'Translator', reviewer: 'Reviewer', admin: 'Administrator' },
  status: {
    new: 'New',
    preview_ready: 'Preview ready',
    in_review: 'In review',
    approved: 'Approved',
    archived: 'Archived',
  },
  category: {
    technical: 'Kitchen technical term',
    glossary: 'Glossary term',
    ambiguous: 'Ambiguous term',
    unknown: 'Unknown / faulty term',
    protected: 'Protected product name / article number',
  },
  exportFormat: { docx: 'Word (.docx)', xlsx: 'Excel (.xlsx)', pdf: 'PDF' },
  exportMode: { translation: 'Translation only', both: 'Original + translation' },
}
