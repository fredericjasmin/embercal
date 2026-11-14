import { useEffect, useMemo, useRef, useState } from 'react'
import { loadGrid, loadLive, selectionMask, aggregate, cellTotals, toCalendar, baselines, percentileRank, inShape, SERIES } from './data'
import MapView from './MapView'
import Calendar from './Calendar'
import { LineChart, MonthlyProfile } from './Charts'
import Method from './Method'
import Logo from './Logo'
import { exportCalendar, exportHotspots, exportImage } from './exportCsv'
import { IconDownload, IconDraw, IconGlobe, IconX, IconInfo, IconGithub, IconPin } from './Icons'
import { LangContext, LANGS, useT, initialLang, saveLang } from './i18n'

const fmt = v => v == null ? '-' : Math.round(v).toLocaleString('en-US')
const ACCENT = 'var(--accent)'
const REPO = 'https://github.com/fredericjasmin/embercal'

// one list of items for the whole top bar: page links and the language switch
const NAV = [
  { kind: 'link', id: 'explore', label: 'nav.explore' },
  { kind: 'link', id: 'method', label: 'nav.method' },
  { kind: 'lang' },
]

const routeOf = () => (location.hash.replace('#', '').split('?')[0] || 'explore')

function useRoute() {
  const [r, setR] = useState(routeOf())
  useEffect(() => {
    let prev = routeOf()
    const f = () => { const n = routeOf(); setR(n); if (n !== prev) window.scrollTo(0, 0); prev = n }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}

export default function App() {
  const [lang, setLangState] = useState(initialLang)
  const setLang = l => { setLangState(l); saveLang(l) }
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  useEffect(() => {
    const f = () => {
      const l = new URLSearchParams(location.hash.split('?')[1] || '').get('lang')
      if ((l === 'en' || l === 'es')) setLangState(cur => { if (cur !== l) saveLang(l); return l })
    }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Shell />
    </LangContext.Provider>
  )
}

function Shell() {
  const route = useRoute()
  const { t, lang, setLang } = useT()
  const [g, setG] = useState(null)
  const [failed, setFailed] = useState(false)
  const [live, setLive] = useState(null)
  const load = () => {
    setFailed(false)
    loadGrid().then(grid => { setG(grid); loadLive(grid).then(setLive) }).catch(() => setFailed(true))
  }
  useEffect(load, [])
  useEffect(() => { document.title = t('doc.title') }, [lang])

  return (
    <>
      <header className="nav">
        <div className="container nav-in">
          <a href="#explore" className="brand">
            <Logo size={26} />
            <span className="brand-name">EmberCal</span>
          </a>
          <nav aria-label="Main">
            {NAV.map(n => n.kind === 'link'
              ? <a key={n.id} href={`#${n.id}`} className={route === n.id ? 'on' : ''} aria-current={route === n.id ? 'page' : undefined}>{t(n.label)}</a>
              : (
                <div key="lang" className="lang" role="group" aria-label={t('nav.lang')}>
                  {LANGS.map(l => (
                    <button key={l.id} type="button" className={lang === l.id ? 'on' : ''} aria-pressed={lang === l.id} title={l.name} lang={l.id} onClick={() => setLang(l.id)}>{l.label}</button>
                  ))}
                </div>
              ))}
          </nav>
        </div>
      </header>
      <main className="container">
        {failed ? (
          <div className="load-error" role="alert"><p>{t('err.load')}</p><button className="btn" onClick={load}>{t('err.retry')}</button></div>
        ) : !g ? <Skeleton />
          : route === 'method' ? <Method g={g} /> : <Explore g={g} live={live} />}
      </main>
      <footer className="foot">
        <div className="container foot-in">
          <div className="foot-brand"><Logo size={20} /><span>{t('foot.built')}</span></div>
          <p>{t('foot.data')}</p>
          <a className="foot-link" href={REPO} target="_blank" rel="noreferrer"><IconGithub size={16} />{t('foot.source')}</a>
        </div>
      </footer>
    </>
  )
}

function Skeleton() {
  const { t } = useT()
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      <div className="sk sk-title" /><div className="sk sk-line" /><div className="sk sk-line short" />
      <div className="sk-grid"><div className="sk sk-map" /><div className="sk sk-side" /></div>
      <p className="muted">{t('loading')}</p>
    </div>
  )
}

/* ---------- shareable state in the URL: #explore?a=...&f=2001-01&t=2026-11&d=H&v=count&lang=en ---------- */
function readState(g) {
  const q = new URLSearchParams(location.hash.split('?')[1] || '')
  let sel = { type: 'all' }
  const a = q.get('a') || ''
  const nums = a.split(':')[1]?.split(',').map(Number) || []
  if (a.startsWith('c:') && g.countries[nums[0]]) sel = { type: 'country', index: nums[0] }
  if (a.startsWith('b:') && nums.length === 4 && nums.every(isFinite)) sel = { type: 'bbox', s: nums[0], w: nums[1], n: nums[2], e: nums[3] }
  if (a.startsWith('p:') && nums.length === 3 && nums.every(isFinite)) sel = { type: 'circle', lat: nums[0], lon: nums[1], r: nums[2] }
  const ym = (s, def) => { const m = /^(\d{4})-(\d{2})$/.exec(s || ''); return m ? { y: +m[1], m: +m[2] } : def }
  return {
    sel,
    from: ym(q.get('f'), { y: g.firstYear + 1, m: 1 }),
    to: ym(q.get('t'), { y: g.lastYear, m: g.lastMonth + 1 }),
    key: SERIES[q.get('d')] ? q.get('d') : 'H',
    mode: q.get('v') === 'anomaly' ? 'anomaly' : 'count',
  }
}
function writeState(st) {
  const s = st.sel
  const a = s.type === 'country' ? `c:${s.index}` : s.type === 'bbox' ? `b:${[s.s, s.w, s.n, s.e].map(x => x.toFixed(3)).join(',')}`
    : s.type === 'circle' ? `p:${s.lat.toFixed(4)},${s.lon.toFixed(4)},${s.r}` : 'all'
  const p2 = n => String(n).padStart(2, '0')
  const q = new URLSearchParams({ a, f: `${st.from.y}-${p2(st.from.m)}`, t: `${st.to.y}-${p2(st.to.m)}`, d: st.key, v: st.mode, lang: st.lang })
  const url = `#explore?${q.toString()}`
  if (location.hash !== url) history.replaceState(null, '', url)
}

/* ---------- fire season outlook from the monthly medians ---------- */
function outlook(base, nowM, nowDay) {
  const med = base.map(b => b.median || 0)
  const total = med.reduce((s, v) => s + v, 0)
  const max = Math.max(...med)
  if (!total || !max) return null
  // longest circular run of months at or above half of the peak month
  const hot = med.map(v => v >= 0.5 * max)
  let best = null
  for (let s = 0; s < 12; s++) {
    if (!hot[s] || hot[(s + 11) % 12]) continue
    let len = 0
    while (len < 12 && hot[(s + len) % 12]) len++
    if (!best || len > best.len) best = { start: s, len }
  }
  if (!best) best = { start: med.indexOf(max), len: 1 }
  const months = Array.from({ length: best.len }, (_, k) => (best.start + k) % 12)
  const share = months.reduce((s, m) => s + med[m], 0) / total
  const inside = months.includes(nowM)
  const wait = (best.start - nowM + 12) % 12 // whole months ahead
  const weeks = Math.max(0, Math.round((wait * 30.4 - nowDay) / 7))
  const end = months[months.length - 1]
  return { med, total, max, months, share, inside, weeks, start: best.start, end }
}

function Explore({ g, live }) {
  const { t, lang, months: MONTHS, country } = useT()
  const init = useMemo(() => readState(g), [g])
  const [sel, setSel] = useState(init.sel)
  const [tool, setTool] = useState(null)
  const [key, setKey] = useState(init.key)
  const [mode, setMode] = useState(init.mode)
  const [from, setFrom] = useState(init.from)
  const [to, setTo] = useState(init.to)
  const [coordMode, setCoordMode] = useState(init.sel.type === 'circle' ? 'point' : 'box')
  const [coords, setCoords] = useState(init.sel.type === 'bbox' ? { s: String(init.sel.s), w: String(init.sel.w), n: String(init.sel.n), e: String(init.sel.e) } : { s: '', w: '', n: '', e: '' })
  const [pt, setPt] = useState(init.sel.type === 'circle' ? { lat: String(init.sel.lat), lon: String(init.sel.lon), r: String(init.sel.r) } : { lat: '', lon: '', r: '25' })
  const [showRecent, setShowRecent] = useState(true)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const [dlMsg, setDlMsg] = useState(null)
  const [copied, setCopied] = useState(false)
  const calRef = useRef(null), normRef = useRef(null), yearRef = useRef(null)

  useEffect(() => { writeState({ sel, from, to, key, mode, lang }) }, [sel, from, to, key, mode, lang])

  const i0 = Math.max(0, g.indexOf(from.y, from.m))
  const i1 = Math.min(g.months - 1, g.indexOf(to.y, to.m))
  const mask = useMemo(() => selectionMask(g, sel), [g, sel])
  const series = useMemo(() => aggregate(g, mask, key), [g, mask, key])
  const calAll = useMemo(() => toCalendar(g, series), [g, series])
  const cal = calAll.filter(r => r.year >= from.y && r.year <= to.y).map(r => ({
    ...r, values: r.values.map((v, m) => { const i = g.indexOf(r.year, m + 1); return i < i0 || i > i1 ? null : v }),
  }))
  const lastFull = g.recent ? g.lastYear - 1 : g.lastYear
  const base = useMemo(() => baselines(calAll, Math.max(g.firstYear + 1, key === 'VR' ? 2012 : 0), lastFull), [calAll, g, key, lastFull])
  const totals = useMemo(() => cellTotals(g, key, i0, i1), [g, key, i0, i1])

  const areaName = sel.type === 'all' ? t('area.ca') : sel.type === 'country' ? country(g.countries[sel.index])
    : sel.type === 'circle' ? t('area.circle', sel.r, sel.lat.toFixed(3), sel.lon.toFixed(3))
    : t('area.box', sel.s.toFixed(2), sel.w.toFixed(2), sel.n.toFixed(2), sel.e.toFixed(2))
  const areaKind = t(`kind.${sel.type === 'bbox' ? 'box' : sel.type}`)
  const periodLabel = t('period', MONTHS[from.m - 1], from.y, MONTHS[to.m - 1], to.y)

  // headline numbers
  let total = 0
  for (let i = i0; i <= i1; i++) total += series[i]
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
  const peakLabel = (() => {
    const a = peak[0].m, b = peak[1] && peak[1].v > 0.6 * peak[0].v ? peak[1].m : null
    if (b == null) return MONTHS[a]
    const [x, y] = (Math.abs(a - b) === 11 ? [Math.max(a, b), Math.min(a, b)] : [Math.min(a, b), Math.max(a, b)])
    return Math.abs(a - b) === 1 || Math.abs(a - b) === 11 ? `${MONTHS[x]}-${MONTHS[y]}` : `${MONTHS[x]}, ${MONTHS[y]}`
  })()
  const status = ratio == null ? null : ratio >= 1.5 ? 'high' : ratio <= 0.67 ? 'low' : 'normal'
  const ol = useMemo(() => outlook(base, lm.m, pm ? pm.days : 15), [base, lm.m, pm])

  // active fires of the last 7 days, flagged inside / outside the selection
  const recent = live ? live.points : g.recent && g.recent.last7
  const recentFrom = live ? live.from : g.recent && g.recent.last7From
  const recentTo = live ? live.to : g.recent && g.recent.lastDay
  const recentFlags = useMemo(() => {
    if (!recent) return []
    return recent.map(([lat, lon]) => {
      if (sel.type === 'all') return true
      if (sel.type === 'country') {
        const c = g.cellIndex.get(`${Math.floor(lat / g.cell)},${Math.floor(lon / g.cell)}`)
        return c != null && g.cellCountry[c] === sel.index
      }
      return inShape(sel, lat, lon)
    })
  }, [recent, sel, g])
  const recentIn = recent ? recent.filter((_, k) => recentFlags[k]) : []

  const applyCoords = e => {
    e.preventDefault()
    if (coordMode === 'box') {
      const s = +coords.s, w = +coords.w, n = +coords.n, ee = +coords.e
      if ([coords.s, coords.w, coords.n, coords.e].some(x => x === '') || [s, w, n, ee].some(x => isNaN(x)) || s >= n || w >= ee) {
        setMsg('err.box')
        return
      }
      setMsg(null); setTool(null)
      setSel({ type: 'bbox', s, w, n, e: ee })
    } else {
      const lat = +pt.lat, lon = +pt.lon, r = +pt.r
      if ([pt.lat, pt.lon, pt.r].some(x => x === '') || [lat, lon, r].some(x => isNaN(x)) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || r <= 0 || r > 500) {
        setMsg('err.point')
        return
      }
      setMsg(null); setTool(null)
      setSel({ type: 'circle', lat, lon, r })
    }
  }

  const years = []
  for (let y = g.firstYear + 1; y <= g.lastYear; y++) years.push(y)
  const slug = (sel.type === 'all' ? 'Central_America' : areaName).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const p2 = n => String(n).padStart(2, '0')
  const d0 = `${from.y}-${p2(from.m)}-01`
  const d1 = `${to.y}-${p2(to.m)}-${p2(new Date(to.y, to.m, 0).getDate())}`
  const setPeriod = (side, part, val) => {
    const next = side === 'from' ? { ...from, [part]: val } : { ...to, [part]: val }
    const a = side === 'from' ? next : from, b = side === 'from' ? to : next
    if (a.y * 12 + a.m > b.y * 12 + b.m) { setFrom(next); setTo(next) } else if (side === 'from') setFrom(next); else setTo(next)
  }
  const reset = () => { setSel({ type: 'all' }); setTool(null); setMsg(null) }
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }
  const saveImg = (ref, name) => ref.current && exportImage(ref.current, `embercal_${name}_${slug}.png`)
  const rPick = +pt.r > 0 ? pt.r : 25
  const dayLabel = iso => iso.slice(5).replace('-', '/')

  return (
    <>
      <section className="intro">
        <h1>{t('intro.title')}</h1>
        <p className="lead">{t('intro.lead')}</p>
        <ol className="howto">
          <li><strong>{t('how.1b')}</strong> {t('how.1')}</li>
          <li><strong>{t('how.2b')}</strong> {t('how.2')}</li>
          <li><strong>{t('how.3b')}</strong> {t('how.3')}</li>
        </ol>
      </section>

      <section className="panel controls" aria-label="Filters">
        <div className="ctl">
          <span className="ctl-label">{t('ctl.area')}</span>
          <div className="row">
            <button className={'chip' + (sel.type === 'all' ? ' on' : '')} aria-pressed={sel.type === 'all'} onClick={reset}><IconGlobe size={16} />{t('ctl.all')}</button>
            <select className={sel.type === 'country' ? 'on' : ''} value={sel.type === 'country' ? sel.index : ''} onChange={e => { if (e.target.value !== '') { setSel({ type: 'country', index: +e.target.value }); setTool(null) } }} aria-label={t('ctl.country')}>
              <option value="">{t('ctl.country')}</option>
              {g.countries.map((c, i) => <option key={c} value={i}>{country(c)}</option>)}
            </select>
            <button className={'chip' + (tool === 'box' || (sel.type === 'bbox' && !tool) ? ' on' : '')} aria-pressed={tool === 'box'} onClick={() => setTool(x => x === 'box' ? null : 'box')}><IconDraw size={16} />{tool === 'box' ? t('ctl.boxOn') : t('ctl.box')}</button>
            <button className={'chip' + (tool === 'point' || (sel.type === 'circle' && !tool) ? ' on' : '')} aria-pressed={tool === 'point'} onClick={() => { setTool(x => x === 'point' ? null : 'point'); setCoordMode('point') }}><IconPin size={16} />{tool === 'point' ? t('ctl.pointOn') : t('ctl.point')}</button>
          </div>
        </div>
        <form className="ctl ctl-coords" onSubmit={applyCoords}>
          <div className="row gap-s">
            <span className="ctl-label">{t('ctl.orType')}</span>
            <div className="seg small" role="group" aria-label={t('ctl.orType')}>
              <button type="button" className={coordMode === 'box' ? 'on' : ''} aria-pressed={coordMode === 'box'} onClick={() => setCoordMode('box')}>{t('ctl.aBox')}</button>
              <button type="button" className={coordMode === 'point' ? 'on' : ''} aria-pressed={coordMode === 'point'} onClick={() => setCoordMode('point')}>{t('ctl.aPoint')}</button>
            </div>
          </div>
          <div className="coords">
            {coordMode === 'box'
              ? [['s', '10.0'], ['w', '-86.0'], ['n', '11.2'], ['e', '-84.8']].map(([k, ph]) => (
                <label key={k} className="coord"><span>{t(`ctl.${k}`)}</span>
                  <input inputMode="decimal" placeholder={ph} value={coords[k]} onChange={e => setCoords({ ...coords, [k]: e.target.value })} />
                </label>))
              : [['lat', '10.63'], ['lon', '-85.44'], ['r', '25']].map(([k, ph]) => (
                <label key={k} className="coord"><span>{t(`ctl.${k}`)}</span>
                  <input inputMode="decimal" placeholder={ph} value={pt[k]} onChange={e => setPt({ ...pt, [k]: e.target.value })} />
                </label>))}
            <button type="submit" className="btn">{t('ctl.apply')}</button>
          </div>
          {msg && <p className="field-error" role="alert">{t(msg)}</p>}
        </form>
        <div className="ctl">
          <span className="ctl-label">{t('ctl.period')}</span>
          <div className="row">
            <select value={from.m} onChange={e => setPeriod('from', 'm', +e.target.value)} aria-label={t('ctl.fromM')}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
            <select value={from.y} onChange={e => setPeriod('from', 'y', +e.target.value)} aria-label={t('ctl.fromY')}>{years.map(y => <option key={y}>{y}</option>)}</select>
            <span className="muted">{t('ctl.to')}</span>
            <select value={to.m} onChange={e => setPeriod('to', 'm', +e.target.value)} aria-label={t('ctl.toM')}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
            <select value={to.y} onChange={e => setPeriod('to', 'y', +e.target.value)} aria-label={t('ctl.toY')}>{years.map(y => <option key={y}>{y}</option>)}</select>
          </div>
        </div>
        <div className="ctl">
          <span className="ctl-label">{t('ctl.data')}</span>
          <div className="seg" role="group" aria-label={t('ctl.data')}>
            {Object.keys(SERIES).map(k => <button key={k} className={key === k ? 'on' : ''} aria-pressed={key === k} onClick={() => setKey(k)}>{t(`series.${k}`)}</button>)}
          </div>
        </div>
        <div className="ctl ctl-share">
          <span className="ctl-label">{t('ctl.share')}</span>
          <button className="btn" onClick={copyLink}>{copied ? t('ctl.copied') : t('ctl.copy')}</button>
        </div>
      </section>

      {key !== 'H' && (
        <p className="note"><IconInfo size={18} /><span>{t('note.raw', key === 'MR' ? 'MODIS' : 'VIIRS')} {t(`note.${key}`)} {t('note.switch1')} <button className="link" onClick={() => setKey('H')}>{t('series.H')}</button> {t('note.switch2')}</span></p>
      )}

      <div className="split">
        <div className="panel map-panel">
          <MapView g={g} totals={totals} mask={mask} tool={tool} sel={sel} recent={recent} recentFlags={recentFlags} showRecent={showRecent}
            onDrawn={b => { setSel({ type: 'bbox', ...b }); setTool(null); setCoordMode('box'); setCoords({ s: b.s.toFixed(2), w: b.w.toFixed(2), n: b.n.toFixed(2), e: b.e.toFixed(2) }) }}
            onPick={p => { const r = +pt.r > 0 ? +pt.r : 25; setSel({ type: 'circle', lat: p.lat, lon: p.lon, r }); setTool(null); setCoordMode('point'); setPt({ lat: p.lat.toFixed(4), lon: p.lon.toFixed(4), r: String(r) }) }} />
          <div className="map-foot">
            <p className="map-cap">{tool === 'box' ? t('map.capBox') : tool === 'point' ? t('map.capPoint', rPick) : t('map.cap', periodLabel)}</p>
            {recent && (
              <label className="toggle"><input type="checkbox" checked={showRecent} onChange={e => setShowRecent(e.target.checked)} /><span className="dot-live" />{t('map.recent')}</label>
            )}
          </div>
        </div>
        <div className="stats">
          <div className="area-head">
            <div>
              <h2 className="area">{areaName}</h2>
              <p className="area-sub">{areaKind} · {periodLabel}</p>
            </div>
            {sel.type !== 'all' && <button className="btn ghost" onClick={reset}><IconX size={16} />{t('clear')}</button>}
          </div>
          <div className="tiles">
            <div className="tile">
              <span className="tl">{t('tile.total')}</span>
              <span className="tv">{fmt(total)}</span>
              <span className="ts">{t('tile.totalDesc', key === 'H' ? t('tile.harmScale') : t(`unit.${key}`))}</span>
            </div>
            <div className="tile">
              <span className="tl">{t('tile.season')}</span>
              <span className="tv">{peakLabel}</span>
              <span className="ts">{t('tile.seasonDesc')}</span>
            </div>
            <div className="tile">
              <span className="tl">{t('tile.worst')}</span>
              <span className="tv">{top ? top.y : '-'}</span>
              <span className="ts">{top ? t('tile.worstDesc', top.v, g.firstYear + 1, top.y <= 2002) : ''}</span>
            </div>
            <div className={'tile tile-now' + (status ? ` is-${status}` : '')}>
              <span className="tl">{t('tile.now', MONTHS[lm.m], lm.y, !!partial)}</span>
              <span className="tv">{fmt(lastVal)}</span>
              <span className="ts">
                {status && <span className="badge"><i />{t(`st.${status}`)}</span>}
                {lastBase.median
                  ? `${partial ? t('tile.pace', partial.days, lastProj) : ''}${ratio >= 1 ? t('tile.ratioUp', Math.round(ratio * 10) / 10, MONTHS[lm.m]) : t('tile.ratioDown', Math.round(ratio * 100), MONTHS[lm.m])}${pct != null ? t('tile.pct', pct) : '.'}`
                  : t('tile.noHist')}
              </span>
            </div>
          </div>
          {recent && (
            <div className="live">
              <span className="dot-live" />
              <span>{t('live', recentIn.length, dayLabel(recentFrom), dayLabel(recentTo))}{live && <span className="live-src"> {t('live.src')}</span>}</span>
            </div>
          )}
        </div>
      </div>

      {ol && (
        <section className="panel block outlook">
          <div className="block-head">
            <div>
              <h2>{t('ol.title')}</h2>
              <p className="muted">{t('ol.desc', lastFull - g.firstYear)}</p>
            </div>
          </div>
          <div className="ol-grid">
            <div className="ol-text">
              <p className="ol-big">{ol.inside ? t('ol.now') : ol.weeks <= 1 ? t('ol.week') : t('ol.weeks', ol.weeks)}</p>
              <p>{t('ol.body', ol.months.length > 1 ? t('range', MONTHS[ol.start], MONTHS[ol.end]) : MONTHS[ol.start], Math.round(ol.share * 100), ol.inside, MONTHS[ol.start])}</p>
            </div>
            <div className="ol-bars" role="img" aria-label={t('ol.aria')}>
              {ol.med.map((v, m) => (
                <div key={m} className={'ol-col' + (ol.months.includes(m) ? ' crit' : '') + (m === lm.m ? ' now' : '')} title={t('ol.bar', MONTHS[m], v)}>
                  <div className="ol-bar"><i style={{ height: `${Math.max(2, (v / ol.max) * 100)}%` }} /></div>
                  <span>{MONTHS[m][0]}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="panel block" ref={calRef}>
        <div className="block-head">
          <div>
            <h2>{t('cal.title')}</h2>
            <p className="muted">{mode === 'anomaly' ? t('cal.descA') : t('cal.descC')}</p>
            <p className="block-meta">{areaName} · {periodLabel} · EmberCal (NASA FIRMS MODIS + VIIRS)</p>
          </div>
          <div className="seg no-export" role="group" aria-label={t('cal.title')}>
            <button className={mode === 'count' ? 'on' : ''} aria-pressed={mode === 'count'} onClick={() => setMode('count')}>{t('cal.hot')}</button>
            <button className={mode === 'anomaly' ? 'on' : ''} aria-pressed={mode === 'anomaly'} onClick={() => setMode('anomaly')}>{t('cal.cmp')}</button>
          </div>
        </div>
        <Calendar cal={cal} base={base} mode={mode} unit={t(`unit.${key}`)} highlight={top && top.y} partialFrom={partial} />
        <div className="actions no-export">
          <button className="btn primary" onClick={() => exportCalendar(`embercal_calendar_${slug}_${key}.csv`, cal, `${t(`series.${key}`)}, ${areaName}, ${periodLabel}`)}><IconDownload size={16} />{t('cal.csv')}</button>
          <button className="btn" disabled={busy != null} onClick={async () => {
            setBusy(0)
            const n = await exportHotspots(`embercal_hotspots_${slug}_${d0}_${d1}.csv`, sel, sel.type === 'country' ? g.countries[sel.index] : null, d0, d1, p => setBusy(p))
            setBusy(null)
            setDlMsg(n ? null : 'cal.none')
          }}><IconDownload size={16} />{busy != null ? t('cal.prep', Math.round(busy * 100)) : t('cal.all')}</button>
          <button className="btn" onClick={() => saveImg(calRef, 'calendar')}><IconDownload size={16} />{t('cal.png')}</button>
        </div>
        {dlMsg && <p className="field-error" role="status">{t(dlMsg)}</p>}
      </section>

      <section className="panel block" ref={normRef}>
        <div className="block-head">
          <div>
            <h2>{t('norm.title')}</h2>
            <p className="muted">{t('norm.desc', lm.y)}</p>
          </div>
          <button className="btn ghost no-export" onClick={() => saveImg(normRef, 'normal_year')}><IconDownload size={16} />{t('png')}</button>
        </div>
        <MonthlyProfile base={base} color={ACCENT} currentLabel={String(lm.y)}
          current={MONTHS.map((_, m) => { const i = g.indexOf(lm.y, m + 1); return i <= lastIdx ? series[i] : null })} />
      </section>
      <section className="panel block" ref={yearRef}>
        <div className="block-head">
          <div>
            <h2>{t('year.title')}</h2>
            <p className="muted">{t('year.desc')}</p>
          </div>
          <button className="btn ghost no-export" onClick={() => saveImg(yearRef, 'year_by_year')}><IconDownload size={16} />{t('png')}</button>
        </div>
        <LineChart xs={yearly.map(r => r.y)} xLabel={y => String(y)} yLabel={t('year.title')}
          series={[{ key: 'y', label: t(`series.${key}`), color: ACCENT, values: yearly.map(r => r.v) }]} />
      </section>
    </>
  )
}
