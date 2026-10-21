import { car } from './state'
import { keys } from './input'

let ctx: AudioContext | null = null
let osc: OscillatorNode
let sub: OscillatorNode
let engineGain: GainNode
let engineFilter: BiquadFilterNode
let squealGain: GainNode

/** Kullanıcı etkileşiminden sonra bir kez çağır. */
export function startAudio() {
  if (ctx) return
  ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 0.5
  master.connect(ctx.destination)

  engineFilter = ctx.createBiquadFilter()
  engineFilter.type = 'lowpass'
  engineGain = ctx.createGain()
  engineGain.gain.value = 0
  osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  sub = ctx.createOscillator()
  sub.type = 'square'
  osc.connect(engineFilter)
  sub.connect(engineFilter)
  engineFilter.connect(engineGain).connect(master)
  osc.start()
  sub.start()

  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = buf
  noise.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1900
  bp.Q.value = 3
  squealGain = ctx.createGain()
  squealGain.gain.value = 0
  noise.connect(bp).connect(squealGain).connect(master)
  noise.start()
}

export function updateAudio() {
  if (!ctx) return
  const t = ctx.currentTime
  const s = Math.min(1.4, Math.abs(car.speed) / 62)
  // sahte vites kutusu: 5 vites, her vitesin içinde rpm yükselir
  const gs = Math.min(s * 5, 5.99)
  const frac = gs - Math.floor(gs)
  const rpm = 0.25 + 0.75 * frac + (keys.up ? 0.1 : 0) + (car.boosting ? 0.15 : 0)
  const f = 40 + rpm * 150
  osc.frequency.setTargetAtTime(f, t, 0.04)
  sub.frequency.setTargetAtTime(f * 0.5, t, 0.04)
  engineFilter.frequency.setTargetAtTime(350 + rpm * 1800, t, 0.05)
  engineGain.gain.setTargetAtTime(0.05 + (keys.up ? 0.07 : 0) + (car.boosting ? 0.05 : 0), t, 0.08)
  squealGain.gain.setTargetAtTime(car.drifting ? Math.min(1, car.slip / 16) * 0.12 : 0, t, 0.06)
}
