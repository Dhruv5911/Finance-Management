// Chart.js can't read CSS variables directly, so mirror the tokens here.
export const PALETTE = ['#f2571d', '#17a35a', '#3b82f6', '#e5484d', '#a855f7', '#f59e0b', '#14b8a6', '#ec4899', '#84cc16', '#6366f1']

const LIGHT = { grid: '#eef0f4', tick: '#9097a3', legend: '#5f6570', income: '#17a35a', expense: '#f2571d', blue: '#3b82f6' }
const DARK = { grid: '#23232b', tick: '#5c5c70', legend: '#9898a8', income: '#3ecf8e', expense: '#f2571d', blue: '#60a5fa' }

export function chartColors(theme) {
  return theme === 'dark' ? DARK : LIGHT
}

export function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
