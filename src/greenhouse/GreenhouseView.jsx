import { useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Beam } from './Beam.jsx'
import { Dimensions } from './Dimensions.jsx'
import { PART_INFO } from './parts.js'

const CAMERA = [7.2, 4.6, 7.4]
const TARGET = [0, 1.1, 0]

// Оси ставим снаружи габаритов. Если ближе — красная ось наезжает на размер ширины.
// Длина каждой оси 1 м, это и есть масштаб на чертеже.
function axesPosition(beams) {
  let minX = 0
  let minZ = 0
  let found = false
  for (const beam of beams) {
    for (const point of [beam.from, beam.to]) {
      if (!found) {
        minX = point[0]
        minZ = point[2]
        found = true
      } else {
        minX = Math.min(minX, point[0])
        minZ = Math.min(minZ, point[2])
      }
    }
  }
  return [minX - 1.45, 0, minZ - 0.9]
}

export function GreenhouseView({
  beams = [],
  selectedGroup = null,
  pinnedPart = null,
  onSelect,
  showAxes = false,
  showDimensions = false,
  spec = null,
}) {
  const controlsRef = useRef(null)
  const axesAt = useMemo(() => axesPosition(beams), [beams])

  function resetView() {
    const controls = controlsRef.current
    if (!controls) return
    controls.object.position.set(CAMERA[0], CAMERA[1], CAMERA[2])
    controls.target.set(TARGET[0], TARGET[1], TARGET[2])
    controls.update()
  }

  return (
    <div
      className="viewport"
      onPointerLeave={() => {
        document.body.style.cursor = 'default'
      }}
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: CAMERA, fov: 40, near: 0.1, far: 80 }}
        onPointerMissed={() => onSelect?.(null)}
      >
        <color attach="background" args={['#e4eddf']} />
        <hemisphereLight color="#f7faf4" groundColor="#cbbda6" intensity={0.55} />
        <ambientLight intensity={0.22} />
        <directionalLight
          position={[6, 11, 5]}
          intensity={1.45}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={30}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-bias={-0.0004}
        />
        {/* Клик мимо брусков снимает выделение. Земля тоже должна снимать:
            для луча это не "мимо", земля — большой mesh на весь пол. */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          onClick={(event) => {
            event.stopPropagation()
            onSelect?.(null)
          }}
        >
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#d7e4ce" />
        </mesh>
        <gridHelper args={[20, 20, '#6f8f72', '#c5d4c0']} position={[0, 0.004, 0]} />
        <group>
          {/* Два режима подсветки, сразу оба не бывают.
              pinnedPart — клик по строке спецификации, красится весь тип.
              selectedGroup — клик по бруску, красится одна деталь (у двери это три бруска).
              Остальные приглушаем, выбранный брусок желтеет. */}
          {beams.map((beam) => {
            const hot = pinnedPart ? beam.part === pinnedPart : beam.group === selectedGroup
            const dimmed = pinnedPart
              ? beam.part !== pinnedPart
              : Boolean(selectedGroup) && beam.group !== selectedGroup
            return (
              <Beam
                key={beam.id}
                beam={beam}
                color={PART_INFO[beam.part]?.color ?? '#8a6240'}
                marked={Boolean(selectedGroup) && hot}
                dimmed={dimmed}
                onSelect={() => onSelect?.(beam.group)}
              />
            )
          })}
        </group>
        {showDimensions && spec ? <Dimensions spec={spec} /> : null}
        {showAxes ? <axesHelper args={[1]} position={axesAt} /> : null}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={TARGET}
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={24}
        />
      </Canvas>
      <button type="button" className="reset-view" onClick={resetView}>
        Сбросить вид
      </button>
      <p className="view-hint">Левая кнопка — вращать, колесо — масштаб, правая — сдвинуть</p>
    </div>
  )
}
