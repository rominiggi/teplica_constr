import { useMemo } from 'react'
import { Edges } from '@react-three/drei'
import * as THREE from 'three'

const Y_AXIS = new THREE.Vector3(0, 1, 0)

// Коробка в three стоит вертикально, длинная ось — Y.
// Крутим так, чтобы Y смотрел из from в to, центр коробки — на середину отрезка.
//
// setFromUnitVectors ломается, когда направление почти ровно вверх или вниз:
// векторы параллельны, кватернион получается мусор и брусок уезжает боком.
// Эти два случая задаём руками. Остальные — обычным поворотом.
function layoutOf(from, to) {
  const start = new THREE.Vector3(from[0], from[1], from[2])
  const end = new THREE.Vector3(to[0], to[1], to[2])
  const delta = new THREE.Vector3().subVectors(end, start)
  const length = delta.length()
  if (length < 1e-4) return null

  const direction = delta.multiplyScalar(1 / length)
  const quaternion = new THREE.Quaternion()
  if (direction.y > 0.999999) {
    quaternion.identity()
  } else if (direction.y < -0.999999) {
    quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
  } else {
    quaternion.setFromUnitVectors(Y_AXIS, direction)
  }

  const position = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
  return {
    position: position.toArray(),
    quaternion: quaternion.toArray(),
    length,
  }
}

// Клик по бруску не должен долетать до земли под ним — иначе выделение тут же снимется.
// Рёбра клик не ловят: луч и так попадает в грань, ребро только обводит брусок.
export function Beam({ beam, color, marked = false, dimmed = false, onSelect }) {
  const layout = useMemo(() => layoutOf(beam.from, beam.to), [beam])
  if (!layout) return null

  return (
    <mesh
      position={layout.position}
      quaternion={layout.quaternion}
      castShadow
      receiveShadow
      onClick={(event) => {
        event.stopPropagation()
        onSelect?.()
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default'
      }}
    >
      <boxGeometry args={[beam.section, layout.length, beam.section]} />
      <meshStandardMaterial
        color={marked ? '#e4c15a' : color}
        roughness={0.78}
        metalness={0.02}
        transparent={dimmed}
        opacity={dimmed ? 0.22 : 1}
        emissive={marked ? '#7a5a12' : '#000000'}
        emissiveIntensity={marked ? 0.28 : 0}
      />
      <Edges
        raycast={() => null}
        color={marked ? '#6d5214' : '#2b261f'}
        threshold={15}
      />
    </mesh>
  )
}
