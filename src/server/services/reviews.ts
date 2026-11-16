import { z } from 'zod'
import { PermissionError, ValidationError, reviewTypesFor } from '@/server/auth/permissions'
import { reviewSchema, zodMessages } from '@/server/validation/schemas'
import { audit, newId, nowIso, type Ctx } from './common'
import { getProjectForUser } from './projects'

/** Registro de parecer (gestor de unidade, analista técnico ou gestor financeiro). */
export async function addReview(ctx: Ctx, projectId: string, input: z.input<typeof reviewSchema>) {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Parecer inválido.', zodMessages(parsed.error))
  const { project, members } = await getProjectForUser(ctx, projectId)
  const own = project.owner_id === ctx.user.id || members.some((m) => m.user_id === ctx.user.id)
  if (own || !reviewTypesFor(ctx.user, project).includes(parsed.data.review_type)) {
    throw new PermissionError('Você não pode registrar este tipo de parecer neste projeto.')
  }
  const review = { id: newId(), project_id: projectId, reviewer_id: ctx.user.id, ...parsed.data, created_at: nowIso() }
  await ctx.store.insert('project_reviews', review)
  await audit(ctx, 'registrar_parecer', 'project_reviews', review.id, projectId, { tipo: review.review_type, recomendacao: review.recommendation })
  return review
}
