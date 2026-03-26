import type { CategoryId, PlayerRpRow } from './types'
import { formatInningsPitched } from './inningsFormat'

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
  { key: 'L', label: 'L' },
  { key: 'IP', label: 'IP' },
  { key: 'ERA', label: 'ERA' },
  { key: 'WHIP', label: 'WHIP' },
  { key: 'BB', label: 'BB' },
  { key: 'HR', label: 'HR' },
  { key: 'GIDP', label: 'GIDP' },
  { key: 'RAPP', label: 'RAPP' },
  { key: 'QS', label: 'QS' },
  { key: 'H', label: 'H' },
  { key: 'ER', label: 'ER' },
  { key: 'WHIFF', label: 'Whiff%' },
  { key: 'XERA', label: 'xERA' },
  { key: 'XFIP', label: 'xFIP' },
  { key: 'FIP', label: 'FIP' },
  { key: 'WPA', label: 'WPA' },
  { key: 'LOBP', label: 'LOB%' },
  { key: 'BABIP', label: 'BABIP' },
  { key: 'HRFB', label: 'HR/FB' },
  { key: 'K9', label: 'K/9' },
  { key: 'BB9', label: 'BB/9' },
]

export function exportRowsToCsv(rows: PlayerRpRow[], filename: string) {
  const header = ['Rank', 'Player', 'Team', '보직', '보직 구분', 'RP', ...COLS.map((c) => c.label)].join(',')
  const lines = rows.map((r, idx) => {
    const vals = COLS.map((c) => {
      const v = r.stats[c.key]
      if (v == null) return ''
      if (c.key === 'IP') return formatInningsPitched(v)
      return String(v)
    })
    return [
      String(idx + 1),
      esc(r.name),
      esc(r.team),
      r.rrRole ?? '',
      r.rrType ?? '',
      String(r.rp.toFixed(4)),
      ...vals,
    ].join(',')
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

