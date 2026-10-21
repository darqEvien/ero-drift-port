import { keys } from './input'
import { CHUNK, buildingsFor } from './city'

/** Paylaşılan, mutable araba durumu (React state değil, her frame okunur/yazılır). */
export const car = {
  x: 0,
  z: 0,
  heading: Math.PI, // radyan, ileri = (sin h, cos h), pozitif = sola
  yawRate: 0,
  vx: 0,
  vz: 0,
  speed: 0, // ileri hız (m/s)
  slip: 0,
  steer: 0,
  drifting: false,
  boosting: false,
  nitro: 1,
  score: 0,
  combo: 0,
  // ---- Vites sistemi ----
  gear: 1,
  rpm: 0.15,
  shiftTimer: 0,
  /** Bu frame'de vites değişimi: 1=yükseldi, -1=düştü, 0=değişmedi */
  lastShiftDir: 0 as -1 | 0 | 1,
}

// ---- Hissiyat ayarları ----
export const MAX_SPEED = 65
const NITRO_SPEED = 90
const MAX_REVERSE = 16
const REVERSE_ACCEL = 18
const BRAKE = 55
const TURN_RATE = 2.3
const GRIP = 5.5 // yanal sürtünme: düşük = daha kaygan
const HANDBRAKE_GRIP = 0.9
const ALIGN = 0.9 // drift'te aracı hareket yönüne hafifçe hizalar (spin-out'u azaltır)

// ---- Otomatik vites ayarları ----
const GEAR_COUNT = 5
/** Her vitesin ulaşabileceği max hız (m/s) → ~50, 94, 148, 194, 234 km/h */
const GEAR_TOP = [14, 26, 41, 54, 65]
/** Her vitesin ivme kuvveti (m/s²) — düşük viteste yüksek, yüksekte düşük */
const GEAR_ACCEL = [22, 16, 11, 7.5, 5]
/** Vites yükseltme eşiği (RPM > bu → üst vites) */
const UPSHIFT_RPM = 0.92
/** Vites düşürme eşiği (RPM < bu → alt vites) */
const DOWNSHIFT_RPM = 0.10
/** Vites geçiş süresi: bu sürede ivme kesilir (s) */
const SHIFT_COOLDOWN = 0.18

/** Verilen hız ve viteste RPM hesapla (0.15 rölanti → 1.0 kırmızı çizgi) */
function calcRpm(speed: number, gear: number): number {
  const absSpeed = Math.abs(speed)
  const minSpd = gear > 1 ? GEAR_TOP[gear - 2] * 0.82 : 0
  const maxSpd = GEAR_TOP[gear - 1]
  const range = maxSpd - minSpd
  if (range <= 0) return 0.15
  const raw = (absSpeed - minSpd) / range
  return 0.15 + Math.max(0, Math.min(1, raw)) * 0.85
}

