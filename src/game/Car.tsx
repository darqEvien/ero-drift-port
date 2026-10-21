import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import {
  AdditiveBlending,
  Box3,
  Group,
  InstancedMesh,
  Matrix4,
  Object3D,
  PerspectiveCamera,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import carUrl from '../assets/car/car.glb?url'
import { car, stepCar } from './state'
import { view } from './input'
import { updateAudio } from './audio'
import { getUi } from './ui'
import { CYAN, PINK } from './palette'

const CAR_LENGTH = 4.6
/** Model ters bakıyorsa true yap */
const FLIP_MODEL = false
/** Tekerlek node'larını isimden bulur. Konsolda "[car] nodes" çıktısına bakıp gerekirse düzenle. */
const WHEEL_RE = /wheel|tire|tyre|rim|jant|lastik|tekerlek/i
const EXCLUDE_RE = /brake|caliper|disc|disk|arch|well|housing|fren/i

type Wheel = { steer: Group; spin: Group; front: boolean; radius: number }

function lerpAngle(a: number, b: number, t: number) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a))
  return a + d * t
}

/** Tekerlekleri dönüş/direksiyon durumuna göre günceller (render dışı, her frame). */
function spinWheels(wheels: Wheel[], dt: number) {
  for (const w of wheels) {
    w.spin.rotation.x += (car.speed / w.radius) * dt
    w.steer.rotation.y = w.front ? car.steer * 0.45 : 0
  }
}

function approachFov(cam: PerspectiveCamera, target: number, dt: number) {
  cam.fov += (target - cam.fov) * (1 - Math.exp(-4 * dt))
  cam.updateProjectionMatrix()
}

function buildModel(scene: Group) {
  const root = scene.clone(true)
  const box = new Box3().setFromObject(root)
  const size = box.getSize(new Vector3())
  const c = box.getCenter(new Vector3())
  const k = CAR_LENGTH / Math.max(size.x, size.z)
  root.scale.setScalar(k)
  root.position.set(-c.x * k, -box.min.y * k, -c.z * k)

  const wrapper = new Group()
  wrapper.add(root)
  wrapper.rotation.y = (size.x > size.z ? -Math.PI / 2 : 0) + (FLIP_MODEL ? Math.PI : 0)
  const outer = new Group()
  outer.add(wrapper)
  outer.updateMatrixWorld(true)

  // Tekerlek node'larını bul (tüm tekerlekleri tek node'da toplayan modelleri atla)
  const found: Object3D[] = []
  const names: string[] = []
  const visit = (o: Object3D) => {
    names.push(o.name)
    if (o.name && WHEEL_RE.test(o.name) && !EXCLUDE_RE.test(o.name)) {
      const sz = new Box3().setFromObject(o).getSize(new Vector3())
      if (sz.z < CAR_LENGTH * 0.35 && sz.y < 1.2) {
        found.push(o)
        return
      }
    }
    o.children.forEach(visit)
  }
  visit(root)

  // Her tekerleği kendi merkezinde dönecek şekilde pivot'a taşı
  const wheels: Wheel[] = []
  for (const w of found) {
    const b = new Box3().setFromObject(w)
    const center = b.getCenter(new Vector3())
    const sz = b.getSize(new Vector3())
    const steer = new Group()
    const spin = new Group()
    steer.position.copy(center)
    steer.add(spin)
    outer.add(steer)
    outer.updateMatrixWorld(true)
    spin.attach(w)
    wheels.push({ steer, spin, front: center.z > 0, radius: Math.max(sz.y, 0.3) / 2 })
  }
  console.info('[car] nodes', names.filter(Boolean))
  if (!wheels.length) console.warn('[car] tekerlek bulunamadı: WHEEL_RE regex\'ini node isimlerine göre güncelle')
  return { outer, wheels }
}

