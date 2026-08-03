import React from 'react'

/* ============================================================
   COMPONENTES BASE
   ============================================================ */

export function Header({ subtitle }) {
  return (
    <header className="px-6 pt-5 pb-3">
      <p className="font-display text-lg text-teal-700 tracking-tight">
        Mi Cocina
      </p>
      {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
    </header>
  )
}

export function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-terracotta-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="card p-8 text-center mt-4">
      <p className="font-display text-xl text-ink-900 mb-2">{title}</p>
      {hint && <p className="text-sm text-ink-500">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Field({ label, required, children, hint }) {
  return (
    <label className="block">
      <span className="label-caps text-ink-500 mb-1.5 block">
        {label} {required && <span className="text-terracotta-500">*</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-ink-500 mt-1 block">{hint}</span>}
    </label>
  )
}

/* Hoja modal que sube desde abajo. Cabecera fija con acciones. */
export function Sheet({ title, onClose, onCloseLabel = 'Cerrar', action, children, tall }) {
  return (
    <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div
        className={`bg-cream-50 w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-y-auto safe-bottom ${
          tall ? 'h-[92vh] sm:h-auto sm:max-h-[92vh]' : 'max-h-[92vh]'
        }`}
      >
        <div className="sticky top-0 z-10 bg-cream-50 border-b border-cream-200 px-5 py-4 flex items-center justify-between gap-2">
          <button onClick={onClose} className="text-ink-500 text-sm font-medium shrink-0">
            {onCloseLabel}
          </button>
          <p className="font-display text-base text-ink-900 text-center flex-1 truncate">
            {title}
          </p>
          <div className="shrink-0 min-w-[3rem] text-right">{action}</div>
        </div>
        {children}
      </div>
    </div>
  )
}

/* Píldora de filtro / chip seleccionable */
export function Chip({ active, onClick, children, tone = 'terracotta' }) {
  const activeCls =
    tone === 'teal'
      ? 'bg-teal-600 text-cream-50'
      : 'bg-terracotta-500 text-cream-50'
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active ? activeCls : 'bg-cream-200 text-ink-700 active:bg-cream-300'
      }`}
    >
      {children}
    </button>
  )
}

/* Etiqueta pequeña informativa */
export function Tag({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-cream-200 text-ink-700',
    teal: 'bg-teal-50 text-teal-700',
    warn: 'bg-terracotta-50 text-terracotta-700',
    soft: 'bg-sage-100 text-sage-700',
  }
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  )
}

/* ============================================================
   ICONOS
   ============================================================ */

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconToday() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
    </svg>
  )
}
export function IconWeek() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9h18M8 2v4M16 2v4M8 13h8M8 17h5" />
    </svg>
  )
}
export function IconStats() {
  return (
    <svg {...iconProps}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}
export function IconHistory() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
export function IconImport() {
  return (
    <svg {...iconProps}>
      <path d="M12 3v13M7 11l5 5 5-5M5 21h14" />
    </svg>
  )
}
export function IconRecipes() {
  return (
    <svg {...iconProps}>
      <path d="M5 4h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M9 4v3M8 11h8M8 15h6" />
    </svg>
  )
}
export function IconShopping() {
  return (
    <svg {...iconProps}>
      <path d="M5 8h14l-1.5 10.5a2 2 0 0 1-2 1.5h-7a2 2 0 0 1-2-1.5L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}
export function IconPlanner() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M8 2v4M16 2v4M3 9h18" />
      <path d="M12 12v6M9 15h6" />
    </svg>
  )
}
export function IconMore() {
  return (
    <svg {...iconProps}>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" />
    </svg>
  )
}
