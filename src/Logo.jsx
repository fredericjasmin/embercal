// EmberCal mark: a 3x3 burning calendar whose cells heat up from pale to ember.
export default function Logo({ size = 28 }) {
  const cells = [
    '#f6dcc7', '#f1c09c', '#ec9f6c',
    '#f1c09c', '#e57a3f', '#c9541f',
    '#ec9f6c', '#c9541f', '#7c2d10',
  ]
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="0" y="0" width="32" height="32" rx="9" fill="var(--logo-bg)" />
      {cells.map((c, i) => (
        <rect key={i} x={6 + (i % 3) * 7.2} y={6 + Math.floor(i / 3) * 7.2} width="5.6" height="5.6" rx="1.6" fill={c} />
      ))}
    </svg>
  )
}