export function Car() {
  const gltf = useLoader(GLTFLoader, carUrl)
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const camAngle = useRef(0)
  const camY = useRef(5)
  const prevSpeed = useRef(0)
  const init = useRef(false)
  const blend = useRef(0)

  const { outer, wheels } = useMemo(() => buildModel(gltf.scene), [gltf])

  useFrame(({ clock, camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    if (getUi().phase === 'drive') stepCar(dt)
    updateAudio()

    // --- Araç ---
    if (root.current && body.current) {
      root.current.position.set(car.x, 0.35, car.z)
      root.current.rotation.y = car.heading
      const lateral = car.vx * Math.cos(car.heading) - car.vz * Math.sin(car.heading)
      const roll = Math.max(-0.1, Math.min(0.1, -lateral * 0.006))
      const accel = (car.speed - prevSpeed.current) / Math.max(dt, 1e-4)
      const pitch = Math.max(-0.06, Math.min(0.06, -accel * 0.0015))
      const k = 1 - Math.exp(-8 * dt)
      body.current.rotation.z += (roll - body.current.rotation.z) * k
      body.current.rotation.x += (pitch - body.current.rotation.x) * k
    }
    prevSpeed.current = car.speed

    // --- Tekerlekler ---
    spinWheels(wheels, dt)

    // --- Kamera ---
    const driving = getUi().phase === 'drive'
    blend.current += ((driving ? 1 : 0) - blend.current) * (1 - Math.exp(-1.8 * dt))
    const e = blend.current * blend.current * (3 - 2 * blend.current)
    const speed = Math.hypot(car.vx, car.vz)
    const velAngle = Math.atan2(car.vx, car.vz)
    const slideBlend = speed > 8 && car.speed > 0 ? 0.45 : 0
    const targetAngle = lerpAngle(car.heading, velAngle, slideBlend)
    if (!init.current) {
      camAngle.current = car.heading
      init.current = true
    }
    const mode = view.mode
    camAngle.current = lerpAngle(camAngle.current, mode === 2 ? car.heading : targetAngle, 1 - Math.exp(-(mode === 2 ? 40 : 4.5) * dt))
    const dirX = Math.sin(camAngle.current)
    const dirZ = Math.cos(camAngle.current)
    const boost = car.boosting ? 1 : 0

    let dist: number, height: number, look: number
    if (mode === 0) {
      dist = 10.5 + speed * 0.045
      height = 3.4 + speed * 0.012
      look = 9
    } else if (mode === 1) {
      dist = 20 + speed * 0.1
      height = 10
      look = 8
    } else {
      dist = -0.6
      height = 1.25
      look = 20
    }
    camY.current += (height - camY.current) * (1 - Math.exp(-5 * dt))
    const shake = boost * 0.05
    const t = clock.elapsedTime
    // sürüş kamerası
    const px = car.x - dirX * dist + Math.sin(t * 53) * shake
    const py = camY.current + Math.sin(t * 47) * shake
    const pz = car.z - dirZ * dist + Math.cos(t * 61) * shake
    const lx = car.x + dirX * look
    const ly = mode === 2 ? 1.1 : 1.3
    const lz = car.z + dirZ * look
    // giriş kamerası: arabanın önünden yavaş sinematik salınım, araba ekranın sağında
    const oa = car.heading + 0.6 + Math.sin(t * 0.3) * 0.5
    const ix = car.x + Math.sin(oa) * 7.5
    const iy = 1.7 + Math.sin(t * 0.4) * 0.25
    const iz = car.z + Math.cos(oa) * 7.5
    const jx = car.x - Math.cos(oa) * 2.4
    const jz = car.z + Math.sin(oa) * 2.4
    camera.position.set(ix + (px - ix) * e, iy + (py - iy) * e, iz + (pz - iz) * e)
    camera.lookAt(jx + (lx - jx) * e, 0.8 + (ly - 0.8) * e, jz + (lz - jz) * e)

    const fovTarget = 60 + Math.min(speed, 90) * 0.28 + boost * 12 + (mode === 2 ? 8 : 0)
    approachFov(camera as PerspectiveCamera, fovTarget, dt)
  })

  return (
    <>
      <group ref={root}>
        <group ref={body}>
          <primitive object={outer} />
        </group>
        <pointLight color={PINK} intensity={90} distance={20} position={[0, 0.5, 0]} />
        <pointLight color={CYAN} intensity={60} distance={22} position={[0, 1.6, 3.5]} />
      </group>
      <Trails />
    </>
  )
}

/** Drift sırasında arka tekerleklerden neon iz bırakır (ring buffer). */
function Trails() {
  const COUNT = 900
  const ref = useRef<InstancedMesh>(null)
  const idx = useRef(0)
  const last = useRef({ x: 1e9, z: 1e9 })
  const dummy = useMemo(() => {
    const o = new Object3D()
    o.rotation.order = 'YXZ'
    return o
  }, [])

  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const zero = new Matrix4().makeScale(0, 0, 0)
    for (let i = 0; i < COUNT; i++) m.setMatrixAt(i, zero)
    m.instanceMatrix.needsUpdate = true
  }, [])

  useFrame(() => {
    const m = ref.current
    if (!m || !car.drifting) return
    const dx = car.x - last.current.x
    const dz = car.z - last.current.z
    if (dx * dx + dz * dz < 0.5) return
    last.current = { x: car.x, z: car.z }
    const fx = Math.sin(car.heading)
    const fz = Math.cos(car.heading)
    const lx = Math.cos(car.heading)
    const lz = -Math.sin(car.heading)
    const ang = Math.atan2(car.vx, car.vz)
    for (const side of [-1, 1]) {
      dummy.position.set(car.x - fx * 1.4 + lx * 0.85 * side, 0.5, car.z - fz * 1.4 + lz * 0.85 * side)
      dummy.rotation.set(-Math.PI / 2, ang, 0)
      dummy.updateMatrix()
      m.setMatrixAt(idx.current, dummy.matrix)
      idx.current = (idx.current + 1) % COUNT
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.4, 1.4]} />
      <meshBasicMaterial color={PINK} transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} fog={false} />
    </instancedMesh>
  )
}