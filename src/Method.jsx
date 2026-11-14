import { useMemo } from 'react'
import { selectionMask, aggregate, MONTHS } from './data'
import { LineChart } from './Charts'

const C = { modis: 'var(--c1)', viirs: 'var(--c2)', harm: 'var(--fire)' }

export default function Method({ g }) {
  const v = g.validation
  const yearly = useMemo(() => {
    const mask = selectionMask(g, { type: 'all' })
    const s = { H: aggregate(g, mask, 'H'), MR: aggregate(g, mask, 'MR'), VR: aggregate(g, mask, 'VR') }
    const lastFull = g.recent ? g.lastYear - 1 : g.lastYear
    const ys = []
    for (let y = g.firstYear + 1; y <= lastFull; y++) ys.push(y)
    const sum = (arr, y) => {
      let t = 0
      for (let m = 1; m <= 12; m++) { const i = g.indexOf(y, m); if (i >= 0 && i < g.months) t += arr[i] }
      return t
    }
    return { ys, H: ys.map(y => sum(s.H, y)), MR: ys.map(y => sum(s.MR, y)), VR: ys.map(y => (y < 2012 ? null : sum(s.VR, y))) }
  }, [g])

  const valX = v.series.map(r => r[0])
  const mlabel = (i, long) => { const { y, m } = g.monthLabel(i); return long ? `${MONTHS[m]} ${y}` : (m === 0 ? String(y) : '') }
  const row = (name, x, best) => (
    <tr className={best ? 'best' : ''}>
      <th scope="row">{name}</th>
      <td>{x.median_abs_pct_err}%</td>
      <td>{x.total_bias_pct > 0 ? '+' : ''}{x.total_bias_pct}%</td>
      <td>{x.r_log}</td>
    </tr>
  )

  return (
    <article className="method">
      <h1>Method and validation</h1>
      <p className="lead">MODIS has watched fires since 2000 and is being retired. VIIRS took over in 2012 with sharper eyes. Counted naively, the two records disagree by a factor of about five, so any calendar that simply stitches them together invents a huge jump in fire activity in 2012. EmberCal removes that artificial jump.</p>

      <h2>The problem, in one chart</h2>
      <p>Yearly hotspots across Central America. Raw VIIRS sees roughly five times more than raw MODIS for the same fires. Raw MODIS also looks quiet in 2001–2002, because only one of the two MODIS satellites (Terra) was flying before July 2002. The harmonized line is continuous and comparable across the whole period.</p>
      <LineChart xs={yearly.ys} xLabel={y => String(y)} yLabel="Hotspots per year by data source"
        markers={[{ i: yearly.ys.indexOf(2012), label: 'VIIRS starts' }]}
        series={[
          { key: 'MR', label: 'Raw MODIS', color: C.modis, values: yearly.MR, dash: '5 4' },
          { key: 'VR', label: 'Raw VIIRS', color: C.viirs, values: yearly.VR, dash: '2 3' },
          { key: 'H', label: 'Harmonized', color: C.harm, values: yearly.H },
        ]} />

      <h2>How the harmonization works</h2>
      <ol className="steps">
        <li><strong>Same definition of a fire.</strong> Only detections flagged as presumed vegetation fire (type 0) are kept; volcanoes, industrial heat sources and offshore flares are removed. Low-confidence detections are dropped in both sensors (MODIS confidence below 30, VIIRS “low”).</li>
        <li><strong>Same pixel size.</strong> A VIIRS pixel is 375 m wide and a MODIS pixel about 1 km, so one fire can light up several VIIRS pixels where MODIS sees one. VIIRS detections that fall in the same ~1 km cell during the same overpass are counted once. This alone removes {Math.round((1 - v.viirs_1km_dedup_ratio) * 100)}% of the VIIRS count.</li>
        <li><strong>Same number of satellites.</strong> Before Aqua joined in July 2002, MODIS flew on Terra only. Using 2003–2019, when both flew, we learned how many detections Terra alone misses in each month of the year (Terra + Aqua is {Math.min(...Object.values(v.terra_factor)).toFixed(1)}–{Math.max(...Object.values(v.terra_factor)).toFixed(1)}× Terra alone) and scaled Nov 2000–Jun 2002 accordingly.</li>
        <li><strong>Calibrated where both sensors overlap.</strong> From 2012 both sensors watch the same fires. For every 1° × 1° area and month of the year we measure how many VIIRS-1 km detections correspond to one MODIS detection. Areas with few fires borrow strength from their neighbors’ average and the regional value for that month (statistical shrinkage), and totals are kept equal to what VIIRS measured. The overall ratio is {v.global_ratio.toFixed(2)}.</li>
        <li><strong>One series.</strong> From 2012 on, the calendar uses what VIIRS actually measured (on the 1 km basis). Before 2012, it uses MODIS converted with those ratios. Units are “VIIRS-1 km equivalent detections”.</li>
        {g.recent && (
          <li><strong>Ready for the next sensor change.</strong> The S-NPP near-real-time feed stops on {g.recent.snppLastDay}. From the next day, the calendar continues with VIIRS on NOAA-20 (same instrument, different satellite), scaled by the S-NPP / NOAA-20 ratio measured on the days both observed in 2026 ({g.recent.noaa20Ratio.toFixed(3)}). Data are current to {g.recent.lastDay}. Near-real-time files have no fire-type flag, so detections at places the archive marks as volcanoes or industrial heat sources are removed.</li>
        )}
      </ol>

      <h2>Does it work? A blind test</h2>
      <p>We calibrated the ratios only with {v.calibration_years[0]}–{v.calibration_years[1]}, then used them to predict what VIIRS would see in {v.validation_years[0]}–{v.validation_years[1]} from MODIS alone, and compared with what VIIRS really saw, area by area and month by month ({v.n.toLocaleString('en-US')} comparisons).</p>
      <div className="table-wrap">
        <table className="metrics">
          <thead><tr><th scope="col">Method</th><th scope="col">Typical error per area and month</th><th scope="col">Bias in the total</th><th scope="col">Correlation (log)</th></tr></thead>
          <tbody>
            {row('Raw MODIS, no harmonization', v.raw_modis)}
            {row('One single ratio for the whole region', v.single_global_ratio)}
            {row('EmberCal harmonization', v.harmonized, true)}
          </tbody>
        </table>
      </div>
      <p className="muted small">Typical error is the median absolute percentage error over area-months with at least 10 VIIRS detections. The remaining bias is within the natural year-to-year variation of the VIIRS/MODIS ratio (3.2–4.2 between 2012 and 2025).</p>
      <LineChart xs={valX} xLabel={mlabel} yLabel="Blind test, monthly totals"
        series={[
          { key: 'M', label: 'Raw MODIS', color: C.modis, values: v.series.map(r => r[1]), dash: '5 4' },
          { key: 'V', label: 'VIIRS measured (1 km basis)', color: C.viirs, values: v.series.map(r => r[2]) },
          { key: 'P', label: 'Predicted from MODIS', color: C.harm, values: v.series.map(r => r[3]), dash: '2 3' },
        ]} />

      <h2>Limitations</h2>
      <ul>
        <li>A hotspot is a hot pixel at the moment a satellite passed, not a fire. Cloud cover, smoke and overpass time affect what is seen; counts are an index of burning activity, not burned area.</li>
        <li>Ratios assume the relation between sensors in 2012–2025 also held before 2012.</li>
        <li>MODIS Terra's orbit has drifted since 2020; this does not affect the calendar after 2012, which uses VIIRS.</li>
      </ul>

      <h2>Data</h2>
      <ul>
        <li>NASA FIRMS, MODIS Collection 6.1 active fire product (MCD14ML), Terra and Aqua, Nov 2000–Dec 2025.</li>
        <li>NASA FIRMS, VIIRS S-NPP 375 m active fire product (VNP14IMGTDL), Jan 2012–Dec 2025.</li>
        <li>Country yearly archives for Belize, Costa Rica, El Salvador, Guatemala, Honduras, Nicaragua and Panama.</li>
        <li>2026: FIRMS area API, standard and near-real-time MODIS, VIIRS S-NPP and VIIRS NOAA-20, clipped to the seven countries with Natural Earth boundaries.</li>
      </ul>
    </article>
  )
}
