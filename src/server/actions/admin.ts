'use server'

import { revalidatePath } from 'next/cache'
import { requireContext } from '@/server/auth/session'
import { applyRetention, saveUnit, saveUser, updateSetting } from '@/server/services/admin'
import { deleteLegalReference, saveLegalReference, setLegalValidation } from '@/server/services/legal'
import type { LegalValidationStatus } from '@/types/domain'
import { run } from './run'

export async function saveUserAction(input: Record<string, unknown>) {
  const ctx = await requireContext()
  const res = await run(() => saveUser(ctx, input as never).then(() => undefined), 'Usuário salvo.')
  revalidatePath('/admin/usuarios')
  return res
}

export async function saveUnitAction(input: Record<string, unknown>) {
  const ctx = await requireContext()
  const res = await run(() => saveUnit(ctx, input as never), 'Unidade salva.')
  revalidatePath('/admin/unidades')
  return res
}

export async function updateSettingAction(key: string, value: unknown) {
  const ctx = await requireContext()
  const res = await run(() => updateSetting(ctx, key, value), 'Configuração salva.')
  revalidatePath('/', 'layout')
  return res
}

export async function applyRetentionAction() {
  const ctx = await requireContext()
  return run(() => applyRetention(ctx))
}

export async function saveLegalReferenceAction(input: Record<string, unknown>) {
  const ctx = await requireContext()
  const res = await run(() => saveLegalReference(ctx, input as never).then(() => undefined), 'Norma salva. Ela precisa ser validada antes de ser usada nas análises.')
  revalidatePath('/normas')
  return res
}

export async function setLegalValidationAction(id: string, status: LegalValidationStatus) {
  const ctx = await requireContext()
  const res = await run(() => setLegalValidation(ctx, id, status), 'Situação de validação atualizada.')
  revalidatePath('/normas')
  return res
}

export async function deleteLegalReferenceAction(id: string) {
  const ctx = await requireContext()
  const res = await run(() => deleteLegalReference(ctx, id), 'Norma removida.')
  revalidatePath('/normas')
  return res
}
