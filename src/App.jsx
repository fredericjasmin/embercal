import { useEffect, useMemo, useState } from 'react'
import { loadGrid, selectionMask, aggregate, cellTotals, toCalendar, baselines, percentileRank, MONTHS, SERIES } from './data'
import MapView from './MapView'
import Calendar from './Calendar'
import { LineChart, MonthlyProfile } from './Charts'
import Method from './Method'
import { exportCalendar, exportHotspots } from './exportCsv'

const fmt = v => v == null ? '–' : Math.round(v).toLocaleString('en-US')
const ACCENT = 'var(--fire)'

function useRoute() {
  const [r, setR] = useState(location.hash.replace('#', '') || 'explore')
  useEffect(() => {
    const f = () => { setR(location.hash.replace('#', '') || 'explore'); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}

export default function App() {
  const route = useRoute()
  const [g, setG] = useState(null)
  useEffect(() => { loadGrid().then(setG) }, [])

  return (
    <>
      <header className="nav">
        <div className="container nav-in">
          <a href="#explore" className="brand"><span className="logo" aria-hidden="true" />EmberCal</a>
          <nav>
            <a href="#explore" className={route === 'explore' ? 'on' : ''}>Explore</a>
            <a href="#method" className={route === 'method' ? 'on' : ''}>Method</a>
          </nav>
        </div>
      </header>
      <main className="container">
        {!g ? <p className="muted loading">Loading 25 years of satellite hotspots…</p>
          : route === 'method' ? <Method g={g} /> : <Explore g={g} />}
      </main>
      <footer className="container foot">
        <p>Data: NASA FIRMS active fire products, MODIS Collection 6.1 (Terra and Aqua) and VIIRS S-NPP 375 m. Built for the 2026 NASA Space Apps Challenge, “Harmonization of MODIS and VIIRS Hot Spots”. Not an official NASA product.</p>
      </footer>
    </>
  )
}

function Explore({ g }) {
  const [sel, setSel] = useState({ type: 'all' })
  const [drawing, setDrawing] = useState(false)
  const [key, setKey] = useState('H')
  const [mode, setMode] = useState('count')
  const [y0, setY0] = useState(g.firstYear + 1)
  const [y1, setY1] = useState(g.lastYear)
  const [coords, setCoords] = useState({ s: '', w: '', n: '', e: '' })
  const [busy, setBusy] = useState(null)

  const mask = useMemo(() => selectionMask(g, sel), [g, sel])
  const series = useMemo(() => aggregate(g, mask, key), [g, mask, key])
  const calAll = useMemo(() => toCalendar(g, series), [g, series])
  const cal = calAll.filter(r => r.year >= y0 && r.year <= y1)
  const lastFull = g.recent ? g.lastYear - 1 : g.lastYear
  const base = useMemo(() => baselines(calAll, Math.max(g.firstYear + 1, key === 'VR' ? 2012 : 0), lastFull), [calAll, g, key, lastFull])
  const totals = useMemo(() => cellTotals(g, key, Math.max(0, g.indexOf(y0, 1)), Math.min(g.months - 1, g.indexOf(y1, 12))), [g, key, y0, y1])

  const areaName = sel.type === 'all' ? 'Central America' : sel.type === 'country' ? g.countries[sel.index]
    : `${sel.s.toFixed(2)}°, ${sel.w.toFixed(2)}° to ${sel.n.toFixed(2)}°, ${sel.e.toFixed(2)}°`

  // headline numbers
  const total = cal.reduce((s, r) => s + r.values.reduce((a, v) => a + (v || 0), 0), 0)
  const peak = base.map((b, m) => ({ m, v: b.median || 0 })).sort((a, b) => b.v - a.v)
  const yearly = calAll.filter(r => r.year > g.firstYear && r.year <= lastFull).map(r => ({ y: r.year, v: r.values.reduce((a, v) => a + (v || 0), 0) }))
  const top = yearly.slice().sort((a, b) => b.v - a.v)[0]
  const lastIdx = g.months - 1
  const lm = g.monthLabel(lastIdx)
  const pm = g.recent && g.recent.partialMonth
  const pace = pm ? pm.daysInMonth / pm.days : 1
  const lastVal = series[lastIdx]
  const lastProj = lastVal * pace
  const lastBase = base[lm.m]
  const pct = percentileRank(lastBase.values, lastProj)
  const ratio = lastBase.median ? lastProj / lastBase.median : null
  const partial = pm ? { y: lm.y, m: lm.m, pace, days: pm.days } : null

  const applyCoords = e => {
    e.preventDefault()
    const s = +coords.s, w = +coords.w, n = +coords.n, ee = +coords.e
    if ([s, w, n, ee].some(x => isNaN(x)) || s >= n || w >= ee) return
    setSel({ type: 'bbox', s, w, n, e: ee })
  }

  const years = []
  for (let y = g.firstYear + 1; y <= g.lastYear; y++) years.push(y)
  const slug = areaName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')

  return (
    <>
      <section className="intro">
        <h1>Burning activity calendar for Central America</h1>
        <p className="lead">25 years of satellite fire detections from two generations of NASA sensors, MODIS and VIIRS, put on one consistent scale. Pick an area to see when it burns, which years were extreme, and how this month compares with its history.</p>
      </section>

      <section className="controls" aria-label="Filters">
        <div className="ctl">
          <span className="ctl-label">Area</span>
          <div className="seg">
            <button className={sel.type === 'all' ? 'on' : ''} onClick={() => { setSel({ type: 'all' }); setDrawing(false) }}>All 7 countries</button>
            <select value={sel.type === 'country' ? sel.index : ''} onChange={e => { if (e.target.value !== '') { setSel({ type: 'country', index: +e.target.value }); setDrawing(false) } }} aria-label="Country">
              <option value="">Country…</option>
              {g.countries.map((c, i) => <option key={c} value={i}>{c}</option>)}
            </select>
            <button className={drawing ? 'on' : ''} onClick={() => setDrawing(d => !d)}>{drawing ? 'Drag on the map…' : 'Draw area'}</button>
          </div>
        </div>
        <form className="ctl" onSubmit={applyCoords}>
          <span className="ctl-label">Coordinates (S, W, N, E)</span>
          <div className="coords">
            {['s', 'w', 'n', 'e'].map(k => (
              <input key={k} inputMode="decimal" placeholder={{ s: '10.0', w: '-86.0', n: '11.2', e: '-84.8' }[k]} value={coords[k]} onChange={e => setCoords({ ...coords, [k]: e.target.value })} aria-label={k} />
            ))}
            <button type="submit">Apply</button>
          </div>
        </form>
        <div className="ctl">
          <span className="ctl-label">Years</span>
          <div className="seg">
            <select value={y0} onChange={e => setY0(Math.min(+e.target.value, y1))} aria-label="From year">{years.map(y => <option key={y}>{y}</option>)}</select>
            <span className="muted">to</span>
            <select value={y1} onChange={e => setY1(Math.max(+e.target.value, y0))} aria-label="To year">{years.map(y => <option key={y}>{y}</option>)}</select>
          </div>
        </div>
        <div className="ctl">
          <span className="ctl-label">Data</span>
          <div className="seg">
            {Object.entries(SERIES).map(([k, s]) => <button key={k} className={key === k ? 'on' : ''} onClick={() => setKey(k)}>{s.label}</button>)}
          </div>
        </div>
      </section>

      {key !== 'H' && (
        <p className="note">You are viewing raw {SERIES[key].short} detections. {key === 'MR' ? 'Before July 2002 only Terra was flying, so early years look artificially quiet.' : 'VIIRS only exists since 2012, and its 375 m pixels count one fire several times.'} Switch to <button className="link" onClick={() => setKey('H')}>Harmonized</button> to compare years fairly.</p>
      )}

      <div className="split">
        <div className="map-wrap">
          <MapView g={g} totals={totals} mask={mask} drawing={drawing} bbox={sel.type === 'bbox' ? sel : null}
            onDrawn={b => { setSel({ type: 'bbox', ...b }); setDrawing(false); setCoords({ s: b.s.toFixed(2), w: b.w.toFixed(2), n: b.n.toFixed(2), e: b.e.toFixed(2) }) }} />
          <p className="muted small">Hotspot density, {y0}–{y1}. Brighter cells are outside the selected area.</p>
        </div>
        <div className="stats">
          <h2 className="area">{areaName}</h2>
          <div className="tiles">
            <div className="tile"><span className="tl">Hotspots {y0}–{y1}</span><span className="tv">{fmt(total)}</span><span className="ts">{SERIES[key].unit}</span></div>
            <div className="tile"><span className="tl">Peak fire season</span><span className="tv">{MONTHS[peak[0].m]}{peak[1] && peak[1].v > 0.6 * peak[0].v ? `–${MONTHS[peak[1].m]}` : ''}</span><span className="ts">Highest median months</span></div>
            <div className="tile"><span className="tl">Most active year</span><span className="tv">{top ? top.y : '–'}</span><span className="ts">{top ? fmt(top.v) + ' hotspots' : ''}</span></div>
            <div className="tile"><span className="tl">{MONTHS[lm.m]} {lm.y}{partial ? ` (days 1–${partial.days})` : ''}</span><span className="tv">{fmt(lastVal)}</span>
              <span className="ts">{partial ? `On pace for ${fmt(lastProj)} · ` : ''}{lastBase.median ? `${ratio >= 1 ? (Math.round(ratio * 10) / 10) + '× ' : Math.round(ratio * 100) + '% of '}a typical ${MONTHS[lm.m]}` : 'No history for this month'}{pct != null ? ` · higher than ${pct}% of past years` : ''}</span></div>
          </div>
        </div>
      </div>

      <section className="block">
        <div className="block-head">
          <h2>Burning calendar</h2>
          <div className="seg">
            <button className={mode === 'count' ? 'on' : ''} onClick={() => setMode('count')}>Hotspots</button>
            <button className={mode === 'anomaly' ? 'on' : ''} onClick={() => setMode('anomaly')}>Anomaly vs. median</button>
          </div>
        </div>
        <p className="muted">Each row is a year and each column a month. {mode === 'anomaly' ? 'Red months burned more than the median of the same month across all years; blue ones burned less.' : 'Darker means more fire detections.'}</p>
        <Calendar cal={cal} base={base} mode={mode} unit={SERIES[key].unit} highlight={top && top.y} partialFrom={partial} />
        <div className="actions">
          <button onClick={() => exportCalendar(`embercal_calendar_${slug}_${key}.csv`, cal, `${SERIES[key].label} hotspots, ${areaName}`)}>Download calendar (CSV)</button>
          <button disabled={!!busy} onClick={async () => {
            setBusy(0)
            const n = await exportHotspots(`embercal_hotspots_${slug}_${y0}-${y1}.csv`, sel, sel.type === 'country' ? g.countries[sel.index] : null, y0, y1, p => setBusy(p))
            setBusy(null)
            if (!n) alertNoData()
          }}>{busy != null ? `Preparing… ${Math.round(busy * 100)}%` : 'Download hotspots (CSV)'}</button>
        </div>
      </section>

      <section className="block">
        <h2>Seasonal profile</h2>
        <p className="muted">How many hotspots a normal month has in this area, and where {lm.y} stands.</p>
        <MonthlyProfile base={base} color={ACCENT} currentLabel={String(lm.y)}
          current={MONTHS.map((_, m) => { const i = g.indexOf(lm.y, m + 1); return i <= lastIdx ? series[i] : null })} />
      </section>

      <section className="block">
        <h2>Year by year</h2>
        <LineChart xs={yearly.map(r => r.y)} xLabel={y => String(y)} yLabel="Hotspots per year"
          series={[{ key: 'y', label: SERIES[key].label, color: ACCENT, values: yearly.map(r => r.v) }]} />
      </section>
    </>
  )
}

function alertNoData() {
  console.log('No hotspots in this selection')
}
