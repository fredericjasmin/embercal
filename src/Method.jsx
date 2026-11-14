import { useMemo } from 'react'
import { selectionMask, aggregate } from './data'
import { LineChart } from './Charts'
import { useT } from './i18n'

const C = { modis: 'var(--c1)', viirs: 'var(--c2)', harm: 'var(--fire)' }

export default function Method({ g }) {
  const { lang, months: MONTHS } = useT()
  const es = lang === 'es'
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
  const dedup = Math.round((1 - v.viirs_1km_dedup_ratio) * 100)
  const tMin = Math.min(...Object.values(v.terra_factor)).toFixed(1)
  const tMax = Math.max(...Object.values(v.terra_factor)).toFixed(1)
  const L = es ? {
    raw: 'MODIS crudo', viirs: 'VIIRS crudo', harm: 'Armonizado', starts: 'Empieza VIIRS',
    vMeas: 'VIIRS medido (base 1 km)', pred: 'Predicho desde MODIS',
  } : {
    raw: 'Raw MODIS', viirs: 'Raw VIIRS', harm: 'Harmonized', starts: 'VIIRS starts',
    vMeas: 'VIIRS measured (1 km basis)', pred: 'Predicted from MODIS',
  }

  const problemChart = (
    <LineChart xs={yearly.ys} xLabel={y => String(y)} yLabel={es ? 'Focos de calor por año según la fuente' : 'Hotspots per year by data source'}
      markers={[{ i: yearly.ys.indexOf(2012), label: L.starts }]}
      series={[
        { key: 'MR', label: L.raw, color: C.modis, values: yearly.MR, dash: '5 4' },
        { key: 'VR', label: L.viirs, color: C.viirs, values: yearly.VR, dash: '2 3' },
        { key: 'H', label: L.harm, color: C.harm, values: yearly.H },
      ]} />
  )
  const blindChart = (
    <LineChart xs={valX} xLabel={mlabel} labelAll yLabel={es ? 'Prueba ciega, totales mensuales' : 'Blind test, monthly totals'}
      series={[
        { key: 'M', label: L.raw, color: C.modis, values: v.series.map(r => r[1]), dash: '5 4' },
        { key: 'V', label: L.vMeas, color: C.viirs, values: v.series.map(r => r[2]) },
        { key: 'P', label: L.pred, color: C.harm, values: v.series.map(r => r[3]), dash: '2 3' },
      ]} />
  )
  const table = (
    <div className="table-wrap">
      <table className="metrics">
        <thead><tr>
          <th scope="col">{es ? 'Método' : 'Method'}</th>
          <th scope="col">{es ? 'Error típico por área y mes' : 'Typical error per area and month'}</th>
          <th scope="col">{es ? 'Sesgo en el total' : 'Bias in the total'}</th>
          <th scope="col">{es ? 'Correlación (log)' : 'Correlation (log)'}</th>
        </tr></thead>
        <tbody>
          {row(es ? 'MODIS crudo, sin armonizar' : 'Raw MODIS, no harmonization', v.raw_modis)}
          {row(es ? 'Un solo factor para toda la región' : 'One single ratio for the whole region', v.single_global_ratio)}
          {row(es ? 'Armonización de EmberCal' : 'EmberCal harmonization', v.harmonized, true)}
        </tbody>
      </table>
    </div>
  )

  if (es) return (
    <article className="method" lang="es">
      <h1>Método y validación</h1>
      <p className="lead">MODIS observa incendios desde el año 2000 y está llegando al final de su vida útil. VIIRS tomó la posta en 2012 con una vista más fina. Si se cuentan tal cual, los dos registros difieren unas cinco veces, así que cualquier calendario que simplemente los una inventa un salto enorme de actividad de fuego en 2012. EmberCal elimina ese salto artificial.</p>

      <h2>El problema, en un gráfico</h2>
      <p>Focos de calor por año en Centroamérica. VIIRS crudo ve unas cinco veces más que MODIS crudo para los mismos incendios. MODIS crudo también parece tranquilo en 2001-2002, porque antes de julio de 2002 solo funcionaba uno de sus dos satélites (Terra). La línea armonizada es continua y comparable en todo el período.</p>
      {problemChart}

      <h2>Cómo funciona la armonización</h2>
      <ol className="steps">
        <li><strong>La misma definición de incendio.</strong> Solo se conservan las detecciones marcadas como posible incendio de vegetación (tipo 0); se quitan volcanes, fuentes de calor industriales y quemas de gas en el mar. En los dos sensores se descartan las detecciones de baja confianza (MODIS con confianza menor a 30, VIIRS "baja").</li>
        <li><strong>El mismo tamaño de píxel.</strong> Un píxel de VIIRS mide 375 m y uno de MODIS cerca de 1 km, así que un mismo fuego puede encender varios píxeles de VIIRS donde MODIS ve uno. Las detecciones de VIIRS que caen en la misma celda de ~1 km durante la misma pasada se cuentan una sola vez. Solo esto quita el {dedup}% del conteo de VIIRS.</li>
        <li><strong>La misma cantidad de satélites.</strong> Antes de que Aqua se sumara en julio de 2002, MODIS volaba solo en Terra. Con 2003-2019, cuando volaban los dos, medimos cuántas detecciones pierde Terra solo en cada mes del año (Terra + Aqua es {tMin}-{tMax}× Terra solo) y ajustamos noviembre 2000 a junio 2002.</li>
        <li><strong>Calibrado donde los dos sensores coinciden.</strong> Desde 2012 los dos sensores miran los mismos incendios. Para cada área de 1° × 1° y cada mes del año medimos cuántas detecciones VIIRS-1 km corresponden a una de MODIS. Las áreas con pocos incendios se apoyan en el promedio de su zona y en el valor regional de ese mes (contracción estadística), y los totales se mantienen iguales a lo que midió VIIRS. La relación general es {v.global_ratio.toFixed(2)}.</li>
        <li><strong>Una sola serie.</strong> Desde 2012 el calendario usa lo que VIIRS midió (en base 1 km). Antes de 2012 usa MODIS convertido con esas relaciones. Las unidades son "detecciones equivalentes a VIIRS-1 km".</li>
        {g.recent && (
          <li><strong>Listo para el próximo cambio de sensor.</strong> La señal casi en tiempo real de S-NPP se corta el {g.recent.snppLastDay}. Desde el día siguiente, el calendario sigue con VIIRS en NOAA-20 (el mismo instrumento en otro satélite), ajustado con la relación S-NPP / NOAA-20 medida en los días en que observaron los dos en 2026 ({g.recent.noaa20Ratio.toFixed(3)}). Datos al {g.recent.lastDay}. Los archivos casi en tiempo real no traen el tipo de fuego, así que se quitan las detecciones en lugares que el archivo histórico marca como volcanes o fuentes industriales.</li>
        )}
      </ol>

      <h2>¿Funciona? Una prueba ciega</h2>
      <p>Calibramos las relaciones solo con {v.calibration_years[0]}-{v.calibration_years[1]}, las usamos para predecir, solo a partir de MODIS, lo que VIIRS vería en {v.validation_years[0]}-{v.validation_years[1]}, y lo comparamos con lo que VIIRS realmente vio, área por área y mes por mes ({v.n.toLocaleString('en-US')} comparaciones).</p>
      {table}
      <p className="muted small">El error típico es la mediana del error porcentual absoluto en las áreas-mes con al menos 10 detecciones de VIIRS. El sesgo restante está dentro de la variación natural de un año a otro de la relación VIIRS/MODIS (3,2 a 4,2 entre 2012 y 2025).</p>
      {blindChart}

      <h2>Limitaciones</h2>
      <ul>
        <li>Un foco de calor es un píxel caliente en el momento en que pasó el satélite, no un incendio. Las nubes, el humo y la hora de paso influyen en lo que se ve; los conteos son un índice de actividad de quema, no de área quemada.</li>
        <li>Las relaciones suponen que el vínculo entre sensores de 2012-2025 también valía antes de 2012.</li>
        <li>La órbita de MODIS Terra se desplazó desde 2020; esto no afecta al calendario después de 2012, que usa VIIRS.</li>
      </ul>

      <h2>Accesibilidad</h2>
      <ul>
        <li>El calendario usa una escala de un solo tono cuya luminosidad crece paso a paso, así que se lee igual con daltonismo y en escala de grises (verificado con un validador automático de paletas: luminosidad creciente, saltos visibles entre pasos, un solo tono).</li>
        <li>La vista "comparado con lo normal" usa una escala de azul a rojo con gris neutro en el medio, una combinación que se distingue con las formas comunes de daltonismo. Cada cuadro muestra además su valor exacto al pasar el mouse, y todo se puede descargar en CSV.</li>
        <li>Los temas claro y oscuro siguen la configuración del dispositivo; el diseño funciona desde teléfonos de 320 px hasta pantallas anchas. La app está en inglés y español.</li>
      </ul>

      <h2>Datos</h2>
      <ul>
        <li>NASA FIRMS, producto de fuego activo MODIS Colección 6.1 (MCD14ML), Terra y Aqua, noviembre 2000 a diciembre 2025.</li>
        <li>NASA FIRMS, producto de fuego activo VIIRS S-NPP 375 m (VNP14IMGTDL), enero 2012 a diciembre 2025.</li>
        <li>Archivos anuales por país de Belice, Costa Rica, El Salvador, Guatemala, Honduras, Nicaragua y Panamá.</li>
        <li>2026: API por área de FIRMS, MODIS, VIIRS S-NPP y VIIRS NOAA-20 estándar y casi en tiempo real, recortados a los siete países con los límites de Natural Earth.</li>
      </ul>
    </article>
  )

  return (
    <article className="method" lang="en">
      <h1>Method and validation</h1>
      <p className="lead">MODIS has watched fires since 2000 and is being retired. VIIRS took over in 2012 with sharper eyes. Counted naively, the two records disagree by a factor of about five, so any calendar that simply stitches them together invents a huge jump in fire activity in 2012. EmberCal removes that artificial jump.</p>

      <h2>The problem, in one chart</h2>
      <p>Yearly hotspots across Central America. Raw VIIRS sees roughly five times more than raw MODIS for the same fires. Raw MODIS also looks quiet in 2001-2002, because only one of the two MODIS satellites (Terra) was flying before July 2002. The harmonized line is continuous and comparable across the whole period.</p>
      {problemChart}

      <h2>How the harmonization works</h2>
      <ol className="steps">
        <li><strong>Same definition of a fire.</strong> Only detections flagged as presumed vegetation fire (type 0) are kept; volcanoes, industrial heat sources and offshore flares are removed. Low-confidence detections are dropped in both sensors (MODIS confidence below 30, VIIRS “low”).</li>
        <li><strong>Same pixel size.</strong> A VIIRS pixel is 375 m wide and a MODIS pixel about 1 km, so one fire can light up several VIIRS pixels where MODIS sees one. VIIRS detections that fall in the same ~1 km cell during the same overpass are counted once. This alone removes {dedup}% of the VIIRS count.</li>
        <li><strong>Same number of satellites.</strong> Before Aqua joined in July 2002, MODIS flew on Terra only. Using 2003-2019, when both flew, we learned how many detections Terra alone misses in each month of the year (Terra + Aqua is {tMin}-{tMax}× Terra alone) and scaled Nov 2000-Jun 2002 accordingly.</li>
        <li><strong>Calibrated where both sensors overlap.</strong> From 2012 both sensors watch the same fires. For every 1° × 1° area and month of the year we measure how many VIIRS-1 km detections correspond to one MODIS detection. Areas with few fires borrow strength from their neighbors’ average and the regional value for that month (statistical shrinkage), and totals are kept equal to what VIIRS measured. The overall ratio is {v.global_ratio.toFixed(2)}.</li>
        <li><strong>One series.</strong> From 2012 on, the calendar uses what VIIRS actually measured (on the 1 km basis). Before 2012, it uses MODIS converted with those ratios. Units are “VIIRS-1 km equivalent detections”.</li>
        {g.recent && (
          <li><strong>Ready for the next sensor change.</strong> The S-NPP near-real-time feed stops on {g.recent.snppLastDay}. From the next day, the calendar continues with VIIRS on NOAA-20 (same instrument, different satellite), scaled by the S-NPP / NOAA-20 ratio measured on the days both observed in 2026 ({g.recent.noaa20Ratio.toFixed(3)}). Data are current to {g.recent.lastDay}. Near-real-time files have no fire-type flag, so detections at places the archive marks as volcanoes or industrial heat sources are removed.</li>
        )}
      </ol>

      <h2>Does it work? A blind test</h2>
      <p>We calibrated the ratios only with {v.calibration_years[0]}-{v.calibration_years[1]}, then used them to predict what VIIRS would see in {v.validation_years[0]}-{v.validation_years[1]} from MODIS alone, and compared with what VIIRS really saw, area by area and month by month ({v.n.toLocaleString('en-US')} comparisons).</p>
      {table}
      <p className="muted small">Typical error is the median absolute percentage error over area-months with at least 10 VIIRS detections. The remaining bias is within the natural year-to-year variation of the VIIRS/MODIS ratio (3.2-4.2 between 2012 and 2025).</p>
      {blindChart}

      <h2>Limitations</h2>
      <ul>
        <li>A hotspot is a hot pixel at the moment a satellite passed, not a fire. Cloud cover, smoke and overpass time affect what is seen; counts are an index of burning activity, not burned area.</li>
        <li>Ratios assume the relation between sensors in 2012-2025 also held before 2012.</li>
        <li>MODIS Terra's orbit has drifted since 2020; this does not affect the calendar after 2012, which uses VIIRS.</li>
      </ul>

      <h2>Accessibility</h2>
      <ul>
        <li>The calendar uses a single-hue color ramp whose lightness grows step by step, so it reads the same with color blindness and in grayscale (checked with an automated palette validator: monotone lightness, visible gaps between steps, one hue).</li>
        <li>The “compared with normal” view uses a blue to red scale with a neutral gray middle, a pairing that stays distinguishable for the common forms of color blindness. Every square also shows its exact value on hover, and everything can be downloaded as CSV.</li>
        <li>Light and dark themes follow the device setting; the layout works from 320 px phones to wide screens. The app is available in English and Spanish.</li>
      </ul>

      <h2>Data</h2>
      <ul>
        <li>NASA FIRMS, MODIS Collection 6.1 active fire product (MCD14ML), Terra and Aqua, Nov 2000-Dec 2025.</li>
        <li>NASA FIRMS, VIIRS S-NPP 375 m active fire product (VNP14IMGTDL), Jan 2012-Dec 2025.</li>
        <li>Country yearly archives for Belize, Costa Rica, El Salvador, Guatemala, Honduras, Nicaragua and Panama.</li>
        <li>2026: FIRMS area API, standard and near-real-time MODIS, VIIRS S-NPP and VIIRS NOAA-20, clipped to the seven countries with Natural Earth boundaries.</li>
      </ul>
    </article>
  )
}
