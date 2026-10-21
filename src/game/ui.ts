import { useSyncExternalStore } from 'react'

export type Phase = 'intro' | 'drive'
type UiState = { phase: Phase; station: string | null; flash: number }

let snap: UiState = { phase: 'intro', station: null, flash: 0 }
const subs = new Set<() => void>()

export const getUi = () => snap
export function setUi(p: Partial<UiState>) {
  snap = { ...snap, ...p }
  subs.forEach((f) => f())
}
export function useUi() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => snap,
  )
}