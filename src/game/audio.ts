import { car } from './state'
import { keys } from './input'

// --- Ses dosyaları ---
import idleUrl from '../assets/sounds/freesound_community-rally-car-idle-loop-17-84405.mp3?url'
import accelUrl from '../assets/sounds/9830-toyota-gt86-acceleration-01-preview.mp3?url'
import tireUrl from '../assets/sounds/Tire-screech-sound-effect.mp3?url'
import turboUrl from '../assets/sounds/turbo-flutter.mp3?url'

let ctx: AudioContext | null = null

// ---- Motor: Katman 1 — Rölanti loop ----
let idleSource: AudioBufferSourceNode | null = null
let idleGain: GainNode

// ---- Motor: Katman 2 — GT86 rev (kısa bölüm loop) ----
let revSource: AudioBufferSourceNode | null = null
let revGain: GainNode
let revFilter: BiquadFilterNode

// ---- Lastik gıcırtısı ----
let tireSource: AudioBufferSourceNode | null = null
let tireGain: GainNode

// ---- Turbo flutter ----
let turboBuffer: AudioBuffer | null = null
let turboGain: GainNode
let turboPlaying = false
let turboSource: AudioBufferSourceNode | null = null

// ---- Durum takibi ----
let prevGas = false
let prevGear = 1

async function loadBuffer(url: string): Promise<AudioBuffer> {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  return ctx!.decodeAudioData(buf)
}

/**
 * Kullanıcı etkileşiminden sonra bir kez çağır.
 * İki katmanlı motor sesi + lastik + turbo kurar.
 *
 * Katman 1 (Idle): Rölanti loop sesi, düşük RPM'de baskın.
 *   → playbackRate ile hafif pitch shift
 *
 * Katman 2 (Rev): GT86 dosyasının orta bölümü (~5 saniyelik loop).
 *   → RPM yükseldikçe fade-in, düşük pitch shift ile doğal motor tonu.
 *   Tüm dosyayı loop etmek yerine kısa bir bölüm loop ederek
 *   "tekrarlayan hızlanma" hissini önlüyoruz.
 */
export async function startAudio() {
  if (ctx) return
  ctx = new AudioContext()

  const master = ctx.createGain()
  master.gain.value = 0.65
  master.connect(ctx.destination)

  // =====================================================
  // 1) IDLE LOOP — Ana motor taban sesi
  //    Temiz loop, pitch shift ile doğal RPM hissi
  // =====================================================
  idleGain = ctx.createGain()
  idleGain.gain.value = 0.4
  idleGain.connect(master)

  const idleBuf = await loadBuffer(idleUrl)
  idleSource = ctx.createBufferSource()
  idleSource.buffer = idleBuf
  idleSource.loop = true
  idleSource.connect(idleGain)
  idleSource.start()

  // =====================================================
  // 2) REV LAYER — GT86 dosyasından ~5 saniyelik bölüm
  //    Yüksek RPM'de ek motor dokusu / agresiflik ekler.
  //    Tüm 33 saniyeyi loop etmek yerine sadece orta kısmı
  //    loop ediyoruz → daha temiz ve doğal ses.
  //    ÖNEMLİ: loopStart/loopEnd değerlerini sesin içeriğine
  //    göre ayarlayabilirsin (şu an 7s-13s arası loop).
  // =====================================================
  revFilter = ctx.createBiquadFilter()
  revFilter.type = 'lowpass'
  revFilter.frequency.value = 800

  revGain = ctx.createGain()
  revGain.gain.value = 0
  revFilter.connect(revGain).connect(master)

  const accelBuf = await loadBuffer(accelUrl)
  revSource = ctx.createBufferSource()
  revSource.buffer = accelBuf
  revSource.loop = true
  // GT86 ses dosyasının orta bölümünü loop et
  // Dosyanın ~7-13. saniyeleri genelde düzgün motor uğultusu içerir
  revSource.loopStart = 7
  revSource.loopEnd = 13
  revSource.connect(revFilter)
  revSource.start(0, 7) // loop bölgesinden başla

  // =====================================================
  // 3) TIRE SCREECH — Drift sırasında lastik sesi
  // =====================================================
  tireGain = ctx.createGain()
  tireGain.gain.value = 0
  tireGain.connect(master)

  const tireBuf = await loadBuffer(tireUrl)
  tireSource = ctx.createBufferSource()
  tireSource.buffer = tireBuf
  tireSource.loop = true
  tireSource.connect(tireGain)
  tireSource.start()

  // =====================================================
  // 4) TURBO FLUTTER — Vites geçişi + gaz bırakma
  // =====================================================
  turboGain = ctx.createGain()
  turboGain.gain.value = 0
  turboGain.connect(master)
  turboBuffer = await loadBuffer(turboUrl)

  prevGas = false
  prevGear = car.gear
}

