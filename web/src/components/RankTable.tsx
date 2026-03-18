import { useMemo, useState } from 'preact/hooks'
import type { CategoryId, PlayerRpRow, RpMeta } from '../lib/types'
import styles from './RankTable.module.css'

type Props = {
  rows: PlayerRpRow[]
  meta: RpMeta
  status: 'idle' | 'loading' | 'ready' | 'error'
  onPick: (row: PlayerRpRow) => void
}

type SortKey = 'rp' | 'name' | 'team' | CategoryId
type SortDir = 'asc' | 'desc'

function fmt(n: number | null, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

export function RankTable({ rows, meta, status, onPick }: Props) {
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('rp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const enabledCats = useMemo(() => meta.cats.filter((c) => c.enabled && c.weight !== 0), [meta.cats])

  const view = useMemo(() => {
    const query = q.trim().toLowerCase()
    const filtered = query
      ? rows.filter((r) => r.name.toLowerCase().includes(query) || r.team.toLowerCase().includes(query))
      : rows

    const dir = sortDir === 'asc' ? 1 : -1
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'rp') return dir * (a.rp - b.rp)
      if (sortKey === 'name') return dir * a.name.localeCompare(b.name)
      if (sortKey === 'team') return dir * a.team.localeCompare(b.team)
      const av = a.stats[sortKey]
      const bv = b.stats[sortKey]
      const an = av ?? -Infinity
      const bn = bv ?? -Infinity
      return dir * (an - bn)
    })
    return sorted
  }, [q, rows, sortKey, sortDir])

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(nextKey)
      setSortDir(nextKey === 'name' || nextKey === 'team' ? 'asc' : 'desc')
    }
  }

  return (
    <div class={styles.wrap}>
      <div class={styles.toolbar}>
        <div class={styles.metrics}>
          <div class={styles.metric}>
            <div class={styles.metricLabel}>Included</div>
            <div class={styles.metricValue}>{meta.includedCount}</div>
          </div>
          <div class={styles.metric}>
            <div class={styles.metricLabel}>Excluded</div>
            <div class={styles.metricValue}>{meta.excludedCount}</div>
          </div>
        </div>

        <input
          class={styles.search}
          placeholder="Search player or team…"
          value={q}
          onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
        />
      </div>

      <div class={styles.tableWrap}>
        <table class={styles.table}>
          <thead>
            <tr>
              <th class={styles.thSmall}>#</th>
              <th class={styles.thBtn}>
                <button class={styles.thButton} onClick={() => toggleSort('name')}>
                  Player
                </button>
              </th>
              <th class={styles.thBtn}>
                <button class={styles.thButton} onClick={() => toggleSort('team')}>
                  Team
                </button>
              </th>
              <th class={styles.thBtn}>
                <button class={styles.thButton} onClick={() => toggleSort('rp')}>
                  RP
                </button>
              </th>
              {enabledCats.map((c) => (
                <th class={styles.thBtn} key={c.id}>
                  <button class={styles.thButton} onClick={() => toggleSort(c.id)}>
                    {c.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {status === 'loading' && rows.length === 0 ? (
              <tr>
                <td class={styles.td} colSpan={4 + enabledCats.length}>
                  Loading…
                </td>
              </tr>
            ) : view.length === 0 ? (
              <tr>
                <td class={styles.td} colSpan={4 + enabledCats.length}>
                  No results.
                </td>
              </tr>
            ) : (
              view.map((r, i) => (
                <tr class={styles.tr} key={r.playerId} onClick={() => onPick(r)}>
                  <td class={styles.tdSmall}>{i + 1}</td>
                  <td class={styles.tdPlayer}>
                    <div class={styles.playerName}>{r.name}</div>
                  </td>
                  <td class={styles.td}>{r.team || '—'}</td>
                  <td class={styles.tdNum}>{fmt(r.rp, 3)}</td>
                  {enabledCats.map((c) => (
                    <td class={styles.tdNum} key={c.id}>
                      {fmt(r.stats[c.id], c.id === 'ERA' || c.id === 'WHIP' ? 2 : 0)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div class={styles.hint}>
        Tip: click a row to see z-score contributions per category.
      </div>
    </div>
  )
}

