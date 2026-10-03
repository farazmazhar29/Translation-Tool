import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Use the project's virtualenv when present, otherwise ruff from PATH (e.g. in CI).
const venv = ['.venv/Scripts/ruff.exe', '.venv/bin/ruff'].map((p) => join(import.meta.dirname, p))
const ruff = venv.find(existsSync) ?? 'ruff'
const q = (files) => files.map((f) => `"${f}"`).join(' ')

export default {
  '*.py': (files) => [`"${ruff}" check --fix ${q(files)}`, `"${ruff}" format ${q(files)}`],
}
