import { useEffect, useMemo, useState } from 'preact/hooks'
import type { CategoryId, PlayerRpRow, RpMeta } from '../lib/types'
import { formatInningsPitched } from '../lib/inningsFormat'
import styles from './RankTable.module.css'

type Props = {
  rows: PlayerRpRow[]
  meta: RpMeta
  status: 'idle' | 'loading' | 'ready' | 'error'
  onPick: (row: PlayerRpRow) => void
}

type SortKey = 'rp' | 'name' | 'team' | 'rrRole' | CategoryId
type SortDir = 'asc' | 'desc'

function fmt(n: number | null, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function renderCategoryValue(id: CategoryId, n: number | null) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (id === 'ERA' || id === 'WHIP' || id === 'XERA' || id === 'XFIP' || id === 'FIP') return n.toFixed(2)
  if (id === 'BABIP') return n.toFixed(3)
  if (id === 'WHIFF') return `${n.toFixed(1)}%`
  if (id === 'IP') return formatInningsPitched(n)
  if (id === 'WPA') return n.toFixed(3)
  if (id === 'LOBP' || id === 'HRFB') {
    const pct = n > 1.5 ? n : n * 100
    return `${pct.toFixed(1)}%`
  }
  if (id === 'K9' || id === 'BB9') return n.toFixed(2)
  return String(Math.round(n))
}

export function RankTable({ rows, meta, status, onPick }: Props) {
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('rp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [pageSize, setPageSize] = useState<10 | 30 | 100>(30)
  const [page, setPage] = useState(1)

  const enabledCats = useMemo(() => meta.cats.filter((c) => c.enabled), [meta.cats])

  const view = useMemo(() => {
    const query = q.trim().toLowerCase()
    const filtered = query
      ? rows.filter((r) => {
          const fullTeam = r.raw.team?.name?.toLowerCase() ?? ''
          return (
            r.name.toLowerCase().includes(query) ||
            r.team.toLowerCase().includes(query) ||
            fullTeam.includes(query) ||
            (r.rrRole?.toLowerCase().includes(query) ?? false)
          )
        })
      : rows

    const dir = sortDir === 'asc' ? 1 : -1
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'rp') return dir * (a.rp - b.rp)
      if (sortKey === 'name') return dir * a.name.localeCompare(b.name)
      if (sortKey === 'team') return dir * a.team.localeCompare(b.team)
      if (sortKey === 'rrRole') return dir * (a.rrRole ?? '').localeCompare(b.rrRole ?? '')
      const av = a.stats[sortKey]
      const bv = b.stats[sortKey]
      const an = av ?? -Infinity
      const bn = bv ?? -Infinity
      return dir * (an - bn)
    })
    return sorted
  }, [q, rows, sortKey, sortDir])

  useEffect(() => {
    setPage(1)
  }, [q, rows, sortKey, sortDir, pageSize])

  const pageCount = Math.ceil(view.length / pageSize)
  const safePage = pageCount === 0 ? 1 : Math.min(page, pageCount)
  const pageStart = (safePage - 1) * pageSize
  const pageEndExclusive = pageStart + pageSize
  const pagedView = pageCount === 0 ? [] : view.slice(pageStart, pageEndExclusive)

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(nextKey)
      setSortDir(nextKey === 'name' || nextKey === 'team' || nextKey === 'rrRole' ? 'asc' : 'desc')
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
        {pagedView.length > 0 ? (
          <div class={styles.pagerBar}>
            <div class={styles.pageSizeGroup}>
              <div class={styles.pageLabel}>Rows</div>
              <select
                class={styles.pageSizeSelect}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.currentTarget.value) as 10 | 30 | 100)}
                aria-label="Rows per page"
              >
                <option value={10}>10</option>
                <option value={30}>30</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div class={styles.pageNav}>
              <button
                class={styles.pageBtn}
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                Prev
              </button>
              <div class={styles.pageInfo}>
                {pageStart + 1}-{Math.min(pageEndExclusive, view.length)} / {view.length}
              </div>
              <button
                class={styles.pageBtn}
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage >= pageCount}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
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
              <th class={styles.thBtn} title="FanGraphs Roster Resource 깊이표 보직(스냅샷)">
                <button class={styles.thButton} onClick={() => toggleSort('rrRole')}>
                  보직
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
                <td class={styles.td} colSpan={5 + enabledCats.length}>
                  Loading…
                </td>
              </tr>
            ) : view.length === 0 ? (
              <tr>
                <td class={styles.td} colSpan={5 + enabledCats.length}>
                  {rows.length === 0 && meta.excludedCount > 0
                    ? 'No relievers matched your filters. Try lowering Min IP / Min Games or increasing Max Starts.'
                    : 'No results.'}
                </td>
              </tr>
            ) : (
              pagedView.map((r, i) => (
                <tr class={styles.tr} key={r.playerId} onClick={() => onPick(r)}>
                  <td class={styles.tdSmall}>{pageStart + i + 1}</td>
                  <td class={styles.tdPlayer}>
                    <div class={styles.playerName}>{r.name}</div>
                  </td>
                  <td class={styles.td}>{r.team || '—'}</td>
                  <td class={styles.td}>{r.rrRole ?? '—'}</td>
                  <td class={styles.tdNum}>{fmt(r.rp, 3)}</td>
                  {enabledCats.map((c) => (
                    <td class={styles.tdNum} key={c.id}>
                      {renderCategoryValue(c.id, r.stats[c.id])}
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

