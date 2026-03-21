import type { CategoryId, PlayerRpRow, RpMeta } from '../lib/types'
import { useEffect, useState } from 'preact/hooks'
import { mlbHeadshotUrl } from '../lib/mlbImages'
import { getSavantPitcherMetrics } from '../lib/savantPitcherData'
import { fetchPlayerPitchHandAndAge } from '../lib/mlbApi'
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
  if (id === 'ERA' || id === 'WHIP' || id === 'XERA' || id === 'XFIP' || id === 'FIP') return n.toFixed(2)
  if (id === 'BABIP') return n.toFixed(3)
  if (id === 'IP') return n.toFixed(1)
  if (id === 'WHIFF') return n.toFixed(1)
  if (id === 'LOBP' || id === 'HRFB') {
    // FanGraphs LOB% / HR/FB may arrive as ratio or percent-style number.
    const pct = n > 1.5 ? n : n * 100
    return `${pct.toFixed(1)}%`
  }
  if (id === 'WPA') return n.toFixed(3)
  if (id === 'K9' || id === 'BB9') return n.toFixed(2)
  return String(Math.round(n))
}

function fmtPitchHand(code: string | null) {
  if (!code) return '—'
  if (code === 'L') return 'L (좌)'
  if (code === 'R') return 'R (우)'
  return code
}

function fmtRrType(t: string | null) {
  if (!t) return ''
  if (t === 'mlb-sp' || t === 'mlb-bp') return 'MLB'
  if (t.startsWith('il-')) return 'IL'
  if (t.startsWith('off-')) return 'Minors/대기'
  return t
}

