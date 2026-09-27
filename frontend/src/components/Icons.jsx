/**
 * Icon set — small inline SVGs so the dashboard ships zero icon dependencies.
 * All icons inherit `currentColor` and accept a `className` for sizing/tint.
 */

const base = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function BrainIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M8 4.2a2 2 0 00-2 2 1.6 1.6 0 00-1 2.8A1.8 1.8 0 005 12.4h6" />
      <path d="M8 4.2a2 2 0 012 2 1.6 1.6 0 011 2.8A1.8 1.8 0 0111 12.4H8" />
      <path d="M8 4.2V13" opacity=".55" />
    </svg>
  )
}

export function RadarIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <circle cx="8" cy="8" r="5.6" opacity=".45" />
      <circle cx="8" cy="8" r="2.6" opacity=".75" />
      <path d="M8 8l4-3.2" />
      <circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SparkIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M8 1.8l1.5 3.9 3.9 1.5-3.9 1.5L8 12.6 6.5 8.7 2.6 7.2l3.9-1.5L8 1.8z" />
      <path d="M12.8 11.4l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6.6-1.5z" opacity=".7" />
    </svg>
  )
}

export function HealIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M8 2.2v11.6M2.2 8h11.6" />
      <circle cx="8" cy="8" r="6.4" opacity=".4" />
    </svg>
  )
}

export function CheckIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M3 8.4l3.2 3.2L13 4.8" />
    </svg>
  )
}

export function CrossIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

export function ChevronIcon({ open = false, className = 'h-3 w-3' }) {
  return (
    <svg {...base} className={`${className} transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
      <path d="M6 3.5L10.5 8 6 12.5" />
    </svg>
  )
}

export function FolderIcon({ open = false, className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      {open ? (
        <>
          <path d="M1.8 12.5V4.2c0-.4.3-.7.7-.7h3l1.4 1.6h4.9c.4 0 .7.3.7.7v1" />
          <path d="M1.8 12.5l1.5-6.2c.1-.4.4-.6.8-.6h9.4c.5 0 .9.4.8.9l-1.3 5.9H1.8z" opacity=".75" />
        </>
      ) : (
        <path d="M1.8 12.8V3.9c0-.4.3-.7.7-.7h3.1l1.4 1.7h6.2c.4 0 .7.3.7.7v6.5c0 .4-.3.7-.7.7H2.5a.7.7 0 01-.7-.7z" />
      )}
    </svg>
  )
}

export function FileIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M9 1.8H4.2c-.4 0-.7.3-.7.7v11c0 .4.3.7.7.7h7.6c.4 0 .7-.3.7-.7V5.3L9 1.8z" />
      <path d="M9 1.8v3.5h3.5" opacity=".6" />
    </svg>
  )
}

export function CoinIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8v6.4M6.4 6.6h3.2M6.4 9.4h3.2" opacity=".8" />
    </svg>
  )
}

export function PulseIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M1.5 8h3l1.6-4 2.6 8 1.7-4h4.1" />
    </svg>
  )
}

export function ShieldIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M8 1.6l5 1.9v4.1c0 3.1-2 5.6-5 6.8-3-1.2-5-3.7-5-6.8V3.5l5-1.9z" />
      <path d="M5.9 8.1l1.5 1.5 2.8-3" opacity=".85" />
    </svg>
  )
}

export function LayersIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M8 1.8l6 3-6 3-6-3 6-3z" />
      <path d="M2 8.2l6 3 6-3" opacity=".7" />
      <path d="M2 11.2l6 3 6-3" opacity=".45" />
    </svg>
  )
}

export function AlertIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M8 2.2l6 11H2l6-11z" />
      <path d="M8 6.4v3M8 11.2h.01" />
    </svg>
  )
}

export function TerminalIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <rect x="1.6" y="2.6" width="12.8" height="10.8" rx="1.6" />
      <path d="M4.6 6.4L6.6 8l-2 1.6M8.6 10.2h2.8" />
    </svg>
  )
}

/** Map a narration icon key to its component. */
export const NODE_ICONS = {
  brain: BrainIcon,
  radar: RadarIcon,
  spark: SparkIcon,
  heal: HealIcon,
  check: CheckIcon,
}
