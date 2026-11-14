// Vercel serverless function: active fires of the last 7 days over Central America,
// fetched live from the NASA FIRMS area API. The FIRMS key stays on the server
// (env var FIRMS_MAP_KEY). Responses are cached at the edge for one hour.
// The app falls back to its bundled data if this endpoint is missing or fails.

const BBOX = '-92.3,7.1,-77.1,18.5'
const SOURCES = [
  ['VIIRS_NOAA20_NRT', 'V'],
  ['VIIRS_SNPP_NRT', 'V'],
  ['MODIS_NRT', 'M'],
]

const iso = d => d.toISOString().slice(0, 10)

function parseCsv(text) {
  const lines = text.trim().split('\n')
  if (!lines.length || !lines[0].startsWith('latitude')) return []
  const head = lines[0].split(',')
  const col = n => head.indexOf(n)
  const iLat = col('latitude'), iLon = col('longitude'), iDate = col('acq_date'), iFrp = col('frp'), iConf = col('confidence')
  return lines.slice(1).map(l => l.split(',')).map(f => ({
    lat: +f[iLat], lon: +f[iLon], date: f[iDate], frp: +f[iFrp] || 0, conf: (f[iConf] || '').trim().toLowerCase(),
  }))
}

async function get(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) return []
    return parseCsv(await r.text())
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(req, res) {
  const key = process.env.FIRMS_MAP_KEY
  if (!key) {
    res.status(503).json({ error: 'not configured' })
    return
  }
  const today = new Date()
  const start = new Date(today.getTime() - 6 * 86400000)
  const base = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}`
  const jobs = []
  for (const [src, sensor] of SOURCES) {
    // the API returns at most 5 days per call: latest 5 days + the 2 days before them
    jobs.push(get(`${base}/${src}/${BBOX}/5`).then(rows => rows.map(r => ({ ...r, sensor }))))
    jobs.push(get(`${base}/${src}/${BBOX}/2/${iso(start)}`).then(rows => rows.map(r => ({ ...r, sensor }))))
  }
  const rows = (await Promise.all(jobs)).flat()
  if (!rows.length) {
    res.status(502).json({ error: 'no data from FIRMS' })
    return
  }
  const lastDay = rows.reduce((m, r) => (r.date > m ? r.date : m), '0000-00-00')
  const from = iso(new Date(new Date(lastDay + 'T00:00:00Z').getTime() - 6 * 86400000))
  const seen = new Set()
  const points = []
  rows
    .filter(r => r.date >= from && r.conf !== 'l' && !(r.sensor === 'M' && +r.conf < 30))
    .sort((a, b) => b.frp - a.frp)
    .forEach(r => {
      const k = `${Math.floor(r.lat / 0.01)},${Math.floor(r.lon / 0.01)},${r.date}`
      if (seen.has(k)) return
      seen.add(k)
      const ago = Math.round((Date.parse(lastDay) - Date.parse(r.date)) / 86400000)
      points.push([+r.lat.toFixed(4), +r.lon.toFixed(4), ago, r.sensor, +r.frp.toFixed(1)])
    })
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).json({ from, lastDay, points, source: 'NASA FIRMS NRT (VIIRS NOAA-20, VIIRS S-NPP, MODIS)' })
}
