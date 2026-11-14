import { createContext, useContext } from 'react'

export const LANGS = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'es', label: 'ES', name: 'Español' },
]

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
}

const COUNTRY_ES = { Belize: 'Belice', Panama: 'Panamá' }

const fmtN = v => v == null ? '-' : Math.round(v).toLocaleString('en-US')

const D = {
  en: {
    'nav.explore': 'Explore', 'nav.method': 'Method', 'nav.lang': 'Language',
    loading: 'Loading 25 years of satellite hotspots…',
    'foot.built': 'EmberCal · built by team Bush Coding for the 2026 NASA Space Apps Challenge',
    'foot.data': 'Fire data: NASA FIRMS active fire products, MODIS Collection 6.1 (Terra and Aqua) and VIIRS 375 m (Suomi NPP, NOAA-20). Not an official NASA product.',
    'foot.source': 'Source code',
    'intro.title': 'When does Central America burn?',
    'intro.lead': '25 years of NASA satellite fire detections, from two generations of sensors (MODIS and VIIRS), put on one fair scale so every year can be compared with the others.',
    'how.1b': 'Pick an area:', 'how.1': 'a country, a box or a point on the map, or coordinates.',
    'how.2b': 'Read the calendar:', 'how.2': 'each row is a year and each square a month. Darker means more fire.',
    'how.3b': 'Download the data:', 'how.3': 'the calendar, every hotspot as CSV, or the charts as images.',
    'ctl.area': 'Area', 'ctl.all': 'All 7 countries', 'ctl.country': 'Choose a country',
    'ctl.box': 'Draw a box', 'ctl.boxOn': 'Now drag on the map', 'ctl.point': 'Pick a point', 'ctl.pointOn': 'Now click the map',
    'ctl.orType': 'Or type', 'ctl.aBox': 'A box', 'ctl.aPoint': 'A point and radius',
    'ctl.s': 'South', 'ctl.w': 'West', 'ctl.n': 'North', 'ctl.e': 'East',
    'ctl.lat': 'Latitude', 'ctl.lon': 'Longitude', 'ctl.r': 'Radius (km)', 'ctl.apply': 'Apply',
    'ctl.period': 'Period', 'ctl.to': 'to', 'ctl.fromM': 'From month', 'ctl.fromY': 'From year', 'ctl.toM': 'To month', 'ctl.toY': 'To year',
    'ctl.data': 'Data', 'ctl.share': 'Share this view', 'ctl.copy': 'Copy link', 'ctl.copied': 'Link copied',
    'series.H': 'Harmonized', 'series.MR': 'Raw MODIS', 'series.VR': 'Raw VIIRS',
    'unit.H': 'VIIRS-1km equivalent detections', 'unit.MR': 'MODIS detections (Terra + Aqua)', 'unit.VR': 'VIIRS S-NPP detections (375 m)',
    'note.raw': s => `You are viewing raw ${s} detections.`,
    'note.MR': 'Before July 2002 only one MODIS satellite (Terra) was flying, so early years look quieter than they were.',
    'note.VR': 'VIIRS only exists since 2012, and its sharper pixels count one fire several times.',
    'note.switch1': 'Switch to', 'note.switch2': 'to compare years fairly.',
    'err.box': 'Enter south < north and west < east, in decimal degrees (for example 10.0, -86.0, 11.2, -84.8).',
    'err.point': 'Enter a latitude and longitude in decimal degrees (for example 10.63, -85.44) and a radius between 1 and 500 km.',
    'map.capBox': 'Click and drag to draw a box around the area you want.',
    'map.capPoint': r => `Click the map to search ${r} km around that point.`,
    'map.cap': p => `Squares: where satellites saw fire, ${p}. Faded ones are outside your area.`,
    'map.recent': 'Active fires, last 7 days',
    'map.today': 'Today', 'map.yesterday': 'Yesterday', 'map.daysAgo': n => `${n} days ago`,
    'area.ca': 'Central America',
    'area.circle': (r, lat, lon) => `${r} km around ${lat}°, ${lon}°`,
    'area.box': (s, w, n, e) => `${s}°, ${w}° to ${n}°, ${e}°`,
    'kind.all': 'All 7 countries', 'kind.country': 'Country', 'kind.circle': 'Around a point', 'kind.box': 'Custom box',
    period: (m0, y0, m1, y1) => `${m0} ${y0} to ${m1} ${y1}`,
    'clear': 'Clear',
    'tile.total': 'Hotspots in the period',
    'tile.totalDesc': u => `Satellite fire detections in this area (${u}).`, 'tile.harmScale': 'on the harmonized scale',
    'tile.season': 'Fire season', 'tile.seasonDesc': 'The months that usually burn the most.',
    'tile.worst': 'Worst year',
    'tile.worstDesc': (v, y0, est) => `${fmtN(v)} hotspots, the most of any year since ${y0}.${est ? ' Estimated: before mid-2002 only one MODIS satellite was flying.' : ''}`,
    'tile.now': (m, y, partial) => `${m} ${y}${partial ? ' so far' : ''}`,
    'st.high': 'Above normal', 'st.low': 'Below normal', 'st.normal': 'Normal',
    'tile.pace': (days, proj) => `Days 1-${days}, on pace for ${fmtN(proj)}: `,
    'tile.ratioUp': (r, m) => `${r}× a typical ${m}`, 'tile.ratioDown': (p, m) => `${p}% of a typical ${m}`,
    'tile.pct': p => `, above ${p}% of past years.`, 'tile.noHist': 'No history for this month.',
    live: (n, a, b) => <><strong>{n.toLocaleString('en-US')}</strong> active {n === 1 ? 'fire' : 'fires'} detected in this area in the last 7 days ({a} to {b}).</>,
    'ol.title': 'Fire season outlook',
    'ol.desc': n => `What a normal year looks like here, month by month, based on ${n} years of harmonized data.`,
    'ol.now': 'The critical period is now.', 'ol.week': 'The critical period starts this week.',
    'ol.weeks': n => `The critical period starts in about ${n} weeks.`,
    'ol.body': (range, share, inside, start) => <>In this area, <strong>{range}</strong> usually concentrates <strong>{share}%</strong> of the year’s fire detections.{!inside && ` Plan patrols, burn permits and community alerts before ${start}.`}</>,
    'ol.bar': (m, v) => `${m}: ${fmtN(v)} hotspots in a typical year`, 'ol.aria': 'Typical hotspots per month',
    'range': (a, b) => `${a} to ${b}`,
    'cal.title': 'Burning calendar',
    'cal.descA': 'Compared with a normal year: red months burned more than usual for that month, blue ones less, gray ones about the same.',
    'cal.descC': 'Each row is a year and each square a month. The darker the square, the more fire was detected.',
    'cal.hot': 'Hotspots', 'cal.cmp': 'Compared with normal',
    'cal.csv': 'Calendar (CSV)', 'cal.all': 'Every hotspot (CSV)', 'cal.prep': p => `Preparing… ${p}%`, 'cal.png': 'Image (PNG)',
    'cal.none': 'There are no hotspots in this area and period.',
    'cal.year': 'Year', 'cal.aria': 'Burning activity calendar',
    'cal.so': ' (so far)', 'cal.hs': v => `${v} hotspots`, 'cal.typ': (m, v) => `Typical ${m}: ${v}`,
    'cal.xTyp': r => `${r}× typical`, 'cal.pTyp': p => `${p}% of typical`, 'cal.progress': 'Month in progress; compared at its current pace',
    'cal.legA': 'vs. median of the same month', 'cal.legC': u => `${u} per month`, 'cal.sqrt': '(square-root scale)', 'cal.typical': 'typical',
    'norm.title': 'A normal year', 'norm.desc': y => `How much a typical month burns here (dashed line and shaded range), and how ${y} is going.`,
    'norm.median': 'Median month', 'norm.range': 'Typical range (25th-75th pct.)', 'norm.rangeTip': 'Typical range',
    'year.title': 'Year by year', 'year.desc': 'Total hotspots per complete year in this area.',
    'png': 'PNG',
  },
  es: {
    'nav.explore': 'Explorar', 'nav.method': 'Método', 'nav.lang': 'Idioma',
    loading: 'Cargando 25 años de focos de calor satelitales…',
    'foot.built': 'EmberCal · hecho por el equipo Bush Coding para el NASA Space Apps Challenge 2026',
    'foot.data': 'Datos de incendios: productos de fuego activo de NASA FIRMS, MODIS Colección 6.1 (Terra y Aqua) y VIIRS 375 m (Suomi NPP, NOAA-20). No es un producto oficial de la NASA.',
    'foot.source': 'Código fuente',
    'intro.title': '¿Cuándo se quema Centroamérica?',
    'intro.lead': '25 años de detecciones de incendios de los satélites de la NASA, de dos generaciones de sensores (MODIS y VIIRS), llevados a una misma escala para poder comparar cualquier año con los demás.',
    'how.1b': 'Elegí un área:', 'how.1': 'un país, un recuadro o un punto en el mapa, o coordenadas.',
    'how.2b': 'Leé el calendario:', 'how.2': 'cada fila es un año y cada cuadro un mes. Más oscuro es más fuego.',
    'how.3b': 'Descargá los datos:', 'how.3': 'el calendario, cada foco de calor en CSV, o los gráficos como imagen.',
    'ctl.area': 'Área', 'ctl.all': 'Los 7 países', 'ctl.country': 'Elegí un país',
    'ctl.box': 'Dibujar recuadro', 'ctl.boxOn': 'Arrastrá en el mapa', 'ctl.point': 'Elegir un punto', 'ctl.pointOn': 'Hacé clic en el mapa',
    'ctl.orType': 'O escribí', 'ctl.aBox': 'Un recuadro', 'ctl.aPoint': 'Un punto y radio',
    'ctl.s': 'Sur', 'ctl.w': 'Oeste', 'ctl.n': 'Norte', 'ctl.e': 'Este',
    'ctl.lat': 'Latitud', 'ctl.lon': 'Longitud', 'ctl.r': 'Radio (km)', 'ctl.apply': 'Aplicar',
    'ctl.period': 'Período', 'ctl.to': 'a', 'ctl.fromM': 'Mes inicial', 'ctl.fromY': 'Año inicial', 'ctl.toM': 'Mes final', 'ctl.toY': 'Año final',
    'ctl.data': 'Datos', 'ctl.share': 'Compartir esta vista', 'ctl.copy': 'Copiar enlace', 'ctl.copied': 'Enlace copiado',
    'series.H': 'Armonizado', 'series.MR': 'MODIS crudo', 'series.VR': 'VIIRS crudo',
    'unit.H': 'detecciones equivalentes a VIIRS-1 km', 'unit.MR': 'detecciones MODIS (Terra + Aqua)', 'unit.VR': 'detecciones VIIRS S-NPP (375 m)',
    'note.raw': s => `Estás viendo detecciones ${s} sin armonizar.`,
    'note.MR': 'Antes de julio de 2002 solo funcionaba un satélite MODIS (Terra), así que los primeros años parecen más tranquilos de lo que fueron.',
    'note.VR': 'VIIRS existe recién desde 2012, y sus píxeles más finos cuentan un mismo fuego varias veces.',
    'note.switch1': 'Pasá a', 'note.switch2': 'para comparar los años de forma justa.',
    'err.box': 'Ingresá sur < norte y oeste < este, en grados decimales (por ejemplo 10.0, -86.0, 11.2, -84.8).',
    'err.point': 'Ingresá latitud y longitud en grados decimales (por ejemplo 10.63, -85.44) y un radio entre 1 y 500 km.',
    'map.capBox': 'Hacé clic y arrastrá para dibujar un recuadro alrededor del área que querés.',
    'map.capPoint': r => `Hacé clic en el mapa para buscar ${r} km alrededor de ese punto.`,
    'map.cap': p => `Cuadros: dónde los satélites vieron fuego, ${p}. Los más tenues quedan fuera de tu área.`,
    'map.recent': 'Incendios activos, últimos 7 días',
    'map.today': 'Hoy', 'map.yesterday': 'Ayer', 'map.daysAgo': n => `Hace ${n} días`,
    'area.ca': 'Centroamérica',
    'area.circle': (r, lat, lon) => `${r} km alrededor de ${lat}°, ${lon}°`,
    'area.box': (s, w, n, e) => `${s}°, ${w}° a ${n}°, ${e}°`,
    'kind.all': 'Los 7 países', 'kind.country': 'País', 'kind.circle': 'Alrededor de un punto', 'kind.box': 'Recuadro propio',
    period: (m0, y0, m1, y1) => `${m0} ${y0} a ${m1} ${y1}`,
    'clear': 'Quitar',
    'tile.total': 'Focos de calor en el período',
    'tile.totalDesc': u => `Detecciones satelitales de fuego en esta área (${u}).`, 'tile.harmScale': 'en la escala armonizada',
    'tile.season': 'Temporada de fuego', 'tile.seasonDesc': 'Los meses que normalmente más se queman.',
    'tile.worst': 'Peor año',
    'tile.worstDesc': (v, y0, est) => `${fmtN(v)} focos de calor, el año con más desde ${y0}.${est ? ' Estimado: antes de mediados de 2002 solo funcionaba un satélite MODIS.' : ''}`,
    'tile.now': (m, y, partial) => `${m} ${y}${partial ? ' hasta ahora' : ''}`,
    'st.high': 'Sobre lo normal', 'st.low': 'Bajo lo normal', 'st.normal': 'Normal',
    'tile.pace': (days, proj) => `Días 1-${days}, a este ritmo llegaría a ${fmtN(proj)}: `,
    'tile.ratioUp': (r, m) => `${r}× un ${m} típico`, 'tile.ratioDown': (p, m) => `${p}% de un ${m} típico`,
    'tile.pct': p => `, por encima del ${p}% de los años anteriores.`, 'tile.noHist': 'No hay historia para este mes.',
    live: (n, a, b) => <><strong>{n.toLocaleString('en-US')}</strong> {n === 1 ? 'incendio activo detectado' : 'incendios activos detectados'} en esta área en los últimos 7 días ({a} al {b}).</>,
    'ol.title': 'Pronóstico de la temporada de fuego',
    'ol.desc': n => `Cómo es un año normal aquí, mes a mes, según ${n} años de datos armonizados.`,
    'ol.now': 'El período crítico es ahora.', 'ol.week': 'El período crítico empieza esta semana.',
    'ol.weeks': n => `El período crítico empieza en unas ${n} semanas.`,
    'ol.body': (range, share, inside, start) => <>En esta área, <strong>{range}</strong> suele concentrar el <strong>{share}%</strong> de las detecciones de fuego del año.{!inside && ` Planificá patrullajes, permisos de quema y alertas a las comunidades antes de ${start}.`}</>,
    'ol.bar': (m, v) => `${m}: ${fmtN(v)} focos de calor en un año típico`, 'ol.aria': 'Focos de calor típicos por mes',
    'range': (a, b) => `${a} a ${b}`,
    'cal.title': 'Calendario de quemas',
    'cal.descA': 'Comparado con un año normal: en rojo los meses que se quemaron más de lo habitual para ese mes, en azul los que menos, en gris los parecidos.',
    'cal.descC': 'Cada fila es un año y cada cuadro un mes. Cuanto más oscuro, más fuego se detectó.',
    'cal.hot': 'Focos de calor', 'cal.cmp': 'Comparado con lo normal',
    'cal.csv': 'Calendario (CSV)', 'cal.all': 'Todos los focos (CSV)', 'cal.prep': p => `Preparando… ${p}%`, 'cal.png': 'Imagen (PNG)',
    'cal.none': 'No hay focos de calor en esta área y período.',
    'cal.year': 'Año', 'cal.aria': 'Calendario de actividad de quemas',
    'cal.so': ' (hasta ahora)', 'cal.hs': v => `${v} focos de calor`, 'cal.typ': (m, v) => `${m} típico: ${v}`,
    'cal.xTyp': r => `${r}× lo típico`, 'cal.pTyp': p => `${p}% de lo típico`, 'cal.progress': 'Mes en curso; comparado a su ritmo actual',
    'cal.legA': 'vs. mediana del mismo mes', 'cal.legC': u => `${u} por mes`, 'cal.sqrt': '(escala de raíz cuadrada)', 'cal.typical': 'típico',
    'norm.title': 'Un año normal', 'norm.desc': y => `Cuánto se quema en un mes típico aquí (línea punteada y franja), y cómo viene ${y}.`,
    'norm.median': 'Mes mediano', 'norm.range': 'Rango típico (percentil 25 a 75)', 'norm.rangeTip': 'Rango típico',
    'year.title': 'Año por año', 'year.desc': 'Total de focos de calor por año completo en esta área.',
    'png': 'PNG',
  },
}

export const LangContext = createContext({ lang: 'en', setLang: () => {} })

export function useT() {
  const { lang, setLang } = useContext(LangContext)
  const dict = D[lang] || D.en
  const t = (k, ...args) => {
    const v = dict[k] ?? D.en[k]
    return typeof v === 'function' ? v(...args) : (v ?? k)
  }
  const country = c => (lang === 'es' && COUNTRY_ES[c]) || c
  return { t, lang, setLang, months: MONTHS[lang] || MONTHS.en, country }
}

export function initialLang() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '')
  const fromUrl = q.get('lang')
  if (fromUrl === 'en' || fromUrl === 'es') return fromUrl
  try { const s = localStorage.getItem('embercal-lang'); if (s === 'en' || s === 'es') return s } catch { /* ignore */ }
  return (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function saveLang(l) {
  try { localStorage.setItem('embercal-lang', l) } catch { /* ignore */ }
}
