import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import { car } from './state'
import { CYAN, PINK, VIOLET, YELLOW, hash, mulberry32 } from './palette'
import { CHUNK, buildingsFor } from './city'

const RADIUS = 3 // car çevresinde (2R+1)^2 chunk yaşar
const ROAD_W = 16

// ---- paylaşılan geometri / materyaller ----
const roadGeo = new PlaneGeometry(ROAD_W, CHUNK)
const edgeGeo = new PlaneGeometry(0.4, CHUNK)
const dashGeo = new PlaneGeometry(0.5, CHUNK)
const boxGeo = new BoxGeometry(1, 1, 1)

function makeDashTexture() {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, 8, 32)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(1, 10)
  return t
}

function makeWindowTexture() {
  const rnd = mulberry32(99)
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 64, 128)
  const cols = [CYAN, PINK, YELLOW, VIOLET]
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 8; x++)
      if (rnd() < 0.33) {
        g.globalAlpha = 0.45 + rnd() * 0.55
        g.fillStyle = cols[Math.floor(rnd() * cols.length)]
        g.fillRect(x * 8 + 1, y * 4 + 1, 6, 2)
      }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(2, 3)
  t.magFilter = NearestFilter
  return t
}

let dashMat: MeshBasicMaterial | null = null
const getDashMat = () =>
  (dashMat ??= new MeshBasicMaterial({ color: YELLOW, alphaTest: 0.5, map: makeDashTexture() }))
let bodyMat: MeshStandardMaterial | null = null
const getBodyMat = () =>
  (bodyMat ??= new MeshStandardMaterial({
    color: '#0a0620',
    emissive: '#ffffff',
    emissiveMap: makeWindowTexture(),
    emissiveIntensity: 1.3,
    roughness: 0.6,
  }))
const cyanMat = new MeshBasicMaterial({ color: CYAN })
const pinkMat = new MeshBasicMaterial({ color: PINK })
const violetMat = new MeshBasicMaterial({ color: VIOLET })
const neonMats = [cyanMat, pinkMat, violetMat]

function Road({ y }: { y: number }) {
  const dash = getDashMat()
  return (
    <group>
      <mesh geometry={roadGeo} rotation-x={-Math.PI / 2} position-y={y}>
        <meshStandardMaterial color="#0d0a24" roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh geometry={edgeGeo} material={cyanMat} rotation-x={-Math.PI / 2} position={[-ROAD_W / 2 + 0.5, y + 0.08, 0]} />
      <mesh geometry={edgeGeo} material={pinkMat} rotation-x={-Math.PI / 2} position={[ROAD_W / 2 - 0.5, y + 0.08, 0]} />
      <mesh geometry={dashGeo} material={dash} rotation-x={-Math.PI / 2} position-y={y + 0.12} />
    </group>
  )
}

function Buildings({ cx, cz }: { cx: number; cz: number }) {
  const list = useMemo(() => buildingsFor(cx, cz), [cx, cz])
  const body = getBodyMat()
  return (
    <>
      {list.map((b, i) => (
        <group key={i} position={[b.x - cx * CHUNK, 0, b.z - cz * CHUNK]}>
          <mesh geometry={boxGeo} material={body} position-y={b.h / 2} scale={[b.w, b.h, b.d]} />
          <mesh geometry={boxGeo} material={neonMats[b.c]} position-y={b.h + 0.6} scale={[b.w + 0.6, 1.2, b.d + 0.6]} />
        </group>
      ))}
    </>
  )
}

function Chunk({ cx, cz }: { cx: number; cz: number }) {
  const roads = useRef<Group>(null)
  const bld = useRef<Group>(null)
  const t = useRef(0)
  // Portfolyo ana caddesi (x=0, -z yönü) her zaman var
  const hasZ = (cx === 0 && cz <= 0) || hash(cx, cz, 1) > 0.18
  const hasX = hash(cx, cz, 2) > 0.18

  // yollar zeminden yükselir, binalar yukarı büyür
  useFrame((_, dt) => {
    if (t.current >= 1) return
    t.current = Math.min(1, t.current + dt / 0.9)
    const e = 1 - Math.pow(1 - t.current, 3)
    if (roads.current) roads.current.position.y = -4 * (1 - e)
    if (bld.current) bld.current.scale.y = Math.max(0.001, e)
  })

  return (
    <group position={[cx * CHUNK, 0, cz * CHUNK]}>
      <group ref={roads} position-y={-4}>
        {hasZ && <Road y={0.08} />}
        {hasX && (
          <group rotation-y={Math.PI / 2}>
            <Road y={0.3} />
          </group>
        )}
      </group>
      <group ref={bld} scale-y={0.001}>
        <Buildings cx={cx} cz={cz} />
      </group>
    </group>
  )
}

export function Roads() {
  const [center, setCenter] = useState<[number, number]>([0, 0])

  useFrame(() => {
    const cx = Math.round(car.x / CHUNK)
    const cz = Math.round(car.z / CHUNK)
    if (cx !== center[0] || cz !== center[1]) setCenter([cx, cz])
  })

  const chunks = useMemo(() => {
    const out: [number, number][] = []
    for (let x = -RADIUS; x <= RADIUS; x++)
      for (let z = -RADIUS; z <= RADIUS; z++) out.push([center[0] + x, center[1] + z])
    return out
  }, [center])

  return (
    <>
      {chunks.map(([x, z]) => (
        <Chunk key={`${x},${z}`} cx={x} cz={z} />
      ))}
    </>
  )
}