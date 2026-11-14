// Loads the harmonized grid and aggregates it over a selected area.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const SERIES = {
  H: { label: 'Harmonized', unit: 'VIIRS-1km equivalent detections', short: 'Harmonized' },
  MR: { label: 'Raw MODIS', unit: 'MODIS detections (Terra + Aqua)', short: 'MODIS' },
  VR: { label: 'Raw VIIRS', unit: 'VIIRS S-NPP detections (375 m)', short: 'VIIRS' },
}

let cache = null

export async function loadGrid() {
  if (cache) return cache
  const [grid, validation] = await Promise.all([
    fetch('/data/grid.json').then(r => r.json()),
    fetch('/data/validation.json').then(r => r.json()),
  ])
  let recent = null
  try {
    const r = await fetch('/data/recent.json')
    if (r.ok) recent = await r.json()
  } catch { /* optional */ }
  const g = { ...grid, validation, recent }
  // merge recent months (2026) if present
  if (recent) {
    g.months = recent.months
    for (const k of ['H', 'MR', 'VR']) g[k] = g[k].concat(recent[k])
    // recent may add new cells
    if (recent.newCells) {
      g.cells = g.cells.concat(recent.newCells)
      g.cellCountry = g.cellCountry.concat(recent.newCellCountry)
    }
  }
  const [y0, m0] = g.start
  g.monthLabel = i => {
    const t = (m0 - 1) + i
    return { y: y0 + Math.floor(t / 12), m: t % 12 }
  }
  g.indexOf = (y, m) => (y - y0) * 12 + (m - m0)
  const last = g.monthLabel(g.months - 1)
  g.lastYear = last.y
  g.lastMonth = last.m
  g.firstYear = y0
  g.bounds = cellBounds(g)
  g.cellIndex = new Map(g.cells.map(([i, j], c) => [`${i},${j}`, c]))
  cache = g
  return g
}

function cellBounds(g) {
  return g.cells.map(([i, j]) => [i * g.cell, j * g.cell, (i + 1) * g.cell, (j + 1) * g.cell])
}

// great-circle distance in km
export function distKm(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// is a point inside a geometric selection (bbox or circle)? countries are handled by the caller
export function inShape(sel, lat, lon) {
  if (sel.type === 'bbox') return lat >= sel.s && lat <= sel.n && lon >= sel.w && lon <= sel.e
  if (sel.type === 'circle') return distKm(sel.lat, sel.lon, lat, lon) <= sel.r
  return true
}

// selection: {type:'all'} | {type:'country', index} | {type:'bbox', s,w,n,e} | {type:'circle', lat, lon, r (km)}
export function selectionMask(g, sel) {
  const mask = new Uint8Array(g.cells.length)
  for (let c = 0; c < g.cells.length; c++) {
    if (sel.type === 'all') mask[c] = 1
    else if (sel.type === 'country') mask[c] = g.cellCountry[c] === sel.index ? 1 : 0
    else {
      const [s, w, n, e] = g.bounds[c]
      mask[c] = inShape(sel, (s + n) / 2, (w + e) / 2) ? 1 : 0
    }
  }
  return mask
}

// bounding box of any geometric selection, for picking point tiles
export function selBox(sel) {
  if (sel.type === 'bbox') return sel
  if (sel.type === 'circle') {
    const dLat = sel.r / 111, dLon = sel.r / (111 * Math.cos(sel.lat * Math.PI / 180))
    return { s: sel.lat - dLat, n: sel.lat + dLat, w: sel.lon - dLon, e: sel.lon + dLon }
  }
  return null
}

export function aggregate(g, mask, key) {
  const out = new Float64Array(g.months)
  const a = g[key]
  for (let k = 0; k < a.length; k += 3) {
    if (mask[a[k]]) out[a[k + 1]] += a[k + 2]
  }
  return out
}

// per-cell totals over a month range, for the map
export function cellTotals(g, key, i0, i1) {
  const out = new Float64Array(g.cells.length)
  const a = g[key]
  for (let k = 0; k < a.length; k += 3) {
    const mi = a[k + 1]
    if (mi >= i0 && mi <= i1) out[a[k]] += a[k + 2]
  }
  return out
}

// years x 12 matrix (null where no data)
export function toCalendar(g, series) {
  const rows = []
  for (let y = g.firstYear; y <= g.lastYear; y++) {
    const row = []
    for (let m = 0; m < 12; m++) {
      const i = g.indexOf(y, m + 1)
      row.push(i >= 0 && i < g.months ? series[i] : null)
    }
    rows.push({ year: y, values: row })
  }
  return rows
}

export function median(xs) {
  const a = xs.filter(x => x != null).sort((p, q) => p - q)
  if (!a.length) return null
  const h = Math.floor(a.length / 2)
  return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2
}

// per month-of-year baseline over complete historical years
export function baselines(cal, y0, y1) {
  const out = []
  for (let m = 0; m < 12; m++) {
    const vals = cal.filter(r => r.year >= y0 && r.year <= y1).map(r => r.values[m])
    const a = vals.filter(x => x != null).sort((p, q) => p - q)
    const q = f => a.length ? a[Math.min(a.length - 1, Math.floor(f * (a.length - 1) + 0.5))] : null
    out.push({ median: median(vals), p25: q(0.25), p75: q(0.75), values: a })
  }
  return out
}

export function percentileRank(sortedVals, x) {
  if (!sortedVals.length || x == null) return null
  let below = 0
  for (const v of sortedVals) if (v < x) below++
  return Math.round((below / sortedVals.length) * 100)
}
