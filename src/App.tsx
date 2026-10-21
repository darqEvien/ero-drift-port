import Scene from './game/Scene'
import Hud from './game/Hud'

export default function App() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <Scene />
      <Hud />
    </div>
  )
}
