import type { CategoryId, PlayerRpRow } from './types'

function esc(x: string) {
  if (x.includes('"') || x.includes(',') || x.includes('\n')) return `"${x.replaceAll('"', '""')}"`
  return x
}

const COLS: { key: CategoryId; label: string }[] = [
  { key: 'SV', label: 'SV' },
  { key: 'HLD', label: 'HLD' },
  { key: 'SVH', label: 'SV+H' },
  { key: 'NSVH', label: 'NSVH' },
  { key: 'K', label: 'K' },
  { key: 'W', label: 'W' },
  { key: 'IP', label: 'IP' },
  { key: 'ERA', label: 'ERA' },
  { key: 'WHIP', label: 'WHIP' },
  { key: 'WHIFF', label: 'Whiff%' },
  { key: 'XERA', label: 'xERA' },
  { key: 'XFIP', label: 'xFIP' },
  { key: 'FIP', label: 'FIP' },
  { key: 'WPA', label: 'WPA' },
  { key: 'LOBP', label: 'LOB%' },
  { key: 'K9', label: 'K/9' },
  { key: 'BB9', label: 'BB/9' },
]

export function exportRowsToCsv(rows: PlayerRpRow[], filename: string) {
  const header = ['Rank', 'Player', 'Team', 'RP', ...COLS.map((c) => c.label)].join(',')
  const lines = rows.map((r, idx) => {
    const vals = COLS.map((c) => {
      const v = r.stats[c.key]
      return v == null ? '' : String(v)
    })
    return [String(idx + 1), esc(r.name), esc(r.team), String(r.rp.toFixed(4)), ...vals].join(',')
  })
  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

