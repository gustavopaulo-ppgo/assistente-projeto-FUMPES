import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { NotFoundError } from '@/server/auth/permissions'
import { requireContext } from '@/server/auth/session'
import { getBundleForUser } from '@/server/services/projects'

/** Carrega o projeto para páginas (deduplicado por requisição); 404 quando sem acesso. */
export const loadProjectPage = cache(async (id: string) => {
  const ctx = await requireContext()
  try {
    const bundle = await getBundleForUser(ctx, id)
    return { ctx, bundle }
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
})
