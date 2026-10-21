export const keys = { up: false, down: false, left: false, right: false, brake: false, nitro: false }

/** C tuşu ile değişen kamera modu: 0 takip, 1 yüksek/uzak, 2 kaput */
export const view = { mode: 0 }

const map: Record<string, keyof typeof keys> = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'brake',
  ShiftLeft: 'nitro', ShiftRight: 'nitro',
}

export function bindInput() {
  const handler = (v: boolean) => (e: KeyboardEvent) => {
    if (e.code === 'KeyC') {
      if (v && !e.repeat) view.mode = (view.mode + 1) % 3
      return
    }
    const k = map[e.code]
    if (!k) return
    e.preventDefault()
    keys[k] = v
  }
  const down = handler(true)
  const up = handler(false)
  const blur = () => Object.keys(keys).forEach((k) => (keys[k as keyof typeof keys] = false))
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
  }
}