export function PlayerDrawer({ row, onClose, rpMeta }: Props) {
  const open = !!row
  const enabled = rpMeta.cats.filter((c) => c.enabled && c.weight !== 0)
  const filmRoomQuery = encodeURIComponent(row?.name ?? '').replace(/%20/g, '+')
  const [savant, setSavant] = useState<{
    whiffPct: number | null
    xera: number | null
    xfip: number | null
  } | null>(null)
  const [savantStatus, setSavantStatus] = useState<'idle' | 'loading' | 'ready'>('idle')

  const [person, setPerson] = useState<{ age: number | null; pitchHand: string | null } | null>(null)
  const [personStatus, setPersonStatus] = useState<'idle' | 'loading' | 'ready'>('idle')

  useEffect(() => {
    if (!row) {
      setSavant(null)
      setSavantStatus('idle')
      return
    }
    const ac = new AbortController()
    setSavantStatus('loading')
    getSavantPitcherMetrics(rpMeta.cfg.season, row.playerId, ac.signal)
      .then((res) => {
        setSavant(res.metrics)
        setSavantStatus('ready')
      })
      .catch(() => {
        setSavant(null)
        setSavantStatus('ready')
      })
    return () => ac.abort()
  }, [row?.playerId, rpMeta.cfg.season])

  useEffect(() => {
    if (!row) {
      setPerson(null)
      setPersonStatus('idle')
      return
    }
    const ac = new AbortController()
    setPersonStatus('loading')
    fetchPlayerPitchHandAndAge({ playerId: row.playerId, signal: ac.signal })
      .then((res) => {
        setPerson({ age: res.age ?? row.age ?? null, pitchHand: res.pitchHand ?? row.pitchHand ?? null })
        setPersonStatus('ready')
      })
      .catch(() => {
        setPerson({ age: row.age ?? null, pitchHand: row.pitchHand ?? null })
        setPersonStatus('ready')
      })
    return () => ac.abort()
  }, [row?.playerId])

  const ageToShow = person?.age ?? row?.age ?? null
  const pitchHandToShow = person?.pitchHand ?? row?.pitchHand ?? null

  const ageText = personStatus === 'loading' && ageToShow == null ? '…' : ageToShow == null ? '—' : String(ageToShow)
  const throwsText =
    personStatus === 'loading' && pitchHandToShow == null ? '…' : fmtPitchHand(pitchHandToShow)

  return (
    <div class={styles.backdrop} data-open={open ? 'true' : 'false'} onClick={onClose}>
      <aside class={styles.drawer} onClick={(e) => e.stopPropagation()} aria-hidden={!open}>
        {!row ? null : (
          <>
            <div class={styles.header}>
              <div class={styles.headerLeft}>
                <img
                  class={styles.headshot}
                  src={mlbHeadshotUrl(row.playerId, 120)}
                  srcSet={`${mlbHeadshotUrl(row.playerId, 120)} 1x, ${mlbHeadshotUrl(row.playerId, 360)} 2x`}
                  width={60}
                  height={60}
                  loading="lazy"
                  alt={`${row.name} headshot`}
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
                <div class={styles.name}>{row.name}</div>
                <div class={styles.team}>{row.team || '—'}</div>
                <div
                  class={styles.rrLine}
                  title="FanGraphs Roster Resource 깊이표 보직(스냅샷)"
                >
                  보직: {row.rrRole ?? '—'}
                  {row.rrType ? ` · ${fmtRrType(row.rrType)}` : ''}
                  {row.rrPosition1 ? ` · ${row.rrPosition1}` : ''}
                </div>
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
                <span> • Age: {ageText} • Throws: {throwsText}</span>
              </div>
            </div>

            <div class={styles.externalLinks}>
              <a
                class={styles.extButton}
                href={`https://baseballsavant.mlb.com/savant-player/${row.playerId}`}
                target="_blank"
                rel="noreferrer"
              >
                Baseball Savant
              </a>
              <a
                class={styles.extButton}
                href={`https://www.mlb.com/video/?q=${filmRoomQuery}&qt=FREETEXT`}
                target="_blank"
                rel="noreferrer"
              >
                MLB Film Room
              </a>
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

            <div class={styles.sectionTitle}>Savant (baked at deploy)</div>
            <div class={styles.pills}>
              <div class={styles.pill}>
                <div class={styles.pillK}>Whiff%</div>
                <div class={styles.pillV}>
                  {savantStatus === 'loading'
                    ? '…'
                    : savant?.whiffPct == null
                      ? '—'
                      : `${savant.whiffPct.toFixed(1)}%`}
                </div>
              </div>
              <div class={styles.pill}>
                <div class={styles.pillK}>xERA</div>
                <div class={styles.pillV}>
                  {savantStatus === 'loading' ? '…' : fmt(savant?.xera ?? null, 2)}
                </div>
              </div>
              <div class={styles.pill}>
                <div class={styles.pillK}>xFIP</div>
                <div class={styles.pillV}>
                  {savantStatus === 'loading' ? '…' : fmtStat('XFIP', row.stats.XFIP)}
                </div>
              </div>
              <div class={styles.pill}>
                <div class={styles.pillK}>FIP</div>
                <div class={styles.pillV}>{fmtStat('FIP', row.stats.FIP)}</div>
              </div>
              <div class={styles.pill}>
                <div class={styles.pillK}>WPA</div>
                <div class={styles.pillV}>{fmtStat('WPA', row.stats.WPA)}</div>
              </div>
              <div class={styles.pill}>
                <div class={styles.pillK}>LOB%</div>
                <div class={styles.pillV}>{fmtStat('LOBP', row.stats.LOBP)}</div>
              </div>
              <div class={styles.pill}>
                <div class={styles.pillK}>HR/FB</div>
                <div class={styles.pillV}>{fmtStat('HRFB', row.stats.HRFB)}</div>
              </div>
              {(
                [
                  'SV',
                  'HLD',
                  'SVH',
                  'NSVH',
                  'K',
                  'W',
                  'L',
                  'IP',
                  'ERA',
                  'WHIP',
                  'BB',
                  'HR',
                  'GIDP',
                  'RAPP',
                  'QS',
                  'H',
                  'ER',
                  'BABIP',
                  'K9',
                  'BB9',
                ] as CategoryId[]
              ).map((id) => (
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

