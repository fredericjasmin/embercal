import { useState } from 'react'
import { useT } from './i18n'
import { seqColor, divColor, seqRamp, DIV_LEGEND } from './colors'

const fmt = v => v == null ? '-' : v >= 100 ? Math.round(v).toLocaleString('en-US') : (Math.round(v * 10) / 10).toLocaleString('en-US')

export default function Calendar({ cal, base, mode, unit, highlight, partialFrom }) {
  const { t, months: MONTHS } = useT()
  const [tip, setTip] = useState(null)
  const max = Math.max(1, ...cal.flatMap(r => r.values.filter(v => v != null)))

  return (
    <div className="calendar" onMouseLeave={() => setTip(null)}>
      <div className="cal-grid" role="table" aria-label={t('cal.aria')}>
        <div className="cal-row cal-head" role="row">
          <div className="cal-year" />
          {MONTHS.map(m => <div key={m} className="cal-mlabel" role="columnheader">{m}</div>)}
          <div className="cal-total" role="columnheader">{t('cal.year')}</div>
        </div>
        {cal.map(r => {
          const total = r.values.reduce((s, v) => s + (v || 0), 0)
          return (
            <div className={'cal-row' + (highlight === r.year ? ' cal-hl' : '')} key={r.year} role="row">
              <div className="cal-year" role="rowheader">{r.year}</div>
              {r.values.map((v, m) => {
                const b = base[m]
                const isPartial = partialFrom && r.year === partialFrom.y && m === partialFrom.m
                const ratio = v != null && b.median ? (v * (isPartial ? partialFrom.pace : 1)) / b.median : null
                const color = v == null ? null : mode === 'anomaly' ? (b.median ? divColor(ratio) : null) : seqColor(v, max, 'sqrt')
                const partial = partialFrom && r.year === partialFrom.y && m === partialFrom.m
                return (
                  <div
                    key={m}
                    role="cell"
                    className={'cal-cell' + (v == null ? ' empty' : '') + (partial ? ' partial' : '')}
                    style={{ background: color || undefined }}
                    onMouseEnter={e => v != null && setTip({ x: e.currentTarget.offsetLeft, y: e.currentTarget.offsetTop, year: r.year, m, v, ratio, median: b.median, partial })}
                    aria-label={`${MONTHS[m]} ${r.year}: ${fmt(v)}`}
                  />
                )
              })}
              <div className="cal-total">{fmt(total)}</div>
            </div>
          )
        })}
        {tip && (
          <div className="tooltip" style={{ left: `calc(${tip.x}px + 28px)`, top: tip.y - 8 }}>
            <strong>{MONTHS[tip.m]} {tip.year}{tip.partial ? t('cal.so') : ''}</strong>
            <div>{t('cal.hs', fmt(tip.v))}</div>
            {tip.partial && <div className="muted">{t('cal.progress')}</div>}
            <div className="muted">{t('cal.typ', MONTHS[tip.m], fmt(tip.median))}</div>
            {tip.ratio != null && <div className="muted">{tip.ratio >= 1 ? t('cal.xTyp', fmt(tip.ratio)) : t('cal.pTyp', Math.round(tip.ratio * 100))}</div>}
          </div>
        )}
      </div>
      <div className="legend">
        {mode === 'anomaly' ? (
          <>
            <span className="muted">{t('cal.legA')}</span>
            {DIV_LEGEND.map(l => <span key={l.label} className="lg"><i style={{ background: divColor(l.r) }} />{l.label === 'typical' ? t('cal.typical') : l.label}</span>)}
          </>
        ) : (
          <>
            <span className="muted">{t('cal.legC', unit)}</span>
            <span className="lg">0</span>
            <span className="ramp">{seqRamp().map(c => <i key={c} style={{ background: c }} />)}</span>
            <span className="lg">{fmt(max)}</span>
            <span className="muted">{t('cal.sqrt')}</span>
          </>
        )}
      </div>
    </div>
  )
}
