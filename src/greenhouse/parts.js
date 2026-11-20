// Детали каркаса. Функция здесь возвращает бруски, сборка в buildGreenhouse.js их вызывает.
//
// Координаты в метрах, ноль — центр пола.
//   X — вдоль теплицы (красная ось)
//   Y — вверх (зелёная)
//   Z — поперёк (синяя)
//
// Брусок задаётся осью: from и to — центры торцов, не углы коробки.
// section — сторона квадрата. 0.05 = брусок 50×50 мм.
// Нижние бруски приподняты на половину сечения, иначе половина бруса уходит в землю.
//
// Как добавить деталь:
//   1. функция тут, возвращает bar() или массив bar()
//   2. вызов — в buildGreenhouse.js через add()
//   3. своё имя и цвет — строка в PART_INFO и в PART_ORDER, иначе в спецификации её не будет
//
// group связывает несколько брусков в одну деталь: клик подсвечивает все.
// Без group каждый брусок выбирается сам по себе.

export const PART_ORDER = [
  'post',
  'plate',
  'tie',
  'rafter',
  'ridge',
  'purlin',
  'brace',
  'door',
  'vent',
]

export const PART_INFO = {
  post: {
    title: 'Стойка',
    color: '#6f4a2d',
    text: 'Один вертикальный брусок от нижней обвязки до верха стены.',
  },
  plate: {
    title: 'Обвязка',
    color: '#a06a3c',
    text: 'Один прямой брусок. Нижняя лежит на земле, верхняя — на высоте стены.',
  },
  tie: {
    title: 'Ригель',
    color: '#8d5e36',
    text: 'Поперечина рамы на высоте стены. Её добавляет frame() вместе со стойками.',
  },
  rafter: {
    title: 'Стропило',
    color: '#c4894a',
    text: 'Наклонный брусок от верха стойки до конька. Тоже часть frame().',
  },
  ridge: {
    title: 'Конёк',
    color: '#4e3422',
    text: 'Продольный брусок по верху крыши: обычный bar() с именем ridge.',
  },
  purlin: {
    title: 'Прогон',
    color: '#b57a45',
    text: 'Продольный брусок посередине ската. Под форточкой он разрезан на два.',
  },
  brace: {
    title: 'Укосина',
    color: '#9a4e28',
    text: 'Один диагональный брусок. Стоит на заднем торце.',
  },
  door: {
    title: 'Дверь',
    color: '#1f6b58',
    text: 'Три бруска с общим group: два косяка и перемычка. Клик выделяет всю дверь.',
  },
  vent: {
    title: 'Форточка',
    color: '#2f6f93',
    text: 'Четыре бруска в плоскости ската. Углы считаются от карниза (t = 0) к коньку (t = 1).',
  },
}

// Один брусок. id обязан быть уникальным — по нему React держит список.
// part — это имя для цвета и строки спецификации, на форму бруска не влияет.
// group по умолчанию равен id: брусок сам себе деталь.
export function bar({ id, from, to, section, part = 'plate', group }) {
  return {
    id,
    from,
    to,
    section,
    part,
    group: group ?? id,
  }
}

// Стойка. y0 — низ, обычно ось нижней обвязки. y1 — верх стены, туда приходит ригель.
export function post({ id, x, z, y0, y1, section, group }) {
  return [
    bar({
      id,
      from: [x, y0, z],
      to: [x, y1, z],
      section,
      part: 'post',
      group,
    }),
  ]
}

// Укосина — тот же один брусок, только имя другое, чтобы в спецификации была своя строка.
export function brace({ id, from, to, section }) {
  return [
    bar({
      id,
      from,
      to,
      section,
      part: 'brace',
    }),
  ]
}

// Рама поперёк теплицы, вся в одной плоскости X = const.
// Пять брусков: две стойки, ригель на высоте стены, два стропила.
// Стропила сходятся в (x, конёк, z = 0) — по этим точкам потом ляжет коньковый брус.
export function frame({ id, x, width, wallHeight, roofRise, section, y0 }) {
  const half = width / 2
  const base = y0 ?? section / 2
  const ridgeY = wallHeight + roofRise
  return [
    ...post({ id: `${id}-post-l`, x, z: -half, y0: base, y1: wallHeight, section }),
    ...post({ id: `${id}-post-r`, x, z: half, y0: base, y1: wallHeight, section }),
    bar({
      id: `${id}-tie`,
      from: [x, wallHeight, -half],
      to: [x, wallHeight, half],
      section,
      part: 'tie',
    }),
    bar({
      id: `${id}-rafter-l`,
      from: [x, wallHeight, -half],
      to: [x, ridgeY, 0],
      section,
      part: 'rafter',
    }),
    bar({
      id: `${id}-rafter-r`,
      from: [x, wallHeight, half],
      to: [x, ridgeY, 0],
      section,
      part: 'rafter',
    }),
  ]
}

