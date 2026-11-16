'use client'

import { useActionState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { setPasswordAction } from '@/server/actions/auth'

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPasswordAction, null)
  return (
    <form action={action} className="mt-4 space-y-4">
      <Field label="Nova senha" htmlFor="password" required help="Mínimo de 12 caracteres, com letras e números.">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} className={inputClass} />
      </Field>
      <Field label="Confirme a senha" htmlFor="confirm" required>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={12} className={inputClass} />
      </Field>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        Salvar senha e entrar
      </Button>
    </form>
  )
}