export function stepCar(dt: number) {
  const target = (keys.left ? 1 : 0) - (keys.right ? 1 : 0)
  car.steer += (target - car.steer) * (1 - Math.exp(-9 * dt))

  // 1) Yön: yaw hızı eylemsizlikle değişir, hız vektörü dünyada kalır -> gerçek drift
  const hx = Math.sin(car.heading)
  const hz = Math.cos(car.heading)
  const l0x = Math.cos(car.heading)
  const l0z = -Math.sin(car.heading)
  const vf0 = car.vx * hx + car.vz * hz
  const vl0 = car.vx * l0x + car.vz * l0z
  const speedFactor = Math.min(Math.abs(vf0) / 10, 1) * (1 - 0.3 * Math.min(Math.abs(vf0) / MAX_SPEED, 1))
  let yawTarget = car.steer * TURN_RATE * speedFactor * (vf0 >= 0 ? 1 : -1) * (keys.brake ? 1.4 : 1)
  if (vf0 > 6 && !keys.brake) yawTarget += ALIGN * Math.atan2(vl0, vf0) * Math.min(1, vf0 / 20)
  car.yawRate += (yawTarget - car.yawRate) * (1 - Math.exp(-10 * dt))
  car.heading += car.yawRate * dt

  // 2) Yeni yöne göre hız bileşenleri
  const fx = Math.sin(car.heading)
  const fz = Math.cos(car.heading)
  const lx = Math.cos(car.heading)
  const lz = -Math.sin(car.heading)
  let vf = car.vx * fx + car.vz * fz
  let vl = car.vx * lx + car.vz * lz

  // ---- Otomatik vites mantığı ----
  car.lastShiftDir = 0
  if (car.shiftTimer > 0) {
    car.shiftTimer = Math.max(0, car.shiftTimer - dt)
  } else if (vf > 2) {
    // İleri giderken vites geçişi
    const currentRpm = calcRpm(vf, car.gear)
    if (currentRpm >= UPSHIFT_RPM && car.gear < GEAR_COUNT && keys.up) {
      car.gear++
      car.shiftTimer = SHIFT_COOLDOWN
      car.lastShiftDir = 1
    } else if (currentRpm <= DOWNSHIFT_RPM && car.gear > 1) {
      car.gear--
      car.shiftTimer = SHIFT_COOLDOWN
      car.lastShiftDir = -1
    }
  }
  // Duruyorken veya geri giderken 1. vites
  if (vf <= 1 && car.gear > 1) {
    car.gear = 1
  }
  car.rpm = calcRpm(vf, car.gear)

  // 3) Nitro
  car.boosting = keys.nitro && car.nitro > 0.02 && vf > 5
  // Vites geçişi sırasında ivme büyük ölçüde kesilir
  const shifting = car.shiftTimer > 0
  const baseAccel = shifting ? GEAR_ACCEL[car.gear - 1] * 0.12 : GEAR_ACCEL[car.gear - 1]
  const accel = baseAccel * (car.boosting ? 2.2 : 1)
  const gearCap = GEAR_TOP[car.gear - 1]
  const cap = car.boosting ? NITRO_SPEED : gearCap
  if (car.boosting) car.nitro = Math.max(0, car.nitro - dt * 0.3)
  else car.nitro = Math.min(1, car.nitro + dt * 0.02)

  if (keys.up || car.boosting) {
    if (vf < cap) vf += accel * dt
  }
  if (keys.down) vf -= (vf > 0.5 ? BRAKE : REVERSE_ACCEL) * dt
  if (!keys.up && !keys.down) vf *= Math.exp(-0.9 * dt)
  vf *= Math.exp(-0.12 * dt)
  // Global hız sınırı (nitro hariç)
  if (vf > MAX_SPEED && !car.boosting) vf = Math.max(MAX_SPEED, vf - 30 * dt)
  vf = Math.max(-MAX_REVERSE, vf)

  // 4) Yanal tutuş: gaz + sert direksiyon + hız = güç kayması, el freni = kayma
  const powerSlide = keys.up && Math.abs(car.steer) > 0.6 && Math.abs(vf) > 24 ? 0.5 : 1
  const grip = (keys.brake ? HANDBRAKE_GRIP : GRIP) * powerSlide
  vl *= Math.exp(-grip * dt)
  if (keys.brake) vf *= Math.exp(-0.6 * dt)

  car.vx = fx * vf + lx * vl
  car.vz = fz * vf + lz * vl
  car.x += car.vx * dt
  car.z += car.vz * dt
  collideBuildings()
  car.speed = car.vx * fx + car.vz * fz
  car.slip = Math.abs(car.vx * lx + car.vz * lz)
  car.drifting = car.slip > 6 && Math.abs(vf) > 10

  if (car.drifting) {
    car.combo += dt
    car.score += car.slip * dt * (1 + car.combo * 0.25)
    car.nitro = Math.min(1, car.nitro + car.slip * dt * 0.006) // drift nitro doldurur
  } else {
    car.combo = Math.max(0, car.combo - dt * 2)
  }
}

const HIT_R = 1.8
/** Daire (araba) - AABB (bina) çarpışması: dışarı it, çarpma yönündeki hızı sektir ve azalt. */
function collideBuildings() {
  const cx = Math.round(car.x / CHUNK)
  const cz = Math.round(car.z / CHUNK)
  for (let ox = -1; ox <= 1; ox++)
    for (let oz = -1; oz <= 1; oz++)
      for (const b of buildingsFor(cx + ox, cz + oz)) {
        const nx = Math.max(b.x - b.w / 2, Math.min(b.x + b.w / 2, car.x))
        const nz = Math.max(b.z - b.d / 2, Math.min(b.z + b.d / 2, car.z))
        const dx = car.x - nx
        const dz = car.z - nz
        const d2 = dx * dx + dz * dz
        if (d2 >= HIT_R * HIT_R) continue
        let px: number, pz: number, pen: number
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2)
          px = dx / d
          pz = dz / d
          pen = HIT_R - d
        } else {
          px = car.x >= b.x ? 1 : -1
          pz = 0
          pen = HIT_R
        }
        car.x += px * pen
        car.z += pz * pen
        const vn = car.vx * px + car.vz * pz
        if (vn < 0) {
          car.vx = (car.vx - 1.3 * vn * px) * 0.9
          car.vz = (car.vz - 1.3 * vn * pz) * 0.9
        }
      }
}

export function teleport(x: number, z: number, heading: number) {
  car.x = x
  car.z = z
  car.heading = heading
  car.vx = car.vz = car.speed = car.yawRate = car.steer = 0
  car.gear = 1
  car.rpm = 0.15
  car.shiftTimer = 0
  car.lastShiftDir = 0
}
