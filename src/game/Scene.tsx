import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Car } from './Car'
import { Roads } from './World'
import { Stations } from './stations'
import { Ground, Skyline, Sky, Sun } from './Backdrop'
import { bindInput } from './input'
import { FOG, FOG_DENSITY } from './palette'

export default function Scene() {
  useEffect(() => bindInput(), [])
  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      camera={{ fov: 62, near: 1, far: 3500, position: [0, 6, -14] }}
    >
      <color attach="background" args={[FOG]} />
      <fogExp2 attach="fog" args={[FOG, FOG_DENSITY]} />
      <ambientLight color="#7a4cff" intensity={0.9} />
      <hemisphereLight args={['#ff6bd6', '#1a0840', 0.8]} />
      <directionalLight color="#00f0ff" intensity={1.4} position={[-60, 80, -40]} />
      <Sky />
      <Sun />
      <Ground />
      <Skyline />
      <Roads />
      <Stations />
      <Suspense fallback={null}>
        <Car />
      </Suspense>
    </Canvas>
  )
}