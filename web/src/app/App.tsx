import { useEffect, useMemo, useState } from 'preact/hooks'
import { fetchSeasonPitchingStats } from '../lib/mlbApi'
import { getSavantPitcherMetricsMap, type SavantPitcherMetrics } from '../lib/savantPitcherData'
import { getFangraphsXfipMap, type FangraphsPitcherFields } from '../lib/fangraphsXfipData'
import {
  getRosterResourceRolesMap,
  mergeRpRowWithDepthSnapshot,
  type RosterResourceRolesRes,
} from '../lib/rosterResourceRoles'
import type { CategoryConfig, PlayerRpRow, RpConfig } from '../lib/types'
import { DEFAULT_CATEGORIES, DEFAULT_RP_CONFIG, buildRows, computeRp } from '../lib/rp'
import { SettingsPanel } from '../components/SettingsPanel'
import { RankTable } from '../components/RankTable'
import { PlayerDrawer } from '../components/PlayerDrawer'
import { DepthChartsPage } from '../components/DepthChartsPage'
import { exportRowsToCsv } from '../lib/export'
import { clearDataCaches } from '../lib/savantPitcherData'
import styles from './App.module.css'

function readRoute(): string {
  if (typeof window === 'undefined') return '/'
  const h = window.location.hash.replace(/^#/, '')
  if (!h || h === '/') return '/'
  return h.startsWith('/') ? h : `/${h}`
}

type LoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready' }

const CACHE_KEY = 'bullpen-rp:v1'

function AppNav({ route }: { route: string }) {
  return (
    <nav class={styles.navRow} aria-label="페이지 이동">
      <a
        href="#/"
        class={route === '/' ? styles.navActive : styles.navLink}
        aria-current={route === '/' ? 'page' : undefined}
      >
        RP 랭킹
      </a>
      <span class={styles.navSep} aria-hidden>
        ·
      </span>
      <a
        href="#/depth"
        class={route.startsWith('/depth') ? styles.navActive : styles.navLink}
        aria-current={route.startsWith('/depth') ? 'page' : undefined}
      >
        30팀 뎁스
      </a>
    </nav>
  )
}

export function App() {
  const [route, setRoute] = useState<string>(() => readRoute())

  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    setRoute(readRoute())
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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
  const [rosterResource, setRosterResource] = useState<RosterResourceRolesRes | null>(null)
  const [selected, setSelected] = useState<PlayerRpRow | null>(null)
  /** 일 캐시를 건너뛰고 MLB·정적 JSON·Savant·FG를 다시 받기 위한 키 */
  const [dataRefreshKey, setDataRefreshKey] = useState(0)

  useEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cfg))
  }, [cfg])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setState({ status: 'loading' })
      setSavantByPlayerId(null)
      setFangraphsByPlayerId(null)
      setRosterResource(null)
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
          setRosterResource(rrRes)
        } catch {
          if (cancelled) return
          setRosterResource(null)
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
  }, [cfg.season, dataRefreshKey])

  function handleForceDataRefresh() {
    clearDataCaches()
    setDataRefreshKey((k) => k + 1)
  }

  const rows = useMemo(() => {
    if (!raw) return []
    const base = buildRows(raw.splits)
    const rrOk = rosterResource?.ok === true
    const byId = rrOk ? rosterResource.byPlayerId : {}
    const depth = rrOk ? rosterResource.depthByTeam : null

    return base.map((r) => {
      let r2 = mergeRpRowWithDepthSnapshot(r, byId, depth)

      const m = savantByPlayerId ? savantByPlayerId[String(r.playerId)] : undefined
      const f = fangraphsByPlayerId ? fangraphsByPlayerId[String(r.playerId)] : undefined
      if (!m && !f) return r2

      const nextStats = { ...r2.stats }
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
        ...r2,
        stats: nextStats,
      }
    })
  }, [raw, savantByPlayerId, fangraphsByPlayerId, rosterResource])

  const rp = useMemo(() => {
    return computeRp(rows, cfg, cats)
  }, [rows, cfg, cats])

  const headerRightRank = (
    <div class={styles.headerRight}>
      <button
        class={styles.ghostButton}
        type="button"
        onClick={handleForceDataRefresh}
        disabled={state.status === 'loading'}
        aria-label="캐시를 비우고 스탯·보직·30팀 뎁스 JSON을 다시 불러오기"
      >
        Fetch
      </button>
      <button
        class={styles.ghostButton}
        onClick={() => exportRowsToCsv(rp.rows, `bullpen_rp_${cfg.season}.csv`)}
        disabled={rp.rows.length === 0}
      >
        Export CSV
      </button>
    </div>
  )

  if (route.startsWith('/depth')) {
    return (
      <div class={styles.page}>
        <header class={styles.header}>
          <div>
            <div class={styles.title}>판타지 베이스볼 불펜 구하기</div>
            <AppNav route={route} />
          </div>
          <div class={styles.headerRight}>
            <button
              class={styles.ghostButton}
              type="button"
              onClick={handleForceDataRefresh}
              disabled={state.status === 'loading'}
              aria-label="캐시를 비우고 스탯·보직·30팀 뎁스 JSON을 다시 불러오기"
            >
              Fetch
            </button>
          </div>
        </header>
        <DepthChartsPage refreshKey={dataRefreshKey} />
      </div>
    )
  }

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <div>
          <div class={styles.title}>판타지 베이스볼 불펜 구하기</div>
          <AppNav route={route} />
        </div>
        {headerRightRank}
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

