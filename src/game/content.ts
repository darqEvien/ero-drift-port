import { CYAN, PINK, VIOLET, YELLOW } from './palette'

// >>> Burayı kendi bilgilerinle doldur <<<
export const profile = {
  name: 'Eren Öntan',
  initials: 'ERO',
  role: 'Ananı siker',
  intro:
    'Çok fena.',
}

export type Item = { title: string; desc: string; tags?: string[]; href?: string }
export type Station = {
  id: string
  label: string
  z: number // ana cadde üzerindeki konum (-z yönünde ilerlenir)
  color: string
  sub: string
  title: string
  body?: string
  items?: Item[]
}

export const stations: Station[] = [
  {
    id: 'about',
    label: 'Hakkımda',
    z: -250,
    color: PINK,
    sub: 'Ben sikerim',
    title: 'Hakkımda',
    body: 'Sikiş yaparım.',
  },
  {
    id: 'projects',
    label: 'Projeler',
    z: -550,
    color: CYAN,
    sub: 'Yaptıklarım',
    title: 'Projeler',
    items: [
      { title: 'Proje bir', desc: 'Ne yaptığını ve sonucu tek cümleyle anlat.', tags: ['React', 'Three.js'], href: 'https://example.com' },
      { title: 'Proje iki', desc: 'Ne yaptığını ve sonucu tek cümleyle anlat.', tags: ['TypeScript', 'Node'], href: 'https://example.com' },
      { title: 'Proje üç', desc: 'Ne yaptığını ve sonucu tek cümleyle anlat.', tags: ['WebGL'], href: 'https://example.com' },
    ],
  },
  {
    id: 'skills',
    label: 'Yetenekler',
    z: -850,
    color: VIOLET,
    sub: 'Araç kutum',
    title: 'Yetenekler',
    items: [
      { title: 'Frontend', desc: 'React, TypeScript, Tailwind' },
      { title: '3D ve grafik', desc: 'Three.js, React Three Fiber, GLSL' },
      { title: 'Backend', desc: 'Node.js, PostgreSQL' },
    ],
  },
  {
    id: 'contact',
    label: 'İletişim',
    z: -1150,
    color: YELLOW,
    sub: 'Yaz bana',
    title: 'İletişim',
    body: 'Birlikte bir şey yapmak istersen yaz.',
    items: [
      { title: 'E-posta', desc: 'sen@ornek.com', href: 'mailto:sen@ornek.com' },
      { title: 'GitHub', desc: 'github.com/kullanici', href: 'https://github.com' },
      { title: 'LinkedIn', desc: 'linkedin.com/in/kullanici', href: 'https://linkedin.com' },
    ],
  },
]