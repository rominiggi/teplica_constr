import { useMemo, useState } from 'react'
import { buildGreenhouse, defaultParams, normalizeParams, PARAM_LIMITS } from './greenhouse/buildGreenhouse.js'
import { GreenhouseView } from './greenhouse/GreenhouseView.jsx'
import { PART_INFO, beamLength, summarize, totalLength } from './greenhouse/parts.js'

const FIELDS = ['length', 'width', 'wallHeight', 'roofRise', 'bays', 'section', 'doorWidth', 'doorHeight']

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function displayValue(key, value) {
  if (key === 'section') return `${Math.round(value * 1000)} мм`
  if (key === 'bays') return String(Math.round(value))
  return `${formatNumber(value, PARAM_LIMITS[key].digits)} м`
}

function Field({ fieldKey, value, max, disabled, onChange }) {
  const limit = PARAM_LIMITS[fieldKey]
  return (
    <label className={disabled ? 'field is-disabled' : 'field'}>
      <span className="field-label">
        <span>{limit.label}</span>
        <span>{displayValue(fieldKey, value)}</span>
      </span>
      <input
        type="range"
        min={limit.min}
        max={max ?? limit.max}
        step={limit.step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function PointRow({ label, point }) {
  return (
    <div className="xyz">
      <span>{label}</span>
      {point.map((coord, index) => (
        <span key={`${label}-${index}`}>{formatNumber(coord)}</span>
      ))}
    </div>
  )
}

export default function App() {
  const [params, setParams] = useState(defaultParams)
  const [showAxes, setShowAxes] = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [pinnedPart, setPinnedPart] = useState(null)

  const spec = useMemo(() => normalizeParams(params), [params])
  const beams = useMemo(() => buildGreenhouse(spec), [spec])
  const rows = useMemo(() => summarize(beams), [beams])
  const picked = selectedGroup ? beams.filter((beam) => beam.group === selectedGroup) : []
  const pickedPart = picked[0]?.part ?? null

  // В состояние кладём только поля ползунков и галочек.
  // normalize ещё отдаёт x0, ridgeY, шаг рам — это уже для сборки, в state им делать нечего.
  function update(key, value) {
    setParams((current) => {
      const next = normalizeParams({ ...current, [key]: value })
      const clean = {}
      for (const name of FIELDS) clean[name] = next[name]
      for (const name of ['withDoor', 'withBraces', 'withPurlins', 'withVent']) {
        clean[name] = next[name]
      }
      return clean
    })
  }

  // Клик по бруску и клик по строке спецификации — разные режимы, вместе не живут.
  // Повторный клик по тому же снимает выделение. null — клик по пустому месту.
  function selectGroup(group) {
    if (!group) {
      setSelectedGroup(null)
      setPinnedPart(null)
      return
    }
    setPinnedPart(null)
    setSelectedGroup((current) => (current === group ? null : group))
  }

  // Строка спецификации. Снимаем выбор конкретного бруска, иначе жёлтым останется и деталь, и весь тип.
  function pinPart(part) {
    setSelectedGroup(null)
    setPinnedPart((current) => (current === part ? null : part))
  }

  const doorMaxHeight = spec.doorHeightMax
  const doorMaxWidth = spec.doorWidthMax

  return (
    <div className="app">
      <aside className="panel">
        <header className="panel-head">
          <h1>Теплица</h1>
          <p>Каркас из брусков. Размеры в метрах, клетку сетки можно принять за 1 м.</p>
        </header>

        <h2>Размеры</h2>
        {FIELDS.map((key) => (
          <Field
            key={key}
            fieldKey={key}
            value={spec[key]}
            disabled={!spec.withDoor && (key === 'doorWidth' || key === 'doorHeight')}
            max={key === 'doorHeight' ? doorMaxHeight : key === 'doorWidth' ? doorMaxWidth : undefined}
            onChange={(value) => update(key, value)}
          />
        ))}

        <h2>Состав</h2>
        <div className="checks">
          <label className="check">
            <input
              type="checkbox"
              checked={spec.withDoor}
              onChange={(event) => update('withDoor', event.target.checked)}
            />
            Дверь
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={spec.withBraces}
              onChange={(event) => update('withBraces', event.target.checked)}
            />
            Укосины
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={spec.withPurlins}
              onChange={(event) => update('withPurlins', event.target.checked)}
            />
            Прогоны
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={spec.withVent}
              onChange={(event) => update('withVent', event.target.checked)}
            />
            Форточка
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={showAxes}
              onChange={(event) => setShowAxes(event.target.checked)}
            />
            Оси по 1 м
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={showDimensions}
              onChange={(event) => setShowDimensions(event.target.checked)}
            />
            Габариты
          </label>
        </div>
        {showAxes ? (
          <p className="axes-note">X красная — длина, Y зелёная — вверх, Z синяя — ширина. Ноль — центр пола.</p>
        ) : null}

        <div className="spec-head">
          <h2>Спецификация</h2>
          <span>{beams.length} шт. · {formatNumber(totalLength(beams), 1)} м</span>
        </div>
        <div className="parts">
          {rows.map((row) => {
            const info = PART_INFO[row.part]
            const on = pinnedPart === row.part || pickedPart === row.part
            return (
              <button
                key={row.part}
                type="button"
                className={on ? 'part is-on' : 'part'}
                onClick={() => pinPart(row.part)}
              >
                <i style={{ background: info?.color ?? '#8a6240' }} />
                <span>{info?.title ?? row.part}</span>
                <span className="part-meta">
                  {row.count} · {formatNumber(row.length, 1)} м
                </span>
              </button>
            )
          })}
        </div>

        {picked.length > 0 ? (
          <section className="readout">
            <h2>{PART_INFO[pickedPart]?.title}</h2>
            <p>{PART_INFO[pickedPart]?.text}</p>
            {picked.map((beam) => (
              <div key={beam.id} className="beam-readout">
                <div className="beam-readout-title">
                  <span>{beam.id}</span>
                  <span>{formatNumber(beamLength(beam), 2)} м</span>
                </div>
                <div className="xyz xyz-head">
                  <span />
                  <span>X</span>
                  <span>Y</span>
                  <span>Z</span>
                </div>
                <PointRow label="от" point={beam.from} />
                <PointRow label="до" point={beam.to} />
              </div>
            ))}
          </section>
        ) : null}

        {pinnedPart && picked.length === 0 ? (
          <section className="readout">
            <h2>{PART_INFO[pinnedPart]?.title}</h2>
            <p>{PART_INFO[pinnedPart]?.text}</p>
          </section>
        ) : null}

        <section className="note">
          <h2>Как задать деталь</h2>
          <p>Функция возвращает один брусок или массив. Точки — в метрах.</p>
          <pre>{`bar({
  id: 'polka',
  from: [-0.4, 0.8, 1.2],
  to:   [ 0.4, 0.8, 1.2],
  section: 0.05,
  part: 'plate',
})`}</pre>
          <p className="file-note">
            Каталог деталей — <code>src/greenhouse/parts.js</code>.
            Сборка по размерам — <code>src/greenhouse/buildGreenhouse.js</code>.
          </p>
        </section>
      </aside>

      <GreenhouseView
        beams={beams}
        selectedGroup={selectedGroup}
        pinnedPart={pinnedPart}
        onSelect={selectGroup}
        showAxes={showAxes}
        showDimensions={showDimensions}
        spec={spec}
      />
    </div>
  )
}
