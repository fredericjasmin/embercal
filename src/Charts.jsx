import { useEffect, useRef, useState } from 'react'
import { useT } from './i18n'

const fmt = v => v == null ? '-' : Math.round(v).toLocaleString('en-US')

function niceMax(v) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p
  return 10 * p
}

// Line chart with one shared y axis. series: [{key,label,color,values,dash}]
export function LineChart({ xs, xLabel, series, height = 240, yLabel, band, markers, labelAll, bandLabel, bandTip }) {
  const [hover, setHover] = useState(null)
  const box = useRef(null)
  const [W, setW] = useState(720)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = height, pad = { l: 56, r: 16, t: 12, b: 28 }
  const all = series.flatMap(s => s.values.filter(v => v != null)).concat(band ? band.flatMap(b => [b[1]]) : [])
  const ymax = niceMax(Math.max(...all, 1))
  const x = i => pad.l + (xs.length === 1 ? 0 : (i / (xs.length - 1)) * (W - pad.l - pad.r))
  const y = v => pad.t + (1 - v / ymax) * (H - pad.t - pad.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * ymax)
  const every = Math.ceil(xs.length / Math.max(4, Math.floor(W / 70)))

  const path = vals => {
    let d = '', pen = false
    vals.forEach((v, i) => {
      if (v == null) { pen = false; return }
      d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1)
      pen = true
    })
    return d
  }

  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (xs.length - 1))
    setHover(i >= 0 && i < xs.length ? i : null)
  }

  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={yLabel}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{fmt(t)}</text>
          </g>
        ))}
        {xs.map((v, i) => (labelAll ? xLabel(v) : i % every === 0) && (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="tick">{xLabel(v)}</text>
        ))}
        {band && (
          <path className="band" d={
            band.map((b, i) => (i ? 'L' : 'M') + x(i) + ',' + y(b[1])).join('') +
            band.slice().reverse().map((b, k) => 'L' + x(band.length - 1 - k) + ',' + y(b[0])).join('') + 'Z'
          } />
        )}
        {markers && markers.map(mk => (
          <g key={mk.i}>
            <line x1={x(mk.i)} x2={x(mk.i)} y1={pad.t} y2={H - pad.b} className="marker" />
            <text x={x(mk.i) + 4} y={pad.t + 10} className="tick">{mk.label}</text>
          </g>
        ))}
        {series.map(s => (
          <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash || undefined} strokeLinejoin="round" />
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} className="crosshair" />
            {series.map(s => s.values[hover] != null && (
              <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r="4" fill={s.color} className="dot" />
            ))}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="tooltip chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{xLabel(xs[hover], true)}</strong>
          {series.map(s => <div key={s.key}><i className="sw" style={{ background: s.color }} />{s.label}: {fmt(s.values[hover])}</div>)}
          {band && <div className="muted">{bandTip || 'Typical range'}: {fmt(band[hover][0])}-{fmt(band[hover][1])}</div>}
        </div>
      )}
      {series.length > 1 && (
        <div className="legend">
          {series.map(s => <span key={s.key} className="lg"><i className={'line' + (s.dash ? ' dashed' : '')} style={{ borderColor: s.color }} />{s.label}</span>)}
          {band && <span className="lg"><i className="bandsw" />{bandLabel || 'Typical range (25th-75th pct.)'}</span>}
        </div>
      )}
    </div>
  )
}

export function MonthlyProfile({ base, current, currentLabel, color }) {
  const { t, months: MONTHS } = useT()
  return (
    <LineChart
      xs={MONTHS.map((_, i) => i)}
      xLabel={(i) => MONTHS[i]}
      yLabel={t('norm.title')}
      band={base.map(b => [b.p25 ?? 0, b.p75 ?? 0])}
      bandLabel={t('norm.range')}
      bandTip={t('norm.rangeTip')}
      series={[
        { key: 'med', label: t('norm.median'), color: 'var(--ink-2)', values: base.map(b => b.median), dash: '5 4' },
        { key: 'cur', label: currentLabel, color, values: current },
      ]}
    />
  )
}
