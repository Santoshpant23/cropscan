import type { FormEvent } from 'react'

export function getFormValue(event: FormEvent<HTMLFormElement>, field: string) {
  const formData = new FormData(event.currentTarget)
  return String(formData.get(field) ?? '').trim()
}
