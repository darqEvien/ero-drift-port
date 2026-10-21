import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  NearestFilter,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  Vector2,
} from 'three'
import { car } from './state'
import { CYAN, FOG, PINK, VIOLET, YELLOW, mulberry32 } from './palette'

const fogColor = new Color(FOG)

// ---------------- Gökyüzü ----------------
export function Sky() {
  const ref = useRef<Mesh>(null)
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        side: DoubleSide,
        depthWrite: false,
        fog: false,
        uniforms: { uHorizon: { value: fogColor }, uZenith: { value: new Color('#05010f') } },
        vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uHorizon; uniform vec3 uZenith; varying vec3 vDir;
          void main(){
            float t = clamp(vDir.y, 0., 1.);
            vec3 col = mix(uHorizon, uZenith, pow(t, 0.45));
            gl_FragColor = vec4(col, 1.);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useFrame(({ camera }) => ref.current?.position.copy(camera.position))
  return (
    <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1800, 24, 16]} />
    </mesh>
  )
}

// ---------------- Retro güneş ----------------
export function Sun() {
  const ref = useRef<Mesh>(null)
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        fog: false,
        uniforms: { uA: { value: new Color(YELLOW) }, uB: { value: new Color(PINK) } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
          void main(){
            float v = vUv.y;
            if (v < 0.5 && fract(v*16.) < (0.5 - v)*1.5) discard;
            gl_FragColor = vec4(mix(uB, uA, smoothstep(0.1, 0.9, v)), 1.);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useFrame(({ camera }) => {
    const m = ref.current
    if (!m) return
    m.position.set(car.x, 95, car.z - 1000)
    m.lookAt(camera.position)
  })
  return (
    <mesh ref={ref} material={mat} frustumCulled={false}>
      <circleGeometry args={[170, 64]} />
    </mesh>
  )
}

// ---------------- Zemin (neon ızgara) ----------------
export function Ground() {
  const ref = useRef<Mesh>(null)
  const center = useMemo(() => new Vector2(), [])
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        fog: false,
        uniforms: {
          uCenter: { value: center },
          uBase: { value: new Color('#07031a') },
          uFog: { value: fogColor },
          uLineA: { value: new Color(VIOLET) },
          uLineB: { value: new Color(PINK) },
        },
        vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
        fragmentShader: /* glsl */ `
          uniform vec2 uCenter; uniform vec3 uBase; uniform vec3 uFog; uniform vec3 uLineA; uniform vec3 uLineB; varying vec3 vW;
          float grid(vec2 p, float s){ vec2 g = p/s; vec2 d = abs(fract(g-0.5)-0.5)/fwidth(g); return 1.-min(min(d.x,d.y),1.); }
          void main(){
            float dist = length(vW.xz - uCenter);
            float small = grid(vW.xz, 20.);
            float big = grid(vW.xz, 100.);
            float fade = 1. - smoothstep(60., 520., dist);
            vec3 col = uBase + uLineA*small*0.55*fade + uLineB*big*0.9*fade;
            col = mix(col, uFog, smoothstep(250., 800., dist));
            gl_FragColor = vec4(col, 1.);
            #include <colorspace_fragment>
          }`,
      }),
    [center],
  )
  useFrame(() => {
    const m = ref.current
    if (!m) return
    m.position.set(car.x, 0, car.z)
    center.set(car.x, car.z)
  })
  return (
    <mesh ref={ref} material={mat} rotation-x={-Math.PI / 2} frustumCulled={false}>
      <planeGeometry args={[2400, 2400]} />
    </mesh>
  )
}

// ---------------- Skyline (arka plan şehri) ----------------
function makeWindowTexture() {
  const rnd = mulberry32(42)
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 64, 128)
  const cols = [CYAN, PINK, YELLOW, VIOLET]
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 8; x++)
      if (rnd() < 0.35) {
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

export function Skyline() {
  const group = useRef<Group>(null)
  const bodies = useRef<InstancedMesh>(null)
  const neons = useRef<InstancedMesh>(null)
  const tex = useMemo(makeWindowTexture, [])
  const data = useMemo(() => {
    const r = mulberry32(7)
    return Array.from({ length: 160 }, () => {
      const a = r() * Math.PI * 2
      const rad = 210 + r() * 240
      return {
        x: Math.cos(a) * rad,
        z: Math.sin(a) * rad,
        w: 14 + r() * 28,
        d: 14 + r() * 28,
        h: 40 + Math.pow(r(), 1.6) * 190,
        neon: r() < 0.55,
        c: Math.floor(r() * 3),
      }
    })
  }, [])

  useLayoutEffect(() => {
    const b = bodies.current
    const n = neons.current
    if (!b || !n) return
    const o = new Object3D()
    const palette = [new Color(CYAN), new Color(PINK), new Color(VIOLET)]
    data.forEach((d, i) => {
      o.position.set(d.x, d.h / 2, d.z)
      o.scale.set(d.w, d.h, d.d)
      o.updateMatrix()
      b.setMatrixAt(i, o.matrix)
      o.position.set(d.x, d.h + 0.6, d.z)
      o.scale.set(d.neon ? d.w + 0.6 : 0, 1.2, d.neon ? d.d + 0.6 : 0)
      o.updateMatrix()
      n.setMatrixAt(i, o.matrix)
      n.setColorAt(i, palette[d.c])
    })
    b.instanceMatrix.needsUpdate = true
    n.instanceMatrix.needsUpdate = true
    if (n.instanceColor) n.instanceColor.needsUpdate = true
  }, [data])

  useFrame(() => group.current?.position.set(car.x, 0, car.z))

  return (
    <group ref={group}>
      <instancedMesh ref={bodies} args={[undefined, undefined, data.length]} frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial color="#0a0620" emissive="#ffffff" emissiveMap={tex} emissiveIntensity={1.4} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={neons} args={[undefined, undefined, data.length]} frustumCulled={false}>
        <boxGeometry />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
    </group>
  )
}
