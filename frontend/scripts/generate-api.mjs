// Generates the typed API client in src/shared/api/generated from openapi.json, which the backend writes
// (`python export_openapi.py`). The generator (openapi-generator, typescript-axios) runs in Docker, so neither
// Java nor its npm wrapper is needed; the output is committed, so building the app needs neither.
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'

// 7.14 marked shared enums nullable once an optional query parameter used them (`status: ProjectStatus | null`)
const IMAGE = 'openapitools/openapi-generator-cli:v7.26.0'
const OUTPUT = 'src/shared/api/generated'

rmSync(OUTPUT, { recursive: true, force: true }) // removed endpoints must not linger
execFileSync(
  'docker',
  [
    'run',
    '--rm',
    '-v',
    `${process.cwd()}:/local`,
    IMAGE,
    'generate',
    '--input-spec=/local/openapi.json',
    '--generator-name=typescript-axios',
    `--output=/local/${OUTPUT}`,
    // one object per call, like factory.getProjectDetail({ pid }); enums as plain string unions
    '--additional-properties=useSingleRequestParameter=true,supportsES6=true,stringEnums=false',
    // only the client: no git_push.sh, README, package files or Markdown docs
    '--global-property=apis,models,apiDocs=false,modelDocs=false,supportingFiles=api.ts:base.ts:common.ts:configuration.ts:index.ts',
  ],
  { stdio: 'inherit' },
)
rmSync(`${OUTPUT}/.openapi-generator`, { recursive: true, force: true }) // the generator's own bookkeeping

// The project compiles with `erasableSyntaxOnly` (only syntax that type stripping can remove). Two generated
// constructors use parameter properties, which that forbids; they become plain fields. A different generator
// version may write them differently: then this stops with a message instead of leaving code that fails to build.
const BASE = `${OUTPUT}/base.ts`
const REWRITES = [
  [
    'constructor(configuration?: Configuration, protected basePath: string = BASE_PATH, protected axios: AxiosInstance = globalAxios) {',
    'protected basePath: string;\n    protected axios: AxiosInstance;\n\n' +
      '    constructor(configuration?: Configuration, basePath: string = BASE_PATH, axios: AxiosInstance = globalAxios) {\n' +
      '        this.basePath = basePath;\n        this.axios = axios;',
  ],
  [
    'constructor(public field: string, msg?: string) {\n        super(msg);',
    'field: string;\n\n    constructor(field: string, msg?: string) {\n        super(msg);\n        this.field = field;',
  ],
]
let base = readFileSync(BASE, 'utf8')
for (const [from, to] of REWRITES) {
  if (!base.includes(from)) throw new Error(`${BASE}: expected generated code not found, update REWRITES:\n${from}`)
  base = base.replace(from, to)
}
writeFileSync(BASE, base)

// api.ts imports every helper of common.ts, also those no endpoint needs; `noUnusedLocals` rejects them.
const API = `${OUTPUT}/api.ts`
let api = readFileSync(API, 'utf8')
api = api.replace(/import \{([^}]*)\} from '\.\/common';/, (whole, list) => {
  const used = list
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name && api.split(new RegExp(`\\b${name}\\b`)).length > 2) // once in the import, once in use
  return `import {\n    ${used.join(',\n    ')}\n} from './common';`
})
writeFileSync(API, api)
