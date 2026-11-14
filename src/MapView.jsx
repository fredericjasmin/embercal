import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { seqColor, isDark } from './colors'
import { useT } from './i18n'

const TILES = {
  light: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
}
const SEL_COLOR = '#2563eb'

// tool: null | 'box' (drag a rectangle) | 'point' (click a center)
export default function MapView({ g, totals, mask, tool, onDrawn, onPick, sel, recent, recentFlags, showRecent }) {
  const { t, lang } = useT()
  const tRef = useRef(t)
  tRef.current = t
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const selLayer = useRef(null)
  const recentLayer = useRef(null)
  const toolRef = useRef({ tool, onDrawn, onPick })
  toolRef.current = { tool, onDrawn, onPick }

  useEffect(() => {
    const m = L.map(el.current, {
      preferCanvas: true, zoomSnap: 0.25, attributionControl: true,
      scrollWheelZoom: false, minZoom: 4,
      maxBounds: [[0, -100], [26, -70]], maxBoundsViscosity: 0.8,
    })
    m.fitBounds([[7.1, -92.3], [18.6, -77.1]])
    L.tileLayer(isDark() ? TILES.dark : TILES.light, {
      attribution: 'Basemap &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors · Hotspots: NASA FIRMS',
      maxZoom: 12,
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    recentLayer.current = L.layerGroup().addTo(m)
    selLayer.current = L.layerGroup().addTo(m)

    // rectangle drawing with pointer events (mouse, pen and touch); captured before Leaflet sees them
    const box = el.current
    let start = null, rect = null, pid = null
    const toLatLng = e => m.mouseEventToLatLng(e)
    const down = e => {
      if (toolRef.current.tool !== 'box' || (e.button != null && e.button > 0)) return
      if (e.target.closest && e.target.closest('.leaflet-control')) return
      e.preventDefault(); e.stopPropagation()
      pid = e.pointerId
      try { box.setPointerCapture(pid) } catch { /* ignore */ }
      start = toLatLng(e)
      rect = L.rectangle([start, start], { color: SEL_COLOR, weight: 2, fill: false, dashArray: '4 4', interactive: false }).addTo(m)
    }
    const move = e => {
      if (!start || e.pointerId !== pid) return
      e.preventDefault(); e.stopPropagation()
      rect.setBounds([start, toLatLng(e)])
    }
    const up = e => {
      if (!start || e.pointerId !== pid) return
      e.preventDefault(); e.stopPropagation()
      const b = L.latLngBounds(start, toLatLng(e))
      m.removeLayer(rect); rect = null; start = null
      try { box.releasePointerCapture(pid) } catch { /* ignore */ }
      pid = null
      if (b.getNorth() - b.getSouth() > 0.05 && b.getEast() - b.getWest() > 0.05) {
        toolRef.current.onDrawn({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() })
      }
    }
    box.addEventListener('pointerdown', down, true)
    box.addEventListener('pointermove', move, true)
    box.addEventListener('pointerup', up, true)
    box.addEventListener('pointercancel', up, true)
    m.on('click', e => {
      if (toolRef.current.tool === 'point') toolRef.current.onPick({ lat: e.latlng.lat, lon: e.latlng.lng })
    })
    map.current = m
    return () => m.remove()
  }, [])

  useEffect(() => {
    const m = map.current
    el.current.style.cursor = tool ? 'crosshair' : ''
    el.current.style.touchAction = tool === 'box' ? 'none' : ''
    if (!m) return
    if (tool === 'box') { m.dragging.disable(); m.touchZoom.disable(); m.doubleClickZoom.disable() }
    else { m.dragging.enable(); m.touchZoom.enable(); m.doubleClickZoom.enable() }
  }, [tool])

  useEffect(() => {
    const lg = layer.current
    lg.clearLayers()
    let max = 0
    for (const t of totals) if (t > max) max = t
    const renderer = L.canvas({ padding: 0.2 })
    totals.forEach((t, c) => {
      if (t <= 0) return
      const [s, w, n, e] = g.bounds[c]
      L.rectangle([[s, w], [n, e]], {
        renderer, stroke: false, fillOpacity: mask[c] ? 0.85 : 0.22,
        fillColor: seqColor(t, max), interactive: false,
      }).addTo(lg)
    })
  }, [g, totals, mask])

  useEffect(() => {
    const lg = recentLayer.current
    lg.clearLayers()
    if (!showRecent || !recent) return
    const renderer = L.canvas({ padding: 0.2 })
    const ring = isDark() ? '#0e0f11' : '#ffffff'
    recent.forEach(([lat, lon, ago, sensor, frp], k) => {
      const inside = !recentFlags || recentFlags[k]
      L.circleMarker([lat, lon], {
        renderer, radius: ago <= 1 ? 5 : 4, weight: 1.5, color: ring, opacity: inside ? 1 : 0.35,
        fillColor: ago <= 1 ? '#d7191c' : '#f0623a', fillOpacity: inside ? 0.95 : 0.3,
      }).bindTooltip(`${ago === 0 ? tRef.current('map.today') : ago === 1 ? tRef.current('map.yesterday') : tRef.current('map.daysAgo', ago)} · ${sensor === 'V' ? 'VIIRS' : 'MODIS'}${frp ? ` · ${frp} MW` : ''}`).addTo(lg)
    })
  }, [recent, recentFlags, showRecent, lang])

  useEffect(() => {
    const lg = selLayer.current
    lg.clearLayers()
    const style = { color: SEL_COLOR, weight: 2, fill: false, interactive: false }
    if (sel && sel.type === 'bbox') L.rectangle([[sel.s, sel.w], [sel.n, sel.e]], style).addTo(lg)
    if (sel && sel.type === 'circle') {
      L.circle([sel.lat, sel.lon], { ...style, radius: sel.r * 1000 }).addTo(lg)
      L.circleMarker([sel.lat, sel.lon], { radius: 3, color: SEL_COLOR, fillColor: SEL_COLOR, fillOpacity: 1, weight: 1, interactive: false }).addTo(lg)
    }
  }, [sel])

  return <div ref={el} className="map" aria-label="Map of harmonized hotspot density" />
}
