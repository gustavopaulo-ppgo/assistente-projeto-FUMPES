import 'server-only'
import path from 'node:path'
import { env } from '@/lib/env'
import { createSupabaseServerClient } from '@/server/db/supabase'
import { MemoryFileStorage, type FileStorage } from './memory'
export { MemoryFileStorage, type FileStorage }

export class SupabaseFileStorage implements FileStorage {
  constructor(private readonly bucket: string) {}
  private async client() {
    return (await createSupabaseServerClient()).storage.from(this.bucket)
  }
  async put(key: string, bytes: Uint8Array, mime: string) {
    const { error } = await (await this.client()).upload(key, bytes, { contentType: mime, upsert: false })
    if (error) throw new Error('Falha ao armazenar o arquivo.')
  }
  async get(key: string) {
    const { data, error } = await (await this.client()).download(key)
    if (error || !data) return null
    return new Uint8Array(await data.arrayBuffer())
  }
  async signedUrl(key: string, seconds: number, downloadName: string) {
    const { data, error } = await (await this.client()).createSignedUrl(key, seconds, { download: downloadName })
    if (error || !data) return null
    return data.signedUrl
  }
  async remove(key: string) {
    await (await this.client()).remove([key])
  }
}

export function getFileStorage(): FileStorage {
  const e = env()
  if (e.DATA_BACKEND === 'supabase') return new SupabaseFileStorage(e.SUPABASE_STORAGE_BUCKET)
  const dir = e.NODE_ENV === 'development' ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), '.data/uploads') : undefined
  return new MemoryFileStorage(dir)
}
