import { bar, brace, doorFrame, frame, roofVent } from './parts.js'

// Сборка теплицы из деталей.
// На входе размеры с ползунков, на выходе плоский список брусков.
//
// Порядок специально такой:
//   1. продольные — обвязки и конёк
//   2. рамы поперёк. Их на одну больше, чем пролётов
//   3. торцы. Передний режется под дверь
//   4. укосины, прогоны, форточка — только если галочка включена
//
// Дверь всегда на переднем торце. Это меньший X.

export const defaultParams = {
  length: 6,
  width: 3,
  wallHeight: 1.8,
  roofRise: 0.9,
  bays: 3,
  section: 0.05,
  withDoor: true,
  doorWidth: 0.9,
  doorHeight: 1.6,
  withBraces: true,
  withPurlins: true,
  withVent: true,
}

export const PARAM_LIMITS = {
  length: { min: 2, max: 12, step: 0.1, digits: 1, label: 'Длина' },
  width: { min: 1.8, max: 6, step: 0.1, digits: 1, label: 'Ширина' },
  wallHeight: { min: 1.4, max: 2.8, step: 0.05, digits: 2, label: 'Высота стен' },
  roofRise: { min: 0.4, max: 1.8, step: 0.05, digits: 2, label: 'Подъём крыши' },
  bays: { min: 1, max: 8, step: 1, digits: 0, label: 'Пролёты' },
  section: { min: 0.03, max: 0.12, step: 0.005, digits: 3, label: 'Сечение бруска' },
  doorWidth: { min: 0.6, max: 1.4, step: 0.05, digits: 2, label: 'Ширина двери' },
  doorHeight: { min: 1.2, max: 2.2, step: 0.05, digits: 2, label: 'Высота двери' },
}

const SIZE_KEYS = ['length', 'width', 'wallHeight', 'roofRise', 'section', 'doorWidth', 'doorHeight']

function num(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function placesOf(step) {
  return Math.max(0, (String(step).split('.')[1] ?? '').length)
}

// Привязка к шагу ползунка.
// Иначе 6.0000000001 не кратен шагу 0.1, и React ругается на input type=range.
function snap(key, value) {
  const { min, max, step } = PARAM_LIMITS[key]
  const snapped = min + Math.round((value - min) / step) * step
  return clamp(Number(snapped.toFixed(placesOf(step))), min, max)
}

// То же, но только вниз. Дверь не должна стать выше стены даже на полшага.
function snapDown(key, value) {
  const { min, step } = PARAM_LIMITS[key]
  const steps = Math.floor((value - min) / step + 1e-6)
  return Number((min + Math.max(0, steps) * step).toFixed(placesOf(step)))
}

function clampKey(key, value) {
  return snap(key, num(value, defaultParams[key]))
}

// Кроме размеров сразу считаем то, чем удобно собирать:
// x0/x1 — торцы, z — половина ширины, y0 — ось нижней обвязки, ridgeY — ось конька.
// y0 = половина сечения: низ бруса тогда лежит на земле, а не в ней.
export function normalizeParams(raw = {}) {
  const params = { ...defaultParams, ...raw }
  const spec = {}
  for (const key of SIZE_KEYS) spec[key] = clampKey(key, params[key])
  spec.bays = clamp(
    Math.round(num(params.bays, defaultParams.bays)),
    PARAM_LIMITS.bays.min,
    PARAM_LIMITS.bays.max,
  )
  spec.withDoor = Boolean(params.withDoor)
  spec.withBraces = Boolean(params.withBraces)
  spec.withPurlins = Boolean(params.withPurlins)
  spec.withVent = Boolean(params.withVent)

  // Дверь ужимаем под текущую стену. Ползунок сам об этом не знает: высоту стены могли только что уменьшить.
  spec.doorWidthMax = Math.min(PARAM_LIMITS.doorWidth.max, snapDown('doorWidth', spec.width - 0.4))
  spec.doorHeightMax = snapDown('doorHeight', spec.wallHeight - spec.section)
  spec.doorWidth = Math.min(spec.doorWidth, spec.doorWidthMax)
  spec.doorHeight = Math.min(spec.doorHeight, spec.doorHeightMax)

  spec.x0 = -spec.length / 2
  spec.x1 = spec.length / 2
  spec.z = spec.width / 2
  spec.y0 = spec.section / 2
  spec.ridgeY = spec.wallHeight + spec.roofRise
  spec.step = spec.length / spec.bays
  return spec
}

// Деталь бывает одним бруском или массивом. Сюда кладём и то и другое, список на выходе всегда плоский.
function add(beams, part) {
  if (Array.isArray(part)) {
    for (const piece of part) beams.push(piece)
    return
  }
  beams.push(part)
}

// Ширина форточки. На короткой теплице не даём ей занять весь скат.
function ventSpan(length) {
  return Math.min(0.9, length * 0.22)
}

// Две боковые обвязки, низ и верх, и конёк на всю длину.
// side −1 / +1 — левая и правая стена по Z. Конёк один, по центру.
function addLongitudinal(beams, spec) {
  const { x0, x1, z, y0, wallHeight, ridgeY, section } = spec
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'l' : 'r'
    add(beams, bar({
      id: `plate-bottom-${name}`,
      from: [x0, y0, side * z],
      to: [x1, y0, side * z],
      section,
      part: 'plate',
    }))
    add(beams, bar({
      id: `plate-top-${name}`,
      from: [x0, wallHeight, side * z],
      to: [x1, wallHeight, side * z],
      section,
      part: 'plate',
    }))
  }
  add(beams, bar({
    id: 'ridge',
    from: [x0, ridgeY, 0],
    to: [x1, ridgeY, 0],
    section,
    part: 'ridge',
  }))
}

