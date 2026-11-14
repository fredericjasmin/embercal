import { MONTHS, inShape, selBox } from './data'

function save(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export function exportCalendar(name, rows, seriesLabel) {
  const head = ['year', ...MONTHS, 'total'].join(',')
  const lines = rows.map(r => [r.year, ...r.values.map(v => v == null ? '' : Math.round(v * 10) / 10), Math.round(r.values.reduce((s, v) => s + (v || 0), 0))].join(','))
  save(name, `# ${seriesLabel}\n${head}\n${lines.join('\n')}\n`)
}

async function fetchTile(path) {
  const r = await fetch(path)
  if (!r.ok) return ''
  const buf = new Uint8Array(await r.arrayBuffer())
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const ds = new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip')))
    return ds.text()
  }
  return new TextDecoder().decode(buf)
}

// sel: area selection; d0..d1 inclusive dates 'YYYY-MM-DD'; countryName for country selections
export async function exportHotspots(name, sel, countryName, d0, d1, onProgress) {
  const y0 = +d0.slice(0, 4), y1 = +d1.slice(0, 4)
  const box = selBox(sel)
  const idx = await fetch('/data/points/index.json').then(r => r.json())
  let idx26 = []
  try { idx26 = await fetch('/data/points/index_2026.json').then(r => r.json()) } catch { /* none */ }
  const index = [...(y0 <= 2025 ? idx.map(t => [t[0], t[1], '']) : []), ...(y1 >= 2026 ? idx26.map(t => [t[0], t[1], '_2026']) : [])]
  const tiles = index.filter(([bi, bj]) => {
    if (!box) return true
    return bi + 1 > box.s && bi < box.n && bj + 1 > box.w && bj < box.e
  })
  let header = null
  const out = []
  for (let k = 0; k < tiles.length; k++) {
    onProgress && onProgress(k / tiles.length)
    const text = await fetchTile(`/data/points/${tiles[k][0]}_${tiles[k][1]}${tiles[k][2]}.csv.gz`)
    const lines = text.split('\n')
    if (!header) header = lines[0]
    const cols = header.split(',')
    const iLat = cols.indexOf('latitude'), iLon = cols.indexOf('longitude'), iDate = cols.indexOf('acq_date'), iC = cols.indexOf('country')
    for (let i = 1; i < lines.length; i++) {
      const L = lines[i]
      if (!L) continue
      const f = L.split(',')
      const d = f[iDate]
      if (d < d0 || d > d1) continue
      if (box) {
        if (!inShape(sel, +f[iLat], +f[iLon])) continue
      } else if (sel.type === 'country' && f[iC].replace(/_/g, ' ') !== countryName) continue
      out.push(L)
    }
  }
  onProgress && onProgress(1)
  out.sort((a, b) => (a.split(',')[2] < b.split(',')[2] ? -1 : 1))
  save(name, `${header || ''}\n${out.join('\n')}\n`)
  return out.length
}

export async function exportImage(node, name) {
  const { toPng } = await import('html-to-image')
  const bg = getComputedStyle(document.body).backgroundColor || '#ffffff'
  const url = await toPng(node, { backgroundColor: bg, pixelRatio: 2, filter: el => !(el.classList && el.classList.contains('no-export')) })
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}
