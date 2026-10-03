export const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const replaceFirst = (text: string, old: string, next: string): string =>
  text.replace(new RegExp(escapeRe(old), 'i'), () => next)
