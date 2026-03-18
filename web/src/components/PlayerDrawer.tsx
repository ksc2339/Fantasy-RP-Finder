import type { CategoryId, PlayerRpRow, RpMeta } from '../lib/types'
import styles from './PlayerDrawer.module.css'

type Props = {
  row: PlayerRpRow | null
  onClose: () => void
  rpMeta: RpMeta
}

function fmt(n: number | null, digits = 3) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function fmtStat(id: CategoryId, n: number | null) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (id === 'ERA' || id === 'WHIP') return n.toFixed(2)
  if (id === 'IP') return n.toFixed(1)
  if (id === 'K9' || id === 'BB9') return n.toFixed(2)
  return String(Math.round(n))
}

export function PlayerDrawer({ row, onClose, rpMeta }: Props) {
  const open = !!row
  const enabled = rpMeta.cats.filter((c) => c.enabled && c.weight !== 0)

  return (
    <div class={styles.backdrop} data-open={open ? 'true' : 'false'} onClick={onClose}>
      <aside class={styles.drawer} onClick={(e) => e.stopPropagation()} aria-hidden={!open}>
        {!row ? null : (
          <>
            <div class={styles.header}>
              <div>
                <div class={styles.name}>{row.name}</div>
                <div class={styles.team}>{row.team || '—'}</div>
              </div>
              <button class={styles.close} onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>

            <div class={styles.summary}>
              <div class={styles.rp}>
                <div class={styles.rpLabel}>RP</div>
                <div class={styles.rpValue}>{fmt(row.rp, 4)}</div>
              </div>
              <div class={styles.filters}>
                Season: {rpMeta.cfg.season} • Min IP: {rpMeta.cfg.minIP} • Max Starts: {rpMeta.cfg.maxStarts}
              </div>
            </div>

            <div class={styles.sectionTitle}>Category breakdown</div>
            <div class={styles.tableWrap}>
              <table class={styles.table}>
                <thead>
                  <tr>
                    <th>Cat</th>
                    <th class={styles.num}>Value</th>
                    <th class={styles.num}>z</th>
                    <th class={styles.num}>weight</th>
                    <th class={styles.num}>contrib</th>
                  </tr>
                </thead>
                <tbody>
                  {enabled.map((c) => (
                    <tr key={c.id}>
                      <td>{c.label}</td>
                      <td class={styles.num}>{fmtStat(c.id, row.stats[c.id])}</td>
                      <td class={styles.num}>{fmt(row.z[c.id], 3)}</td>
                      <td class={styles.num}>{c.weight.toFixed(2)}</td>
                      <td class={styles.num}>{fmt(row.contrib[c.id], 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div class={styles.sectionTitle}>Raw stats (selected fields)</div>
            <div class={styles.pills}>
              {(['SV', 'HLD', 'SVH', 'NSVH', 'K', 'W', 'IP', 'ERA', 'WHIP', 'K9', 'BB9'] as CategoryId[]).map((id) => (
                <div class={styles.pill} key={id}>
                  <div class={styles.pillK}>{id}</div>
                  <div class={styles.pillV}>{fmtStat(id, row.stats[id])}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

