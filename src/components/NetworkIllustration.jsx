import React from 'react';

/**
 * Vector illustration for the "Envisioning the Future" section: Pakistan's
 * main cities as glowing hubs, linked by charging routes, with home chargers
 * clustered around each city. Pure SVG, so it stays crisp at any width and
 * costs almost nothing to load. Animations are CSS-driven (see
 * NetworkVisualSection.css) and switch off under prefers-reduced-motion.
 */

const CITIES = [
  { name: 'Peshawar', x: 388, y: 98 },
  { name: 'Islamabad', x: 508, y: 76, major: true },
  { name: 'Lahore', x: 670, y: 170, major: true },
  { name: 'Faisalabad', x: 582, y: 194 },
  { name: 'Multan', x: 510, y: 272 },
  { name: 'Quetta', x: 276, y: 270 },
  { name: 'Hyderabad', x: 388, y: 372 },
  { name: 'Karachi', x: 308, y: 404, major: true },
];

const ROUTES = [
  ['Peshawar', 'Islamabad'],
  ['Islamabad', 'Lahore'],
  ['Islamabad', 'Faisalabad'],
  ['Lahore', 'Faisalabad'],
  ['Faisalabad', 'Multan'],
  ['Multan', 'Hyderabad'],
  ['Hyderabad', 'Karachi'],
  ['Quetta', 'Karachi'],
  ['Quetta', 'Multan'],
];

// Deterministic "home charger" positions around each city.
const CHARGER_OFFSETS = [
  [-38, -22], [34, -30], [46, 14], [-30, 30], [10, 44], [-52, 6], [22, -48],
];

// Labels drawn to the left of their hub so they don't collide with neighbours.
const LEFT_LABELS = new Set(['Karachi', 'Quetta', 'Peshawar']);

const byName = Object.fromEntries(CITIES.map(c => [c.name, c]));

// Gentle curve between two points (control point pushed off the midline).
const curve = (a, b, bend = 0.18) => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
};

const NetworkIllustration = () => (
  <svg
    className="network-illustration"
    viewBox="0 0 960 460"
    role="img"
    aria-labelledby="network-illustration-title"
    preserveAspectRatio="xMidYMid slice"
  >
    <title id="network-illustration-title">
      Map of EV-Net home chargers connecting Pakistan's major cities
    </title>

    <defs>
      <linearGradient id="ni-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0d1424" />
        <stop offset="100%" stopColor="#081019" />
      </linearGradient>
      <radialGradient id="ni-glow" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stopColor="rgba(0,210,106,0.22)" />
        <stop offset="100%" stopColor="rgba(0,210,106,0)" />
      </radialGradient>
      <linearGradient id="ni-route" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#00D26A" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <pattern id="ni-grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
      </pattern>
      <filter id="ni-soft" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>

    <rect width="960" height="460" fill="url(#ni-bg)" />
    <rect width="960" height="460" fill="url(#ni-grid)" />
    <rect width="960" height="460" fill="url(#ni-glow)" />

    {/* Routes: a faint base line plus an animated "energy flow" on top */}
    <g fill="none" strokeLinecap="round">
      {ROUTES.map(([from, to]) => {
        const d = curve(byName[from], byName[to]);
        return (
          <g key={`${from}-${to}`}>
            <path d={d} stroke="rgba(0,210,106,0.18)" strokeWidth="6" />
            <path d={d} stroke="url(#ni-route)" strokeWidth="2" className="ni-flow" />
          </g>
        );
      })}
    </g>

    {/* Home chargers around each city */}
    <g>
      {CITIES.map((city, ci) =>
        CHARGER_OFFSETS.slice(0, city.major ? 7 : 4).map(([dx, dy], i) => (
          <g key={`${city.name}-${i}`} transform={`translate(${city.x + dx} ${city.y + dy})`}>
            <line x1="0" y1="0" x2={-dx * 0.55} y2={-dy * 0.55} stroke="rgba(0,240,255,0.18)" strokeWidth="1" />
            <circle
              r="3.2"
              fill="#00F0FF"
              className="ni-pulse"
              style={{ animationDelay: `${((ci * 7 + i) % 10) * 0.3}s` }}
            />
          </g>
        ))
      )}
    </g>

    {/* City hubs */}
    <g>
      {CITIES.map(city => (
        <g key={city.name} transform={`translate(${city.x} ${city.y})`}>
          <circle r={city.major ? 22 : 16} fill="rgba(0,210,106,0.35)" filter="url(#ni-soft)" />
          <circle r={city.major ? 9 : 7} fill="#0B0F19" stroke="#00D26A" strokeWidth="2.5" />
          <path
            d="M1.2 -4.6 L-2.4 0.6 H0.2 L-1 4.6 L2.6 -0.8 H0 Z"
            fill="#00D26A"
            transform={city.major ? 'scale(1.15)' : 'scale(0.9)'}
          />
          <text
            x={LEFT_LABELS.has(city.name) ? -16 : 16}
            y={city.name === 'Islamabad' ? -16 : 5}
            textAnchor={LEFT_LABELS.has(city.name) ? 'end' : 'start'}
            className={`ni-label ${city.major ? 'is-major' : ''}`}
          >
            {city.name}
          </text>
        </g>
      ))}
    </g>

  </svg>
);

export default NetworkIllustration;
