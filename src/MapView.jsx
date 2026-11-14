import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { seqColor, isDark } from './colors'

const TILES = {
  light: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
}

export default function MapView({ g, totals, mask, drawing, onDrawn, bbox }) {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const selLayer = useRef(null)
  const drawRef = useRef({ drawing, onDrawn })
  drawRef.current = { drawing, onDrawn }

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
    selLayer.current = L.layerGroup().addTo(m)

    // rectangle drawing
    let start = null, rect = null
    m.on('mousedown', e => {
      if (!drawRef.current.drawing) return
      m.dragging.disable()
      start = e.latlng
      rect = L.rectangle([start, start], { color: '#1c5cab', weight: 2, fill: false, dashArray: '4 4' }).addTo(m)
    })
    m.on('mousemove', e => { if (start && rect) rect.setBounds([start, e.latlng]) })
    m.on('mouseup', e => {
      if (!start) return
      const b = L.latLngBounds(start, e.latlng)
      m.removeLayer(rect); rect = null; start = null
      m.dragging.enable()
      if (b.getNorth() - b.getSouth() > 0.05 && b.getEast() - b.getWest() > 0.05) {
        drawRef.current.onDrawn({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() })
      }
    })
    map.current = m
    return () => m.remove()
  }, [])

  useEffect(() => {
    el.current.style.cursor = drawing ? 'crosshair' : ''
  }, [drawing])

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
        renderer, stroke: false, fillOpacity: mask[c] ? 0.85 : 0.25,
        fillColor: seqColor(t, max), interactive: false,
      }).addTo(lg)
    })
  }, [g, totals, mask])

  useEffect(() => {
    const lg = selLayer.current
    lg.clearLayers()
    if (bbox) L.rectangle([[bbox.s, bbox.w], [bbox.n, bbox.e]], { color: '#1c5cab', weight: 2, fill: false, interactive: false }).addTo(lg)
  }, [bbox])

  return <div ref={el} className="map" aria-label="Map of harmonized hotspot density" />
}
