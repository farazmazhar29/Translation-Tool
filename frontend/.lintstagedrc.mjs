// lint-staged runs this file's commands inside frontend/, so ESLint finds its config.
const q = (files) => files.map((f) => `"${f}"`).join(' ')

export default {
  '*.{ts,tsx}': (files) => [`eslint --fix ${q(files)}`, `prettier --write ${q(files)}`],
  '*.{js,json,css}': (files) => `prettier --write ${q(files)}`,
}