// Дверь: два косяка и перемычка. Общий group — клик по одному бруску выделяет всю коробку.
// Стоит в плоскости торца, проём по центру ширины. Порог сюда не входит, его режет сборка.
export function doorFrame({ id, x, width, height, section }) {
  const half = width / 2
  const y0 = section / 2
  const group = id
  return [
    bar({
      id: `${id}-l`,
      group,
      from: [x, y0, -half],
      to: [x, height, -half],
      section,
      part: 'door',
    }),
    bar({
      id: `${id}-r`,
      group,
      from: [x, y0, half],
      to: [x, height, half],
      section,
      part: 'door',
    }),
    bar({
      id: `${id}-t`,
      group,
      from: [x, height, -half],
      to: [x, height, half],
      section,
      part: 'door',
    }),
  ]
}

// Точка на прямом скате. t = 0 — карниз, t = 1 — конёк.
// side +1 — скат в +Z, side −1 — скат в −Z.
// Высота растёт линейно, z сходится к нулю. Дуги тут нет, скат из прямых брусков.
export function pointOnRoof(x, t, side, wallHeight, roofRise, width) {
  return [x, wallHeight + roofRise * t, side * (width / 2) * (1 - t)]
}

// Сдвиг наружу, перпендикулярно скату, на amount метров.
// Без него форточка оказалась бы внутри стропил, а не лежала на них.
// Перпендикуляр иногда смотрит вниз — тогда переворачиваем. Наружу всегда с подъёмом.
export function roofShift(side, roofRise, width, amount) {
  const alongZ = -side * (width / 2)
  let shiftY = -alongZ
  let shiftZ = roofRise
  if (shiftY < 0) {
    shiftY = -shiftY
    shiftZ = -shiftZ
  }
  const length = Math.hypot(shiftY, shiftZ) || 1
  return [0, (shiftY / length) * amount, (shiftZ / length) * amount]
}

// Форточка — прямоугольник в плоскости ската. Четыре бруска, один group.
// Углы считаем по t от карниза к коньку и сдвигаем наружу на толщину бруска.
export function roofVent({
  id,
  x0,
  x1,
  t0,
  t1,
  side,
  wallHeight,
  roofRise,
  width,
  section,
}) {
  const shift = roofShift(side, roofRise, width, section)
  const corner = (x, t) => {
    const point = pointOnRoof(x, t, side, wallHeight, roofRise, width)
    return [point[0] + shift[0], point[1] + shift[1], point[2] + shift[2]]
  }
  const bottom0 = corner(x0, t0)
  const bottom1 = corner(x1, t0)
  const top1 = corner(x1, t1)
  const top0 = corner(x0, t1)
  const group = id
  return [
    bar({ id: `${id}-b`, group, from: bottom0, to: bottom1, section, part: 'vent' }),
    bar({ id: `${id}-r`, group, from: bottom1, to: top1, section, part: 'vent' }),
    bar({ id: `${id}-t`, group, from: top1, to: top0, section, part: 'vent' }),
    bar({ id: `${id}-l`, group, from: top0, to: bottom0, section, part: 'vent' }),
  ]
}

// Длина бруска по оси. Для спецификации, не для отрисовки.
export function beamLength(beam) {
  const dx = beam.to[0] - beam.from[0]
  const dy = beam.to[1] - beam.from[1]
  const dz = beam.to[2] - beam.from[2]
  return Math.hypot(dx, dy, dz)
}

export function totalLength(beams) {
  let sum = 0
  for (const beam of beams) sum += beamLength(beam)
  return sum
}

// Сводка по типам. Порядок строк берём из PART_ORDER, иначе список прыгает при каждом пересчёте.
export function summarize(beams) {  const map = new Map()
  for (const beam of beams) {
    const row = map.get(beam.part) ?? { part: beam.part, count: 0, length: 0 }
    row.count += 1
    row.length += beamLength(beam)
    map.set(beam.part, row)
  }
  return PART_ORDER.map((part) => map.get(part)).filter(Boolean)
}
