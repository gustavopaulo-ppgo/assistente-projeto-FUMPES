import fs from 'node:fs'
import path from 'node:path'
import { SOFT_DELETE_TABLES, type ListOptions, type Store, type TableName, type Tables, type WhereValue } from './types'

type Data = { [K in TableName]: Tables[K][] }

export function emptyData(): Data {
  return {
    organizational_units: [],
    profiles: [],
    user_roles: [],
    projects: [],
    project_members: [],
    project_sections: [],
    project_versions: [],
    project_objectives: [],
    project_indicators: [],
    project_budget_items: [],
    project_schedule: [],
    project_risks: [],
    project_documents: [],
    project_reviews: [],
    project_approvals: [],
    legal_references: [],
    funding_sources: [],
    project_funding_allocations: [],
    project_expenses: [],
    project_deliverables: [],
    accountability_records: [],
    audit_logs: [],
    ai_interactions: [],
    system_settings: [],
  }
}

function matches(row: Record<string, unknown>, where: Record<string, WhereValue | undefined>): boolean {
  for (const [key, expected] of Object.entries(where)) {
    if (expected === undefined) continue
    const actual = row[key]
    if (Array.isArray(expected)) {
      if (!expected.includes(actual as never)) return false
    } else if (actual !== expected) {
      return false
    }
  }
  return true
}

const clone = <T>(v: T): T => structuredClone(v)

/**
 * Armazenamento em memória do MODO DEMONSTRAÇÃO.
 * Opcionalmente persiste em arquivo JSON local (somente desenvolvimento).
 * Não é adequado para produção: use o adaptador Supabase.
 */
export class MemoryStore implements Store {
  readonly kind = 'memory' as const
  private data: Data
  private persistTimer: NodeJS.Timeout | null = null

  constructor(
    initial?: Partial<Data>,
    private readonly persistFile?: string,
  ) {
    this.data = { ...emptyData(), ...(initial ? clone(initial) : {}) }
  }

  static fromFile(file: string, fallback: () => Partial<Data>): MemoryStore {
    try {
      if (fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Data>
        return new MemoryStore(parsed, file)
      }
    } catch {
      // arquivo corrompido: recomeça com os dados de demonstração
    }
    const store = new MemoryStore(fallback(), file)
    store.schedulePersist()
    return store
  }

  private table<K extends TableName>(table: K): Tables[K][] {
    if (!this.data[table]) (this.data as Record<string, unknown[]>)[table] = []
    return this.data[table]
  }

  private schedulePersist() {
    if (!this.persistFile) return
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => {
      try {
        fs.mkdirSync(path.dirname(this.persistFile!), { recursive: true })
        fs.writeFileSync(this.persistFile!, JSON.stringify(this.data))
      } catch {
        // sistemas de arquivos somente leitura (ex.: Vercel): mantém apenas em memória
      }
    }, 150)
  }

  async list<K extends TableName>(table: K, options: ListOptions<Tables[K]> = {}): Promise<Tables[K][]> {
    let rows = this.table(table).filter((r) => {
      const rec = r as unknown as Record<string, unknown>
      if (SOFT_DELETE_TABLES.has(table) && !options.includeDeleted && rec.deleted_at) return false
      return options.where ? matches(rec, options.where as Record<string, WhereValue>) : true
    })
    if (options.orderBy) {
      const { column, ascending = true } = options.orderBy
      rows = [...rows].sort((a, b) => {
        const va = (a as unknown as Record<string, unknown>)[column] as string | number | null
        const vb = (b as unknown as Record<string, unknown>)[column] as string | number | null
        if (va === vb) return 0
        if (va === null || va === undefined) return 1
        if (vb === null || vb === undefined) return -1
        return (va < vb ? -1 : 1) * (ascending ? 1 : -1)
      })
    }
    if (options.limit) rows = rows.slice(0, options.limit)
    return clone(rows)
  }

  async get<K extends TableName>(table: K, id: string): Promise<Tables[K] | null> {
    const row = this.table(table).find((r) => (r as { id: string }).id === id)
    return row ? clone(row) : null
  }

  async insert<K extends TableName>(table: K, row: Tables[K]): Promise<Tables[K]> {
    const id = (row as { id: string }).id
    if (this.table(table).some((r) => (r as { id: string }).id === id)) {
      throw new Error(`Registro duplicado em ${table}`)
    }
    this.table(table).push(clone(row))
    this.schedulePersist()
    return clone(row)
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<Tables[K]> {
    const rows = this.table(table)
    const idx = rows.findIndex((r) => (r as { id: string }).id === id)
    if (idx < 0) throw new Error(`Registro não encontrado em ${table}`)
    rows[idx] = { ...rows[idx], ...clone(patch) }
    this.schedulePersist()
    return clone(rows[idx])
  }

  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    const rows = this.table(table)
    const idx = rows.findIndex((r) => (r as { id: string }).id === id)
    if (idx >= 0) rows.splice(idx, 1)
    this.schedulePersist()
  }

  async softDelete<K extends TableName>(table: K, id: string): Promise<void> {
    if (!SOFT_DELETE_TABLES.has(table)) throw new Error(`Tabela ${table} não possui exclusão lógica`)
    await this.update(table, id, { deleted_at: new Date().toISOString() } as unknown as Partial<Tables[K]>)
  }
}
