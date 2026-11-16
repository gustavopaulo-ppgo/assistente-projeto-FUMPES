import { z } from 'zod'
import { NotFoundError, PermissionError, ValidationError, canManageLegalReferences } from '@/server/auth/permissions'
import { idSchema, legalReferenceSchema, zodMessages } from '@/server/validation/schemas'
import type { LegalReference, LegalValidationStatus } from '@/types/domain'
import { audit, newId, nowIso, type Ctx } from './common'

export async function listLegalReferences(ctx: Ctx): Promise<LegalReference[]> {
  return ctx.store.list('legal_references', { orderBy: { column: 'number' } })
}

export async function saveLegalReference(ctx: Ctx, input: z.input<typeof legalReferenceSchema>): Promise<LegalReference> {
  if (!canManageLegalReferences(ctx.user)) throw new PermissionError('Somente administradores gerenciam a base normativa.')
  const parsed = legalReferenceSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Dados da norma inválidos.', zodMessages(parsed.error))
  const { id, ...data } = parsed.data
  const rules = data.rules.map((r) => ({ ...r, provision: r.provision ?? null }))
  if (id) {
    const existing = await ctx.store.get('legal_references', id)
    if (!existing || existing.deleted_at) throw new NotFoundError()
    // Qualquer alteração de conteúdo volta a exigir validação humana.
    const updated = await ctx.store.update('legal_references', id, {
      ...data,
      rules,
      validation_status: 'nao_verificada',
      validated_by: null,
    })
    await audit(ctx, 'editar_norma', 'legal_references', id, null, { numero: data.number })
    return updated
  }
  const row: LegalReference = {
    id: newId(),
    ...data,
    rules,
    last_verified_at: null,
    validation_status: 'nao_verificada',
    validated_by: null,
    created_at: nowIso(),
    deleted_at: null,
  }
  await ctx.store.insert('legal_references', row)
  await audit(ctx, 'criar_norma', 'legal_references', row.id, null, { numero: row.number })
  return row
}

/** Registro da verificação humana de vigência/conteúdo da norma. */
export async function setLegalValidation(ctx: Ctx, id: string, status: LegalValidationStatus): Promise<void> {
  if (!canManageLegalReferences(ctx.user)) throw new PermissionError()
  if (!idSchema.safeParse(id).success) throw new NotFoundError()
  if (!['nao_verificada', 'verificada', 'desatualizada'].includes(status)) throw new ValidationError('Status inválido.')
  const ref = await ctx.store.get('legal_references', id)
  if (!ref || ref.deleted_at) throw new NotFoundError()
  if (status === 'verificada' && !ref.official_url) {
    throw new ValidationError('Informe a URL oficial antes de marcar a norma como verificada.')
  }
  await ctx.store.update('legal_references', id, {
    validation_status: status,
    validated_by: status === 'verificada' ? ctx.user.id : null,
    last_verified_at: status === 'verificada' ? nowIso().slice(0, 10) : ref.last_verified_at,
  })
  await audit(ctx, 'validar_norma', 'legal_references', id, null, { status })
}

export async function deleteLegalReference(ctx: Ctx, id: string): Promise<void> {
  if (!canManageLegalReferences(ctx.user)) throw new PermissionError()
  const ref = await ctx.store.get('legal_references', id)
  if (!ref) throw new NotFoundError()
  await ctx.store.softDelete('legal_references', id)
  await audit(ctx, 'excluir_norma', 'legal_references', id, null, { numero: ref.number })
}
