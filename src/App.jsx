import { useEffect, useMemo, useState } from 'react'
import { loadGrid, selectionMask, aggregate, cellTotals, toCalendar, baselines, percentileRank, MONTHS, SERIES } from './data'
import MapView from './MapView'
import Calendar from './Calendar'
import { LineChart, MonthlyProfile } from './Charts'
import Method from './Method'
import Logo from './Logo'
import { exportCalendar, exportHotspots } from './exportCsv'
import { IconDownload, IconDraw, IconGlobe, IconX, IconInfo, IconGithub } from './Icons'

const fmt = v => v == null ? '-' : Math.round(v).toLocaleString('en-US')
const ACCENT = 'var(--accent)'
const REPO = 'https://github.com/fredericjasmin/embercal'

// one list of nav items for every page
const NAV = [
  { id: 'explore', label: 'Explore' },
  { id: 'method', label: 'Method' },
]

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
          <a href="#explore" className="brand">
            <Logo size={26} />
            <span className="brand-name">EmberCal</span>
          </a>
          <nav aria-label="Main">
            {NAV.map(n => <a key={n.id} href={`#${n.id}`} className={route === n.id ? 'on' : ''} aria-current={route === n.id ? 'page' : undefined}>{n.label}</a>)}
          </nav>
        </div>
      </header>
      <main className="container">
        {!g ? <Skeleton />
          : route === 'method' ? <Method g={g} /> : <Explore g={g} />}
      </main>
      <footer className="foot">
        <div className="container foot-in">
          <div className="foot-brand"><Logo size={20} /><span>EmberCal · built by team Bush Coding for the 2026 NASA Space Apps Challenge</span></div>
          <p>Fire data: NASA FIRMS active fire products, MODIS Collection 6.1 (Terra and Aqua) and VIIRS 375 m (Suomi NPP, NOAA-20). Not an official NASA product.</p>
          <a className="foot-link" href={REPO} target="_blank" rel="noreferrer"><IconGithub size={16} />Source code</a>
        </div>
      </footer>
    </>
  )
}

function Skeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      <div className="sk sk-title" /><div className="sk sk-line" /><div className="sk sk-line short" />
      <div className="sk-grid"><div className="sk sk-map" /><div className="sk sk-side" /></div>
      <p className="muted">Loading 25 years of satellite hotspots…</p>
    </div>
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
  const [msg, setMsg] = useState(null)
  const [dlMsg, setDlMsg] = useState(null)

  const mask = useMemo(() => selectionMask(g, sel), [g, sel])
  const series = useMemo(() => aggregate(g, mask, key), [g, mask, key])
  const calAll = useMemo(() => toCalendar(g, series), [g, series])
  const cal = calAll.filter(r => r.year >= y0 && r.year <= y1)
  const lastFull = g.recent ? g.lastYear - 1 : g.lastYear
  const base = useMemo(() => baselines(calAll, Math.max(g.firstYear + 1, key === 'VR' ? 2012 : 0), lastFull), [calAll, g, key, lastFull])
  const totals = useMemo(() => cellTotals(g, key, Math.max(0, g.indexOf(y0, 1)), Math.min(g.months - 1, g.indexOf(y1, 12))), [g, key, y0, y1])

  const areaName = sel.type === 'all' ? 'Central America' : sel.type === 'country' ? g.countries[sel.index]
    : `${sel.s.toFixed(2)}°, ${sel.w.toFixed(2)}° to ${sel.n.toFixed(2)}°, ${sel.e.toFixed(2)}°`
  const areaKind = sel.type === 'all' ? 'All 7 countries' : sel.type === 'country' ? 'Country' : 'Custom area'

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
  const peakLabel = `${MONTHS[peak[0].m]}${peak[1] && peak[1].v > 0.6 * peak[0].v ? `-${MONTHS[peak[1].m]}` : ''}`

  const applyCoords = e => {
    e.preventDefault()
    const s = +coords.s, w = +coords.w, n = +coords.n, ee = +coords.e
    if ([coords.s, coords.w, coords.n, coords.e].some(x => x === '') || [s, w, n, ee].some(x => isNaN(x)) || s >= n || w >= ee) {
      setMsg('Enter south < north and west < east, in decimal degrees (for example 10.0, -86.0, 11.2, -84.8).')
      return
    }
    setMsg(null)
    setSel({ type: 'bbox', s, w, n, e: ee })
  }

  const years = []
  for (let y = g.firstYear + 1; y <= g.lastYear; y++) years.push(y)
  const slug = areaName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const status = ratio == null ? null : ratio >= 1.5 ? 'high' : ratio <= 0.67 ? 'low' : 'normal'

  return (
    <>
      <section className="intro">
        <h1>When does Central America burn?</h1>
        <p className="lead">25 years of NASA satellite fire detections, from two generations of sensors (MODIS and VIIRS), put on one fair scale so every year can be compared with the others.</p>
        <ol className="howto" aria-label="How to use">
          <li><strong>Pick an area:</strong> a country, a box drawn on the map, or coordinates.</li>
          <li><strong>Read the calendar:</strong> each row is a year and each square a month. Darker means more fire.</li>
          <li><strong>Download the data:</strong> the calendar or every hotspot, as CSV.</li>
        </ol>
      </section>

      <section className="panel controls" aria-label="Filters">
        <div className="ctl ctl-area">
          <span className="ctl-label">Area</span>
          <div className="row">
            <button className={'chip' + (sel.type === 'all' ? ' on' : '')} aria-pressed={sel.type === 'all'} onClick={() => { setSel({ type: 'all' }); setDrawing(false) }}><IconGlobe size={16} />All 7 countries</button>
            <select className={sel.type === 'country' ? 'on' : ''} value={sel.type === 'country' ? sel.index : ''} onChange={e => { if (e.target.value !== '') { setSel({ type: 'country', index: +e.target.value }); setDrawing(false) } }} aria-label="Country">
              <option value="">Choose a country</option>
              {g.countries.map((c, i) => <option key={c} value={i}>{c}</option>)}
            </select>
            <button className={'chip' + (drawing || sel.type === 'bbox' ? ' on' : '')} aria-pressed={drawing} onClick={() => setDrawing(d => !d)}><IconDraw size={16} />{drawing ? 'Now drag on the map' : 'Draw on map'}</button>
          </div>
        </div>
        <form className="ctl ctl-coords" onSubmit={applyCoords}>
          <span className="ctl-label">Or type coordinates</span>
          <div className="coords">
            {[['s', 'South', '10.0'], ['w', 'West', '-86.0'], ['n', 'North', '11.2'], ['e', 'East', '-84.8']].map(([k, label, ph]) => (
              <label key={k} className="coord"><span>{label}</span>
                <input inputMode="decimal" placeholder={ph} value={coords[k]} onChange={e => setCoords({ ...coords, [k]: e.target.value })} />
              </label>
            ))}
            <button type="submit" className="btn">Apply</button>
          </div>
          {msg && <p className="field-error" role="alert">{msg}</p>}
        </form>
        <div className="ctl">
          <span className="ctl-label">Years</span>
          <div className="row">
            <select value={y0} onChange={e => setY0(Math.min(+e.target.value, y1))} aria-label="From year">{years.map(y => <option key={y}>{y}</option>)}</select>
            <span className="muted">to</span>
            <select value={y1} onChange={e => setY1(Math.max(+e.target.value, y0))} aria-label="To year">{years.map(y => <option key={y}>{y}</option>)}</select>
          </div>
        </div>
        <div className="ctl">
          <span className="ctl-label">Data</span>
          <div className="seg" role="group" aria-label="Data source">
            {Object.entries(SERIES).map(([k, s]) => <button key={k} className={key === k ? 'on' : ''} aria-pressed={key === k} onClick={() => setKey(k)}>{s.label}</button>)}
          </div>
        </div>
      </section>

      {key !== 'H' && (
        <p className="note"><IconInfo size={18} /><span>You are viewing raw {SERIES[key].short} detections. {key === 'MR' ? 'Before July 2002 only one MODIS satellite (Terra) was flying, so early years look quieter than they were.' : 'VIIRS only exists since 2012, and its sharper pixels count one fire several times.'} Switch to <button className="link" onClick={() => setKey('H')}>Harmonized</button> to compare years fairly.</span></p>
      )}

      <div className="split">
        <div className="panel map-panel">
          <MapView g={g} totals={totals} mask={mask} drawing={drawing} bbox={sel.type === 'bbox' ? sel : null}
            onDrawn={b => { setSel({ type: 'bbox', ...b }); setDrawing(false); setCoords({ s: b.s.toFixed(2), w: b.w.toFixed(2), n: b.n.toFixed(2), e: b.e.toFixed(2) }) }} />
          <p className="map-cap">{drawing ? 'Click and drag to draw a box around the area you want.' : `Where satellites saw fire, ${y0}-${y1}. Faded cells are outside your area.`}</p>
        </div>
        <div className="stats">
          <div className="area-head">
            <div>
              <h2 className="area">{areaName}</h2>
              <p className="area-sub">{areaKind} · {y0}-{y1}</p>
            </div>
            {sel.type !== 'all' && <button className="btn ghost" onClick={() => { setSel({ type: 'all' }); setDrawing(false) }}><IconX size={16} />Clear</button>}
          </div>
          <div className="tiles">
            <div className="tile">
              <span className="tl">Hotspots, {y0}-{y1}</span>
              <span className="tv">{fmt(total)}</span>
              <span className="ts">Satellite fire detections in this area ({key === 'H' ? 'on the harmonized scale' : SERIES[key].unit}).</span>
            </div>
            <div className="tile">
              <span className="tl">Fire season</span>
              <span className="tv">{peakLabel}</span>
              <span className="ts">The months that usually burn the most.</span>
            </div>
            <div className="tile">
              <span className="tl">Worst year</span>
              <span className="tv">{top ? top.y : '-'}</span>
              <span className="ts">{top ? `${fmt(top.v)} hotspots, the most since ${g.firstYear + 1}.` : ''}</span>
            </div>
            <div className={'tile tile-now' + (status ? ` is-${status}` : '')}>
              <span className="tl">{MONTHS[lm.m]} {lm.y}{partial ? ' so far' : ''}</span>
              <span className="tv">{fmt(lastVal)}</span>
              <span className="ts">
                {status && <span className="badge"><i />{status === 'high' ? 'Above normal' : status === 'low' ? 'Below normal' : 'Normal'}</span>}
                {lastBase.median
                  ? `${partial ? `Days 1-${partial.days}, on pace for ${fmt(lastProj)}: ` : ''}${ratio >= 1 ? (Math.round(ratio * 10) / 10) + '× ' : Math.round(ratio * 100) + '% of '}a typical ${MONTHS[lm.m]}${pct != null ? `, above ${pct}% of past years.` : '.'}`
                  : 'No history for this month.'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <section className="panel block">
        <div className="block-head">
          <div>
            <h2>Burning calendar</h2>
            <p className="muted">{mode === 'anomaly'
              ? 'Compared with a normal year: red months burned more than usual for that month, blue ones less, gray ones about the same.'
              : 'Each row is a year and each square a month. The darker the square, the more fire was detected.'}</p>
          </div>
          <div className="seg" role="group" aria-label="Calendar view">
            <button className={mode === 'count' ? 'on' : ''} aria-pressed={mode === 'count'} onClick={() => setMode('count')}>Hotspots</button>
            <button className={mode === 'anomaly' ? 'on' : ''} aria-pressed={mode === 'anomaly'} onClick={() => setMode('anomaly')}>Compared with normal</button>
          </div>
        </div>
        <Calendar cal={cal} base={base} mode={mode} unit={SERIES[key].unit} highlight={top && top.y} partialFrom={partial} />
        <div className="actions">
          <button className="btn primary" onClick={() => exportCalendar(`embercal_calendar_${slug}_${key}.csv`, cal, `${SERIES[key].label} hotspots, ${areaName}`)}><IconDownload size={16} />Download calendar (CSV)</button>
          <button className="btn" disabled={busy != null} onClick={async () => {
            setBusy(0)
            const n = await exportHotspots(`embercal_hotspots_${slug}_${y0}-${y1}.csv`, sel, sel.type === 'country' ? g.countries[sel.index] : null, y0, y1, p => setBusy(p))
            setBusy(null)
            setDlMsg(n ? null : 'There are no hotspots in this area and period.')
          }}><IconDownload size={16} />{busy != null ? `Preparing… ${Math.round(busy * 100)}%` : 'Download every hotspot (CSV)'}</button>
        </div>
        {dlMsg && <p className="field-error" role="status">{dlMsg}</p>}
      </section>

      <div className="two">
        <section className="panel block">
          <h2>A normal year</h2>
          <p className="muted">How much a typical month burns here (dashed line and shaded range), and how {lm.y} is going.</p>
          <MonthlyProfile base={base} color={ACCENT} currentLabel={String(lm.y)}
            current={MONTHS.map((_, m) => { const i = g.indexOf(lm.y, m + 1); return i <= lastIdx ? series[i] : null })} />
        </section>
        <section className="panel block">
          <h2>Year by year</h2>
          <p className="muted">Total hotspots per year in this area.</p>
          <LineChart xs={yearly.map(r => r.y)} xLabel={y => String(y)} yLabel="Hotspots per year"
            series={[{ key: 'y', label: SERIES[key].label, color: ACCENT, values: yearly.map(r => r.v) }]} />
        </section>
      </div>
    </>
  )
}
