import type { NextRequest } from 'next/server'
import { attachment, errorResponse, routeContext } from '@/server/route-helpers'
import { exportDocument } from '@/server/services/exports'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await routeContext()
  if (!ctx) return Response.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const doc = request.nextUrl.searchParams.get('doc') ?? 'projeto'
  const format = request.nextUrl.searchParams.get('format') ?? 'pdf'
  try {
    const out = await exportDocument(ctx, id, doc, format)
    return new Response(Buffer.from(out.bytes), {
      headers: {
        'Content-Type': out.mime,
        'Content-Disposition': attachment(out.filename),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
