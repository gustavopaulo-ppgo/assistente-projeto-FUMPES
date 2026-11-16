import fs from 'node:fs'
import path from 'node:path'

/**
 * Armazenamento de arquivos. Em produção: Supabase Storage em bucket
 * PRIVADO, com acesso por URL assinada de curta duração.
 */
export interface FileStorage {
  put(key: string, bytes: Uint8Array, mime: string): Promise<void>
  get(key: string): Promise<Uint8Array | null>
  /** URL temporária (Supabase). Retorna null quando o download deve passar pelo servidor. */
  signedUrl(key: string, seconds: number, downloadName: string): Promise<string | null>
  remove(key: string): Promise<void>
}

const memoryFiles = (globalThis as unknown as { __funpesFiles?: Map<string, Uint8Array> }).__funpesFiles ?? new Map()
;(globalThis as unknown as { __funpesFiles?: Map<string, Uint8Array> }).__funpesFiles = memoryFiles

export class MemoryFileStorage implements FileStorage {
  constructor(private readonly dir?: string) {}
  private file(key: string) {
    const resolved = path.resolve(this.dir!, key)
    if (!resolved.startsWith(path.resolve(this.dir!))) throw new Error('Caminho inválido')
    return resolved
  }
  async put(key: string, bytes: Uint8Array) {
    memoryFiles.set(key, bytes)
    if (this.dir) {
      try {
        fs.mkdirSync(path.dirname(this.file(key)), { recursive: true })
        fs.writeFileSync(this.file(key), bytes)
      } catch {
        /* somente memória */
      }
    }
  }
  async get(key: string) {
    if (memoryFiles.has(key)) return memoryFiles.get(key)!
    if (this.dir) {
      try {
        return new Uint8Array(fs.readFileSync(this.file(key)))
      } catch {
        return null
      }
    }
    return null
  }
  async signedUrl() {
    return null
  }
  async remove(key: string) {
    memoryFiles.delete(key)
    if (this.dir) fs.rmSync(this.file(key), { force: true })
  }
}

