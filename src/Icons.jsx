// Small inline icons (stroke = currentColor), 20px grid.
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

function Svg({ children, size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...P}>{children}</svg>
}

export const IconPin = p => <Svg {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></Svg>
export const IconCalendar = p => <Svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></Svg>
export const IconDownload = p => <Svg {...p}><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></Svg>
export const IconFlame = p => <Svg {...p}><path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 3-5.6 3.5-9.3 2.4 1.4 3.5 3.4 3.5 5.5 1-.8 1.6-2 1.7-3.2 2.4 1.9 4.3 4.3 4.3 7.1C18.5 18.4 15.9 21 12 21z" /></Svg>
export const IconTrophy = p => <Svg {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20h7" /></Svg>
export const IconPulse = p => <Svg {...p}><path d="M3 12h4l2.5-6 4 12 2.5-6H21" /></Svg>
export const IconSum = p => <Svg {...p}><path d="M17 5H7l6 7-6 7h10" /></Svg>
export const IconDraw = p => <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" /><path d="M9 12h6M12 9v6" /></Svg>
export const IconGlobe = p => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5z" /></Svg>
export const IconX = p => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
export const IconInfo = p => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></Svg>
export const IconGithub = p => <Svg {...p}><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" /></Svg>
