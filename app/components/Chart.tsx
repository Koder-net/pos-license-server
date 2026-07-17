'use client'

import { useState, useMemo, useRef } from 'react'

/**
 * Dependency-free SVG charts for the admin panel.
 *
 * Every chart here is deliberately SINGLE-SERIES: the panel's two measures
 * (revenue and sale count) have different scales, and a dual-axis chart is
 * never the answer — the second measure rides in the tooltip instead.
 * A single series also means no legend is needed; the title names it.
 *
 * Series color is the validated categorical slot 1 for a dark surface
 * (#3987e5 — passes lightness, chroma and >=3:1 contrast vs the panel surface).
 */

const SERIES = '#3987e5'
const GRID = 'rgba(148,163,184,0.14)'
const AXIS_TEXT = '#94a3b8'

export interface Point {
  label: string
  value: number
  /** Optional secondary measure surfaced only in the tooltip. */
  secondary?: { label: string; value: string }
}

function niceMax(v: number): number {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const norm = v / mag
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * mag
}

// ─── Area / line trend ────────────────────────────────────────────────────────

export function AreaTrend({
  data,
  height = 180,
  format = (v: number) => String(v),
  axisFormat,
}: {
  data: Point[]
  height?: number
  /** Full-precision formatter used in the tooltip. */
  format?: (v: number) => string
  /** Compact formatter for axis ticks; falls back to `format`. */
  axisFormat?: (v: number) => string
}) {
  const tick = axisFormat ?? format
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)

  const W = 800
  const H = height
  const padL = 52
  const padR = 12
  const padT = 12
  const padB = 24

  const max = useMemo(() => niceMax(Math.max(...data.map((d) => d.value), 0)), [data])

  if (data.length === 0) {
    return <p className="text-gray-600 text-sm text-center py-12">No data yet.</p>
  }

  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const x = (i: number) => padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
  const y = (v: number) => padT + plotH - (v / max) * plotH

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.value)}`).join(' ')
  const area = `${line} L ${x(data.length - 1)} ${padT + plotH} L ${x(0)} ${padT + plotH} Z`

  const handleMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const relX = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((relX - padL) / plotW) * (data.length - 1))
    setHover(i >= 0 && i < data.length ? i : null)
  }

  const ticks = [0, 0.5, 1].map((f) => max * f)
  // Thin out x labels so they never collide on dense ranges.
  const labelEvery = Math.ceil(data.length / 8)

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fill={AXIS_TEXT} fontSize={11}>
              {tick(t)}
            </text>
          </g>
        ))}

        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES} stopOpacity={0.28} />
            <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
          </linearGradient>
        </defs>

        <path d={area} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d.label} x={x(i)} y={H - 6} textAnchor="middle" fill={AXIS_TEXT} fontSize={10}>
              {d.label}
            </text>
          ) : null
        )}

        {hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padT}
              y2={padT + plotH}
              stroke={AXIS_TEXT}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {/* 2px surface ring keeps the marker legible over the line */}
            <circle cx={x(hover)} cy={y(data[hover].value)} r={5} fill={SERIES} stroke="#0b1220" strokeWidth={2} />
          </g>
        )}
      </svg>

      {hover !== null && (
        <div
          className="absolute pointer-events-none bg-gray-950 ring-1 ring-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -8px)',
          }}
        >
          <p className="text-gray-400">{data[hover].label}</p>
          <p className="text-white font-semibold tabular-nums">{format(data[hover].value)}</p>
          {data[hover].secondary && (
            <p className="text-gray-400 tabular-nums">
              {data[hover].secondary!.label}: {data[hover].secondary!.value}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Horizontal bars (categorical) ────────────────────────────────────────────

export function BarList({
  data,
  format = (v: number) => String(v),
}: {
  data: Point[]
  format?: (v: number) => string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)

  if (data.length === 0) {
    return <p className="text-gray-600 text-sm text-center py-8">No data yet.</p>
  }

  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="group">
          <div className="flex items-baseline justify-between text-xs mb-1">
            <span className="text-gray-300 truncate">{d.label}</span>
            {/* Direct label — identity is never carried by color alone */}
            <span className="text-gray-400 tabular-nums shrink-0 ml-2">{format(d.value)}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all group-hover:opacity-80"
              style={{ width: `${(d.value / max) * 100}%`, background: SERIES }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