/**
 * Her frame çağrılır.
 * car.rpm ve car.gear'e göre tüm ses parametrelerini günceller.
 */
export function updateAudio() {
  if (!ctx || !idleSource || !revSource) return

  const t = ctx.currentTime
  const rpm = car.rpm // 0.15 (rölanti) → 1.0 (kırmızı çizgi)

  // -------------------------------------------------------
  // A) IDLE LOOP — Taban motor sesi
  //    RPM düşükken yüksek volume, yükselince sessizleşir
  // -------------------------------------------------------
  const idleVol = Math.max(0.05, 0.45 - rpm * 0.38)
  idleGain.gain.setTargetAtTime(idleVol, t, 0.1)
  // Hafif pitch shift: rölantide derin, yüksek RPM'de biraz tiz
  idleSource.playbackRate.setTargetAtTime(0.75 + rpm * 0.45, t, 0.08)

  // -------------------------------------------------------
  // B) REV LAYER (GT86) — Yüksek RPM motor dokusu
  //    RPM 0.3'ün altında sessiz, üstünde yavaşça artar
  //    Pitch shift dar aralıkta (0.8x–1.3x) → doğal ses
  // -------------------------------------------------------
  const rpmPower = Math.max(0, (rpm - 0.3) / 0.7) // 0 → 1
  const gasBonus = keys.up ? 0.12 : 0
  const boostBonus = car.boosting ? 0.1 : 0
  const revVol = Math.min(0.65, rpmPower * 0.5 + gasBonus + boostBonus)
  revGain.gain.setTargetAtTime(revVol, t, 0.08)
  // Dar pitch aralığı → ses doğal kalır, vites hissedilir
  revSource.playbackRate.setTargetAtTime(0.8 + rpm * 0.5, t, 0.06)
  // Filtre: düşük RPM'de boğuk, yüksek RPM'de tüm frekanslar açılır
  revFilter.frequency.setTargetAtTime(500 + rpm * 4500, t, 0.05)

  // -------------------------------------------------------
  // C) TIRE SCREECH — Drift sırasında kayma sesine orantılı
  // -------------------------------------------------------
  if (car.drifting) {
    const slipNorm = Math.min(1, car.slip / 18)
    tireGain.gain.setTargetAtTime(slipNorm * 0.3, t, 0.05)
    if (tireSource) {
      tireSource.playbackRate.setTargetAtTime(0.8 + slipNorm * 0.4, t, 0.08)
    }
  } else {
    tireGain.gain.setTargetAtTime(0, t, 0.12)
  }

  // -------------------------------------------------------
  // D) TURBO FLUTTER
  //    1) Vites yükseldiğinde (upshift) → turbo "pşşt"
  //    2) Gazdan çekildiğinde + yeterli hız → turbo blow-off
  // -------------------------------------------------------
  if (car.lastShiftDir === 1 && car.gear !== prevGear) {
    playTurbo(0.75)
  }
  const gasNow = keys.up || car.boosting
  if (prevGas && !gasNow && Math.abs(car.speed) > 20) {
    playTurbo(1.0)
  }

  prevGas = gasNow
  prevGear = car.gear
}

/** Turbo flutter one-shot çalar */
function playTurbo(volumeScale: number) {
  if (!ctx || !turboBuffer || turboPlaying) return

  turboPlaying = true

  if (turboSource) {
    try { turboSource.stop() } catch { /* zaten bitmiş */ }
  }

  turboSource = ctx.createBufferSource()
  turboSource.buffer = turboBuffer
  turboSource.loop = false

  const speedRatio = Math.min(1, Math.abs(car.speed) / 65)
  turboSource.playbackRate.value = 0.85 + speedRatio * 0.5

  turboGain.gain.setValueAtTime(
    (0.35 + speedRatio * 0.3) * volumeScale,
    ctx.currentTime,
  )
  turboSource.connect(turboGain)
  turboSource.start()

  turboSource.onended = () => {
    turboPlaying = false
  }
}
