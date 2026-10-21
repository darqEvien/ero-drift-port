import { useEffect, useState } from 'react'
import { car, teleport } from './state'
import { startAudio } from './audio'
import { getUi, setUi, useUi } from './ui'
import { profile, stations } from './content'
import { CYAN, PINK } from './palette'

const neon = (c: string) => ({ textShadow: `0 0 10px ${c}, 0 0 28px ${c}88` })

function start() {
  startAudio()
  setUi({ phase: 'drive' })
}
function go(id: string) {
  const s = stations.find((x) => x.id === id)
  if (!s) return
  startAudio()
  teleport(0, s.z + 22, Math.PI)
  setUi({ phase: 'drive', flash: getUi().flash + 1 })
}
function home() {
  teleport(0, 0, Math.PI)
  setUi({ phase: 'intro', station: null })
}

export default function Hud() {
  const ui = useUi()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') home()
      else if (getUi().phase === 'intro' && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'Space', 'Enter'].includes(e.code)) start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-['Chakra_Petch',sans-serif] text-white">
      <Nav active={ui.station} />
      {ui.phase === 'intro' ? <Hero /> : <Speedo />}
      <Panel id={ui.station} />
      {ui.flash > 0 && <div key={ui.flash} className="absolute inset-0 animate-[flash_0.7s_ease-out_forwards] bg-white" />}
    </div>
  )
}

function Nav({ active }: { active: string | null }) {
  return (
    <>
      <button
        onClick={home}
        title="Girişe dön (Esc)"
        className="pointer-events-auto absolute left-5 top-4 rounded-sm border border-[#ff2bd6]/70 px-3 py-1.5 font-['Monoton',cursive] text-xl text-[#ff2bd6] transition hover:bg-[#ff2bd6]/15"
        style={neon(PINK)}
      >
        {profile.initials}
      </button>
      <nav className="pointer-events-auto absolute right-5 top-4 flex flex-wrap justify-end gap-1 rounded-sm border border-white/15 bg-black/45 p-1 backdrop-blur">
        {stations.map((s) => (
          <button
            key={s.id}
            onClick={() => go(s.id)}
            className="rounded-sm px-3 py-1.5 text-sm transition hover:bg-white/10"
            style={active === s.id ? { color: s.color, ...neon(s.color), background: 'rgba(255,255,255,0.08)' } : { color: '#fff' }}
          >
            {s.label}
          </button>
        ))}
      </nav>
    </>
  )
}

function Hero() {
  return (
    <div className="pointer-events-auto absolute inset-y-0 left-0 flex w-full max-w-3xl flex-col justify-center gap-5 bg-gradient-to-r from-black/75 via-black/40 to-transparent px-6 sm:px-14">
      <h1 className="font-['Monoton',cursive] text-5xl leading-tight text-[#ff2bd6] sm:text-7xl" style={neon(PINK)}>
        {profile.name}
      </h1>
      <p className="text-xl text-[#00f0ff] sm:text-2xl" style={neon(CYAN)}>
        {profile.role}
      </p>
      <p className="max-w-md text-base leading-relaxed text-white/80">{profile.intro}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <button
          onClick={start}
          className="rounded-sm bg-[#ff2bd6] px-6 py-3 font-semibold text-black transition hover:brightness-125"
          style={{ boxShadow: '0 0 24px #ff2bd6aa' }}
        >
          Motoru çalıştır
        </button>
        <button
          onClick={() => go('projects')}
          className="rounded-sm border border-[#00f0ff] px-6 py-3 text-[#00f0ff] transition hover:bg-[#00f0ff]/10"
        >
          Direkt projelere git
        </button>
      </div>
      <p className="text-sm text-white/50">W A S D ile sür ya da sağ üstteki menüden bir bölüme atla.</p>
    </div>
  )
}

function Speedo() {
  const [s, setS] = useState({ kmh: 0, score: 0, drifting: false, combo: 0, nitro: 1, boosting: false })
  const [hint, setHint] = useState(true)

  useEffect(() => {
    const id = setInterval(
      () =>
        setS({
          kmh: Math.round(Math.hypot(car.vx, car.vz) * 3.6),
          score: Math.floor(car.score),
          drifting: car.drifting,
          combo: car.combo,
          nitro: car.nitro,
          boosting: car.boosting,
        }),
      80,
    )
    const hide = setTimeout(() => setHint(false), 7000)
    return () => {
      clearInterval(id)
      clearTimeout(hide)
    }
  }, [])

  return (
    <>
      <div className="absolute bottom-6 right-6 text-right">
        <div className="text-6xl font-bold tabular-nums text-[#00f0ff] sm:text-7xl" style={neon(CYAN)}>
          {s.kmh}
          <span className="ml-2 text-lg text-white/60">km/h</span>
        </div>
        <div
          className={`mt-1 text-2xl tabular-nums transition-colors ${s.drifting ? 'text-[#ffe45e]' : 'text-white/50'}`}
          style={s.drifting ? neon('#ffe45e') : undefined}
        >
          drift {s.score}
          {s.combo > 1 && <span className="ml-2 text-base">x{s.combo.toFixed(1)}</span>}
        </div>
        <div className="ml-auto mt-3 h-2 w-56 overflow-hidden rounded-full bg-white/15">
          <div
            className={`h-full ${s.boosting ? 'bg-[#ffe45e]' : 'bg-[#00f0ff]'}`}
            style={{ width: `${s.nitro * 100}%`, boxShadow: '0 0 10px currentColor' }}
          />
        </div>
        <div className="mt-1 text-xs text-white/50">nitro · Shift</div>
      </div>
      <div className={`absolute inset-x-0 bottom-8 flex justify-center px-4 transition-opacity duration-700 ${hint ? 'opacity-100' : 'opacity-0'}`}>
        <div className="rounded-sm border border-[#00f0ff]/60 bg-black/50 px-5 py-3 text-center text-sm backdrop-blur">
          <p>
            <b className="text-[#00f0ff]">W A S D</b> sür · <b className="text-[#ff2bd6]">Space</b> kaydır · <b className="text-[#ffe45e]">Shift</b> nitro ·{' '}
            <b>C</b> kamera · <b>Esc</b> giriş
          </p>
          <p className="mt-1 text-white/60">Caddede ilerle, neon kapılardan geç.</p>
        </div>
      </div>
    </>
  )
}

function Panel({ id }: { id: string | null }) {
  const s = stations.find((x) => x.id === id)
  if (!s) return null
  return (
    <aside
      className="pointer-events-auto absolute right-5 top-20 w-[min(24rem,calc(100vw-2.5rem))] rounded-sm border bg-black/65 p-5 backdrop-blur"
      style={{ borderColor: s.color, boxShadow: `0 0 28px ${s.color}44` }}
    >
      <h2 className="text-3xl font-bold" style={{ color: s.color, ...neon(s.color) }}>
        {s.title}
      </h2>
      {s.body && <p className="mt-3 leading-relaxed text-white/85">{s.body}</p>}
      {s.items && (
        <ul className="mt-4 flex flex-col gap-3">
          {s.items.map((it) => (
            <li key={it.title} className="border-l-2 pl-3" style={{ borderColor: s.color }}>
              {it.href ? (
                <a href={it.href} target="_blank" rel="noreferrer" className="font-semibold underline-offset-4 hover:underline">
                  {it.title}
                </a>
              ) : (
                <span className="font-semibold">{it.title}</span>
              )}
              <p className="text-sm text-white/70">{it.desc}</p>
              {it.tags && <p className="mt-1 text-xs text-white/45">{it.tags.join(' · ')}</p>}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}