// Рамы. Цикл до bays включительно, поэтому рам на одну больше, чем пролётов:
// три пролёта — четыре рамы, по концам и между ними.
function addFrames(beams, spec) {
  const { x0, bays, step, width, wallHeight, roofRise, section, y0 } = spec
  for (let i = 0; i <= bays; i += 1) {
    add(beams, frame({
      id: `frame-${i}`,
      x: x0 + step * i,
      width,
      wallHeight,
      roofRise,
      section,
      y0,
    }))
  }
}

// Задний торец — порог на всю ширину.
// Передний без двери — тоже целиком.
// С дверью порог режем на два куска по краям проёма, иначе брус перегородит дверь.
// Коробка ставится в этот разрыв, в той же плоскости, что и торцевая рама.
function addEnds(beams, spec) {
  const { x0, x1, z, y0, section, withDoor, doorWidth, doorHeight } = spec
  add(beams, bar({
    id: 'sill-back',
    from: [x1, y0, -z],
    to: [x1, y0, z],
    section,
    part: 'plate',
  }))

  if (!withDoor) {
    add(beams, bar({
      id: 'sill-front',
      from: [x0, y0, -z],
      to: [x0, y0, z],
      section,
      part: 'plate',
    }))
    return
  }

  const half = doorWidth / 2
  add(beams, bar({
    id: 'sill-front-l',
    from: [x0, y0, -z],
    to: [x0, y0, -half],
    section,
    part: 'plate',
  }))
  add(beams, bar({
    id: 'sill-front-r',
    from: [x0, y0, half],
    to: [x0, y0, z],
    section,
    part: 'plate',
  }))
  add(beams, doorFrame({
    id: 'door',
    x: x0,
    width: doorWidth,
    height: doorHeight,
    section,
  }))
}

// Укосины только на заднем торце. На переднем они попали бы в дверь.
// Низ чуть выше обвязки, верх уходит в ригель не из самого угла —
// из угла укосина слиплась бы со стойкой и её не было бы видно.
function addBraces(beams, spec) {
  const { x1, z, y0, wallHeight, section, width } = spec
  const inset = Math.min(width * 0.34, 1.1)
  const y = y0 + section
  add(beams, brace({
    id: 'brace-l',
    from: [x1, y, -z],
    to: [x1, wallHeight, -z + inset],
    section,
  }))
  add(beams, brace({
    id: 'brace-r',
    from: [x1, y, z],
    to: [x1, wallHeight, z - inset],
    section,
  }))
}

// Прогон посередине каждого ската, вдоль всей теплицы.
// На скате с форточкой режем его на два. Иначе брус пройдёт сквозь проём.
// Левый скат не режем: форточка сейчас только справа, side = 1.
function addPurlins(beams, spec) {
  const { x0, x1, wallHeight, roofRise, width, section, withVent, length } = spec
  const y = wallHeight + roofRise / 2
  const zMid = width / 4
  add(beams, bar({
    id: 'purlin-l',
    from: [x0, y, -zMid],
    to: [x1, y, -zMid],
    section,
    part: 'purlin',
  }))

  const span = ventSpan(length)
  const cut = span / 2
  if (withVent && cut + section < length / 2) {
    add(beams, bar({
      id: 'purlin-r-a',
      from: [x0, y, zMid],
      to: [-cut, y, zMid],
      section,
      part: 'purlin',
    }))
    add(beams, bar({
      id: 'purlin-r-b',
      from: [cut, y, zMid],
      to: [x1, y, zMid],
      section,
      part: 'purlin',
    }))
    return
  }

  add(beams, bar({
    id: 'purlin-r',
    from: [x0, y, zMid],
    to: [x1, y, zMid],
    section,
    part: 'purlin',
  }))
}

// Форточка по центру правого ската.
// Если теплица короче самой форточки — не ставим, иначе рамка вылезет за торец.
function addVent(beams, spec) {
  const { length, wallHeight, roofRise, width, section } = spec
  const span = ventSpan(length)
  if (span < section * 4) return
  add(beams, roofVent({
    id: 'vent',
    x0: -span / 2,
    x1: span / 2,
    t0: 0.32,
    t1: 0.68,
    side: 1,
    wallHeight,
    roofRise,
    width,
    section,
  }))
}

// Сначала каркас, без него теплицы нет. Потом то, что можно выключить галочкой.
export function buildGreenhouse(raw = {}) {
  const spec = normalizeParams(raw)
  const beams = []
  addLongitudinal(beams, spec)
  addFrames(beams, spec)
  addEnds(beams, spec)
  if (spec.withBraces) addBraces(beams, spec)
  if (spec.withPurlins) addPurlins(beams, spec)
  if (spec.withVent) addVent(beams, spec)
  return beams
}
