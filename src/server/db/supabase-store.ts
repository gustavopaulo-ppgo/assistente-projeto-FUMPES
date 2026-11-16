import type { SupabaseClient } from '@supabase/supabase-js'
import { SOFT_DELETE_TABLES, type ListOptions, type Store, type TableName, type Tables } from './types'

const WRITE_ONLY: ReadonlySet<TableName> = new Set<TableName>(['audit_logs'])

/** Colunas numeric: o PostgREST as devolve como número JSON; o domínio usa string decimal. */
const NUMERIC_COLUMNS = new Set(['quantity', 'unit_price', 'total', 'requested_amount', 'approved_amount', 'planned_amount', 'amount'])

function normalize<T>(row: T): T {
  if (!row || typeof row !== 'object') return row
  const out = { ...(row as Record<string, unknown>) }
  for (const k of Object.keys(out)) {
    if (NUMERIC_COLUMNS.has(k) && out[k] !== null && out[k] !== undefined) {
      const n = Number(out[k])
      out[k] = k === 'quantity' ? String(out[k]) : n.toFixed(2)
    }
  }
  return out as T
}

/**
 * Adaptador Supabase/PostgreSQL. Usa o cliente vinculado à sessão do
 * usuário (chave anônima + JWT), de modo que as políticas RLS do banco
 * são aplicadas em todas as operações, em complemento às verificações
 * de autorização feitas nos serviços.
 */

export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const
  constructor(private readonly client: SupabaseClient) {}

  private fail(op: string, table: string, error: { message: string; code?: string }): never {
    // Não propaga detalhes internos ao usuário; o log fica no servidor.
    console.error(`[db] ${op} ${table}: ${error.code ?? ''} ${error.message}`)
    throw new Error(`Falha de persistência (${op} em ${table}).`)
  }

  async list<K extends TableName>(table: K, options: ListOptions<Tables[K]> = {}): Promise<Tables[K][]> {
    let query = this.client.from(table).select('*')
    for (const [key, value] of Object.entries(options.where ?? {})) {
      if (value === undefined) continue
      if (Array.isArray(value)) {
        if (value.length === 0) return []
        query = query.in(key, value as (string | number)[])
      } else if (value === null) {
        query = query.is(key, null)
      } else {
        query = query.eq(key, value as string | number | boolean)
      }
    }
    if (SOFT_DELETE_TABLES.has(table) && !options.includeDeleted) query = query.is('deleted_at', null)
    if (options.orderBy) query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true })
    if (options.limit) query = query.limit(options.limit)
    const { data, error } = await query
    if (error) this.fail('list', table, error)
    return ((data ?? []) as Tables[K][]).map(normalize)
  }

  async get<K extends TableName>(table: K, id: string): Promise<Tables[K] | null> {
    const { data, error } = await this.client.from(table).select('*').eq('id', id).maybeSingle()
    if (error) this.fail('get', table, error)
    return data ? normalize(data as Tables[K]) : null
  }

  async insert<K extends TableName>(table: K, row: Tables[K]): Promise<Tables[K]> {
    // Tabelas de escrita sem leitura pelo autor (ex.: auditoria) não usam RETURNING,
    // pois a política de SELECT bloquearia o retorno.
    if (WRITE_ONLY.has(table)) {
      const { error } = await this.client.from(table).insert(row as never)
      if (error) this.fail('insert', table, error)
      return row
    }
    const { data, error } = await this.client.from(table).insert(row as never).select('*').single()
    if (error) this.fail('insert', table, error)
    return normalize(data as Tables[K])
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<Tables[K]> {
    const { data, error } = await this.client.from(table).update(patch as never).eq('id', id).select('*').single()
    if (error) this.fail('update', table, error)
    return normalize(data as Tables[K])
  }

  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    const { error } = await this.client.from(table).delete().eq('id', id)
    if (error) this.fail('remove', table, error)
  }

  async softDelete<K extends TableName>(table: K, id: string): Promise<void> {
    if (!SOFT_DELETE_TABLES.has(table)) throw new Error(`Tabela ${table} não possui exclusão lógica`)
    const { error } = await this.client
      .from(table)
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq('id', id)
    if (error) this.fail('softDelete', table, error)
  }
}
