import { hash } from './palette'

export const CHUNK = 100

export type Building = { x: number; z: number; w: number; d: number; h: number; c: number }

const cache = new Map<string, Building[]>()

/** Chunk'ın dört köşesine (yolların dışında) deterministik binalar yerleştirir. */
export function buildingsFor(cx: number, cz: number): Building[] {
  const key = `${cx},${cz}`
  const hit = cache.get(key)
  if (hit) return hit
  const out: Building[] = []
  let i = 0
  for (const qx of [-1, 1])
    for (const qz of [-1, 1]) {
      i++
      if (hash(cx, cz, 10 + i) < 0.15) continue
      const w = 14 + hash(cx, cz, 20 + i) * 24
      const d = 14 + hash(cx, cz, 30 + i) * 24
      out.push({
        x: cx * CHUNK + qx * (12 + w / 2),
        z: cz * CHUNK + qz * (12 + d / 2),
        w,
        d,
        h: 16 + Math.pow(hash(cx, cz, 40 + i), 2) * 110,
        c: Math.floor(hash(cx, cz, 50 + i) * 3),
      })
    }
  cache.set(key, out)
  if (cache.size > 600) cache.delete(cache.keys().next().value!)
  return out
}