import { useEffect, useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

const INK = '#1c3426'

// 6 → "6,0 м", 2.7 → "2,7 м". Второй знак оставляем, только если он не ноль.
function formatDim(value) {
  const rounded = Math.round(value * 100) / 100
  const tenth = Math.round(rounded * 10) / 10
  const digits = Math.abs(rounded - tenth) < 0.001 ? 1 : 2
  const text = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rounded)
  return `${text} м`
}

function shift(point, normal, scale) {
  return [
    point[0] + normal[0] * scale,
    point[1] + normal[1] * scale,
    point[2] + normal[2] * scale,
  ]
}

// Одна размерная цепочка.
// Выносная начинается не от бруса, а с зазором gap — иначе линия тонет в древесине.
// Сама размерная стоит дальше, на offset. Выносная чуть длиннее и вылезает за неё.
// Засечка — короткая чёрточка под 45° к размерной, как на строительном чертеже.
// Цифра — номинал с ползунка, не измеренная длина линии: линия приподнята над землёй, чтобы не сливаться с сеткой.
function buildFigure(id, start, end, normal, label, gap, offset, labelLift) {
  const overrun = 0.12
  const tick = 0.11
  const dimStart = shift(start, normal, offset)
  const dimEnd = shift(end, normal, offset)
  const direction = [
    dimEnd[0] - dimStart[0],
    dimEnd[1] - dimStart[1],
    dimEnd[2] - dimStart[2],
  ]
  const length = Math.hypot(direction[0], direction[1], direction[2]) || 1
  direction[0] /= length
  direction[1] /= length
  direction[2] /= length
  const side = [
    direction[0] + normal[0],
    direction[1] + normal[1],
    direction[2] + normal[2],
  ]
  const sideLength = Math.hypot(side[0], side[1], side[2]) || 1
  side[0] /= sideLength
  side[1] /= sideLength
  side[2] /= sideLength
  const mid = [
    (dimStart[0] + dimEnd[0]) / 2,
    (dimStart[1] + dimEnd[1]) / 2,
    (dimStart[2] + dimEnd[2]) / 2,
  ]

  return {
    id,
    label,
    labelAt: [mid[0], mid[1] + labelLift, mid[2]],
    lines: [
      [shift(start, normal, gap), shift(start, normal, offset + overrun)],
      [shift(end, normal, gap), shift(end, normal, offset + overrun)],
      [dimStart, dimEnd],
      [shift(dimStart, side, -tick), shift(dimStart, side, tick)],
      [shift(dimEnd, side, -tick), shift(dimEnd, side, tick)],
    ],
  }
}

// Подпись габарита. Цифру рисуем в canvas и вешаем спрайтом.
// HTML поверх сцены тут не подошёл: часть подписей просто не появлялась, линия была, цифры нет.
// depthTest выключен — иначе стойка двери режет табличку пополам, хотя размерная линия целая.
// Спрайт всегда смотрит в камеру, крутить чертёж из-за текста не нужно.
function useLabelTexture(text) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 384
    canvas.height = 144
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = '600 72px "Segoe UI", sans-serif'
    const textWidth = ctx.measureText(text).width
    const boxW = textWidth + 56
    const boxH = 104
    const x = (canvas.width - boxW) / 2
    const y = (canvas.height - boxH) / 2
    ctx.beginPath()
    ctx.roundRect(x, y, boxW, boxH, 18)
    ctx.fillStyle = 'rgba(255, 253, 249, 0.96)'
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = '#cfc6b6'
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 3)
    const next = new THREE.CanvasTexture(canvas)
    next.anisotropy = 8
    next.needsUpdate = true
    return next
  }, [text])

  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function DimLabel({ position, text }) {
  const texture = useLabelTexture(text)
  return (
    <sprite position={position} scale={[0.92, 0.345, 1]} renderOrder={2} raycast={() => null}>
      <spriteMaterial
        map={texture}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  )
}

// Три габарита, каждый со своей стороны, чтобы линии не пересекались:
//   длина  — спереди, вдоль +Z
//   ширина — у переднего торца, −X, там дверь
//   высота — у заднего торца, +X, от земли до оси конька (стена + подъём крыши)
export function Dimensions({ spec }) {
  const figures = useMemo(() => {
    const gap = spec.section / 2 + 0.08
    const offset = spec.section / 2 + 0.62
    const y = 0.03
    return [
      buildFigure(
        'length',
        [spec.x0, y, spec.z],
        [spec.x1, y, spec.z],
        [0, 0, 1],
        formatDim(spec.length),
        gap,
        offset,
        0.22,
      ),
      buildFigure(
        'width',
        [spec.x0, y, -spec.z],
        [spec.x0, y, spec.z],
        [-1, 0, 0],
        formatDim(spec.width),
        gap,
        offset,
        0.22,
      ),
      buildFigure(
        'height',
        [spec.x1, 0, 0],
        [spec.x1, spec.ridgeY, 0],
        [1, 0, 0],
        formatDim(spec.ridgeY),
        gap,
        offset,
        0,
      ),
    ]
  }, [spec])

  return (
    <group>
      {figures.map((figure) => (
        <group key={figure.id}>
          {figure.lines.map((points, index) => (
            <Line
              key={`${figure.id}-${index}`}
              points={points}
              color={INK}
              lineWidth={index === 2 ? 1.6 : 1.2}
              raycast={() => null}
            />
          ))}
          <DimLabel position={figure.labelAt} text={figure.label} />
        </group>
      ))}
    </group>
  )
}
