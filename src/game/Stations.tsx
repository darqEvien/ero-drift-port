import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three'
import { car } from './state'
import { getUi, setUi } from './ui'
import { stations, type Station } from './content'

function signTexture(s: Station) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 320
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  const draw = () => {
    const g = c.getContext('2d')!
    g.clearRect(0, 0, 1024, 320)
    g.fillStyle = 'rgba(6,2,20,0.88)'
    g.fillRect(0, 0, 1024, 320)
    g.strokeStyle = s.color
    g.lineWidth = 8
    g.strokeRect(8, 8, 1008, 304)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.shadowColor = s.color
    g.shadowBlur = 30
    g.fillStyle = s.color
    g.font = '700 150px "Chakra Petch", sans-serif'
    g.fillText(s.label, 512, 130)
    g.shadowBlur = 0
    g.fillStyle = '#fff'
    g.font = '400 54px "Chakra Petch", sans-serif'
    g.fillText(s.sub, 512, 250)
    t.needsUpdate = true
  }
  draw()
  void document.fonts.ready.then(draw)
  return t
}

function Gate({ s }: { s: Station }) {
  const tex = useMemo(() => signTexture(s), [s])
  return (
    <group position={[0, 0, s.z]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 9.8, 7, 0]}>
          <boxGeometry args={[0.8, 14, 0.8]} />
          <meshBasicMaterial color={s.color} />
        </mesh>
      ))}
      <mesh position={[0, 12, 0]}>
        <boxGeometry args={[20.4, 0.8, 0.8]} />
        <meshBasicMaterial color={s.color} />
      </mesh>
      <mesh position={[0, 17, 0]}>
        <planeGeometry args={[20, 6.25]} />
        <meshBasicMaterial map={tex} side={DoubleSide} toneMapped={false} />
      </mesh>
      <pointLight color={s.color} intensity={400} distance={45} position={[0, 9, 6]} />
    </group>
  )
}

export function Stations() {
  useFrame(() => {
    let active: string | null = null
    for (const s of stations) if (Math.abs(car.z - s.z) < 34 && Math.abs(car.x) < 16) active = s.id
    if (active !== getUi().station) setUi({ station: active })
  })
  return (
    <>
      {stations.map((s) => (
        <Gate key={s.id} s={s} />
      ))}
    </>
  )
}