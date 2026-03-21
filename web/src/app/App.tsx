import { useEffect, useMemo, useState } from 'preact/hooks'
import { fetchSeasonPitchingStats } from '../lib/mlbApi'
import { getSavantPitcherMetricsMap, type SavantPitcherMetrics } from '../lib/savantPitcherData'
import { getFangraphsXfipMap, type FangraphsPitcherFields } from '../lib/fangraphsXfipData'
import { getRosterResourceRolesMap, type RosterResourcePitcherFields } from '../lib/rosterResourceRoles'
import type { CategoryConfig, PlayerRpRow, RpConfig } from '../lib/types'
import { DEFAULT_CATEGORIES, DEFAULT_RP_CONFIG, buildRows, computeRp } from '../lib/rp'
import { SettingsPanel } from '../components/SettingsPanel'
import { RankTable } from '../components/RankTable'
import { PlayerDrawer } from '../components/PlayerDrawer'
import { exportRowsToCsv } from '../lib/export'
import styles from './App.module.css'

type LoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready' }

const CACHE_KEY = 'bullpen-rp:v1'

export function App() {
  const [cfg, setCfg] = useState<RpConfig>(() => {
    const saved = localStorage.getItem(CACHE_KEY)
    if (!saved) return DEFAULT_RP_CONFIG
    try {
      return { ...DEFAULT_RP_CONFIG, ...(JSON.parse(saved) as Partial<RpConfig>) }
    } catch {
      return DEFAULT_RP_CONFIG
    }
  })
  const [cats, setCats] = useState<CategoryConfig[]>(() => DEFAULT_CATEGORIES)
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [raw, setRaw] = useState<Awaited<ReturnType<typeof fetchSeasonPitchingStats>> | null>(null)
  const [savantByPlayerId, setSavantByPlayerId] = useState<Record<string, SavantPitcherMetrics> | null>(null)
  const [fangraphsByPlayerId, setFangraphsByPlayerId] = useState<Record<string, FangraphsPitcherFields> | null>(null)
  const [rosterResourceByPlayerId, setRosterResourceByPlayerId] = useState<
    Record<string, RosterResourcePitcherFields> | null
  >(null)
  const [selected, setSelected] = useState<PlayerRpRow | null>(null)

  useEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cfg))
  }, [cfg])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setState({ status: 'loading' })
      setSavantByPlayerId(null)
      setFangraphsByPlayerId(null)
      setRosterResourceByPlayerId(null)
      try {
        const res = await fetchSeasonPitchingStats({ season: cfg.season })
        if (cancelled) return
        setRaw(res)

        // Savant stats are baked at deploy; we load the season-wide map once.
        try {
          const mapRes = await getSavantPitcherMetricsMap(cfg.season)
          if (cancelled) return
          setSavantByPlayerId(mapRes.byPlayerId)
        } catch {
          if (cancelled) return
          setSavantByPlayerId(null)
        }

        // FanGraphs xFIP is scraped (sparse) at deploy time.
        try {
          const xfipRes = await getFangraphsXfipMap(cfg.season)
          if (cancelled) return
          setFangraphsByPlayerId(xfipRes.byPlayerId)
        } catch {
          if (cancelled) return
          setFangraphsByPlayerId(null)
        }

        try {
          const rrRes = await getRosterResourceRolesMap()
          if (cancelled) return
          setRosterResourceByPlayerId(rrRes.byPlayerId)
        } catch {
          if (cancelled) return
          setRosterResourceByPlayerId(null)
        }

        setState({ status: 'ready' })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        if (!cancelled) setState({ status: 'error', message: msg })
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [cfg.season])

  const rows = useMemo(() => {
    if (!raw) return []
    const base = buildRows(raw.splits)
    if (!savantByPlayerId && !fangraphsByPlayerId && !rosterResourceByPlayerId) return base

    // Inject Savant values so they can be used as z-score categories.
    return base.map((r) => {
      const m = savantByPlayerId ? savantByPlayerId[String(r.playerId)] : undefined
      const f = fangraphsByPlayerId ? fangraphsByPlayerId[String(r.playerId)] : undefined
      const rr = rosterResourceByPlayerId ? rosterResourceByPlayerId[String(r.playerId)] : undefined
      if (!m && !f && !rr) return r

      const nextStats = { ...r.stats }
      if (m) {
        nextStats.WHIFF = m.whiffPct
        nextStats.XERA = m.xera
      }
      if (f) {
        nextStats.XFIP = f.xFIP
        nextStats.FIP = f.FIP
        nextStats.WPA = f.WPA
        nextStats.LOBP = f.LOBP
        nextStats.HRFB = f.HRFB ?? null
        nextStats.QS = f.QS ?? null
      } else {
        nextStats.XFIP = m?.xfip ?? null
      }
      return {
        ...r,
        stats: nextStats,
        ...(rr
          ? {
              rrRole: rr.rrRole,
              rrType: rr.rrType,
              rrPosition1: rr.position1,
            }
          : {}),
      }
    })
  }, [raw, savantByPlayerId, fangraphsByPlayerId, rosterResourceByPlayerId])

  const rp = useMemo(() => {
    return computeRp(rows, cfg, cats)
  }, [rows, cfg, cats])

  const headerRight = (
    <div class={styles.headerRight}>
      <button
        class={styles.ghostButton}
        onClick={() => exportRowsToCsv(rp.rows, `bullpen_rp_${cfg.season}.csv`)}
        disabled={rp.rows.length === 0}
      >
        Export CSV
      </button>
    </div>
  )

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <div>
          <div class={styles.title}>판타지 베이스볼 불펜 구하기</div>
        </div>
        {headerRight}
      </header>

      <main class={styles.main}>
        <section class={styles.panel}>
          <SettingsPanel
            cfg={cfg}
            setCfg={setCfg}
            categories={cats}
            setCategories={setCats}
            status={state.status}
            lastUpdated={raw?.fetchedAt ?? null}
          />
        </section>

        <section class={styles.content}>
          {state.status === 'error' ? (
            <div class={styles.card}>
              <div class={styles.cardTitle}>Load failed</div>
              <div class={styles.cardBody}>{state.message}</div>
            </div>
          ) : (
            <RankTable
              rows={rp.rows}
              meta={rp.meta}
              onPick={(r) => setSelected(r)}
              status={state.status}
            />
          )}
        </section>
      </main>

      <footer class={styles.footer}>
        스탯 출처: MLB Stats API • FanGraphs • FanGraphs Roster Resource • Baseball Savant
      </footer>

      <PlayerDrawer row={selected} onClose={() => setSelected(null)} rpMeta={rp.meta} />
    </div>
  )
}

