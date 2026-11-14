// Sequential (one warm hue, light -> dark) and diverging (blue <-> red, gray midpoint) ramps.
// Light and dark modes have their own steps; the lightest/darkest step means "near zero".

const SEQ_LIGHT = ['#fbeee4', '#f8d7bf', '#f4bb93', '#ee9a66', '#e3783e', '#cd5a24', '#a8441a', '#7d3214', '#55220e']
const SEQ_DARK = ['#232425', '#45291d', '#6b3419', '#8f411b', '#b3521f', '#d26a2e', '#e98b4f', '#f6b07e', '#fdd6b6']

const DIV_LIGHT = { neg: ['#104281', '#256abf', '#5598e7', '#9ec5f4'], mid: '#f0efec', pos: ['#f4b4a8', '#e8776d', '#c9403f', '#8f2122'] }
const DIV_DARK = { neg: ['#9ec5f4', '#5598e7', '#256abf', '#184f95'], mid: '#383835', pos: ['#7a2b2a', '#b23b3a', '#e06564', '#f4aca6'] }

export function isDark() {
  const t = document.documentElement.dataset.theme
  if (t) return t === 'dark'
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function seqRamp() { return isDark() ? SEQ_DARK : SEQ_LIGHT }

// value -> color between 0 and max, on a log or square-root scale
export function seqColor(v, max, scale = 'log') {
  if (v == null) return null
  const ramp = seqRamp()
  if (v <= 0 || max <= 0) return ramp[0]
  const t = scale === 'sqrt' ? Math.sqrt(v / max) : Math.log1p(v) / Math.log1p(max)
  const i = Math.min(ramp.length - 1, 1 + Math.floor(t * (ramp.length - 1)))
  return ramp[i]
}

// ratio vs baseline -> diverging color, symmetric in log2 (1/4x .. 4x)
export function divColor(ratio) {
  if (ratio == null || !isFinite(ratio)) return null
  const d = isDark() ? DIV_DARK : DIV_LIGHT
  const l = Math.log2(Math.max(ratio, 1e-6))
  if (Math.abs(l) < 0.25) return d.mid
  const steps = [0.5, 1, 1.5, 99]
  const k = steps.findIndex(s => Math.abs(l) <= s)
  return l < 0 ? d.neg[3 - k] : d.pos[k]
}

export const DIV_LEGEND = [
  { label: '≤ ¼×', r: 0.2 }, { label: '½×', r: 0.5 }, { label: '¾×', r: 0.75 }, { label: 'typical', r: 1 },
  { label: '1.5×', r: 1.6 }, { label: '2×', r: 2.2 }, { label: '≥ 3×', r: 3.5 },
]
