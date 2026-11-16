import { attachment, errorResponse, routeContext } from '@/server/route-helpers'
import { getFileStorage } from '@/server/storage'
import { getDocumentDownload } from '@/server/services/documents'

/**
 * Download de documento privado. Permissão verificada a cada acesso.
 * Com Supabase, redireciona para URL assinada válida por 60 segundos.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await routeContext()
  if (!ctx) return Response.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  try {
    const { doc, url, bytes } = await getDocumentDownload(ctx, getFileStorage(), id)
    if (url) return Response.redirect(url, 302)
    return new Response(Buffer.from(bytes!), {
      headers: {
        'Content-Type': doc.mime_type,
        'Content-Disposition': attachment(doc.name),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
