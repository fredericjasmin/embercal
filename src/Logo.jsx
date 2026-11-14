// EmberCal mark: a wide ring (MODIS, ~1 km footprint) around a small lit dot
// (VIIRS, 375 m): two sensors looking at the same fire.
export default function Logo({ size = 28 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="none" stroke="var(--text)" strokeWidth="2.6" />
      <circle cx="19" cy="13" r="5" fill="var(--accent)" />
    </svg>
  )
}
