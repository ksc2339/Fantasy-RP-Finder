import { useEffect, useMemo, useState } from 'preact/hooks'
import { fetchMlbFullNamesByPlayerIds, fetchSeasonPitchingStats } from '../lib/mlbApi'
import { getSavantPitcherMetricsMap, type SavantPitcherMetrics } from '../lib/savantPitcherData'
import { getFangraphsXfipMap, type FangraphsPitcherFields } from '../lib/fangraphsXfipData'
import {
  getOopsyPitcherMap,
  mergeOopsyIntoStats,
  type OopsyPitcherFields,
} from '../lib/oopsyProjectionsData'
import {
  getRosterResourceRolesMap,
  mergeRpRowWithDepthSnapshot,
  type RosterResourceRolesRes,
} from '../lib/rosterResourceRoles'
import type { CategoryConfig, PlayerRow, PlayerRpRow, RpConfig } from '../lib/types'
import {
  DEFAULT_CATEGORIES,
  DEFAULT_RP_CONFIG,
  MIN_SUPPORTED_SEASON,
  PROJECTION_SEASON,
  buildOopsySupplementPlayerRows,
  buildRows,
  computeRp,
} from '../lib/rp'
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
        팀별 뎁스 차트
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
      const p = { ...DEFAULT_RP_CONFIG, ...(JSON.parse(saved) as Partial<RpConfig>) }
      const season = typeof p.season === 'number' ? p.season : DEFAULT_RP_CONFIG.season
      const useProjection =
        typeof p.useProjection === 'boolean' ? p.useProjection : DEFAULT_RP_CONFIG.useProjection
      const s = Math.max(MIN_SUPPORTED_SEASON, Math.min(2100, season))
      return {
        ...p,
        season: s,
        useProjection: s === PROJECTION_SEASON ? useProjection : false,
      }
    } catch {
      return DEFAULT_RP_CONFIG
    }
  })
  const [cats, setCats] = useState<CategoryConfig[]>(() => DEFAULT_CATEGORIES)
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [raw, setRaw] = useState<Awaited<ReturnType<typeof fetchSeasonPitchingStats>> | null>(null)
  const [savantByPlayerId, setSavantByPlayerId] = useState<Record<string, SavantPitcherMetrics> | null>(null)
  const [fangraphsByPlayerId, setFangraphsByPlayerId] = useState<Record<string, FangraphsPitcherFields> | null>(null)
  const [oopsyByPlayerId, setOopsyByPlayerId] = useState<Record<string, OopsyPitcherFields> | null>(null)
  /** MLB 스플릿에 없고 OOPSY에만 있는 투수(2026 Proj). */
  const [supplementRows, setSupplementRows] = useState<PlayerRow[]>([])
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
      setOopsyByPlayerId(null)
      setSupplementRows([])
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

        let supplement: PlayerRow[] = []
        // FanGraphs OOPSY projections are scraped at deploy time.
        try {
          const oopsyRes = await getOopsyPitcherMap(cfg.season)
          if (cancelled) return
          setOopsyByPlayerId(oopsyRes.byPlayerId)
          if (
            cfg.useProjection &&
            cfg.season === PROJECTION_SEASON &&
            oopsyRes.byPlayerId &&
            Object.keys(oopsyRes.byPlayerId).length > 0
          ) {
            const baseIds = new Set(buildRows(res.splits).map((r) => r.playerId))
            const missing = Object.keys(oopsyRes.byPlayerId).filter((id) => {
              if (baseIds.has(Number(id))) return false
              const o = oopsyRes.byPlayerId[id]
              return o != null && (o.IP != null || o.ERA != null || o.SO != null)
            })
            if (missing.length > 0) {
              const names = await fetchMlbFullNamesByPlayerIds(missing)
              if (cancelled) return
              supplement = buildOopsySupplementPlayerRows(
                missing,
                names,
                oopsyRes.byPlayerId,
                cfg.season,
              )
            }
          }
        } catch {
          if (cancelled) return
          setOopsyByPlayerId(null)
        }
        if (cancelled) return
        setSupplementRows(supplement)

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
  }, [cfg.season, cfg.useProjection, dataRefreshKey])

  function handleForceDataRefresh() {
    clearDataCaches()
    setDataRefreshKey((k) => k + 1)
  }

  const rows = useMemo(() => {
    if (!raw) return []
    const base = buildRows(raw.splits)
    const combined = [...base, ...supplementRows]
    const rrOk = rosterResource?.ok === true
    const byId = rrOk ? rosterResource.byPlayerId : {}
    const depth = rrOk ? rosterResource.depthByTeam : null

    const mergeOopsy =
      cfg.season === PROJECTION_SEASON && cfg.useProjection && oopsyByPlayerId != null

    return combined.map((r) => {
      let r2 = mergeRpRowWithDepthSnapshot(r, byId, depth)

      const m = savantByPlayerId ? savantByPlayerId[String(r.playerId)] : undefined
      const f = fangraphsByPlayerId ? fangraphsByPlayerId[String(r.playerId)] : undefined
      // 2026 (Proj): Savant/FG 없어도 OOPSY로 랭킹 스탯을 채운다(2026 실시즌과 분리).
      if (!m && !f && !mergeOopsy) return r2

      let nextStats = { ...r2.stats }
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
      let oopsyGs: number | null | undefined = r2.oopsyGs
      let oopsyProjection = r2.oopsyProjection
      if (mergeOopsy) {
        const o = oopsyByPlayerId?.[String(r.playerId)]
        nextStats = mergeOopsyIntoStats(nextStats, o)
        oopsyGs = o?.GS != null && Number.isFinite(o.GS) ? o.GS : null
        oopsyProjection = o ?? null
      }
      return {
        ...r2,
        stats: nextStats,
        oopsyGs,
        oopsyProjection,
      }
    })
  }, [
    raw,
    supplementRows,
    savantByPlayerId,
    fangraphsByPlayerId,
    rosterResource,
    oopsyByPlayerId,
    cfg.season,
    cfg.useProjection,
  ])

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
        aria-label="캐시를 비우고 스탯·보직·팀별 뎁스 차트 JSON을 다시 불러오기"
      >
        Fetch
      </button>
      <button
        class={styles.ghostButton}
        onClick={() =>
          exportRowsToCsv(
            rp.rows,
            `bullpen_rp_${cfg.season}${cfg.useProjection ? '_proj' : ''}.csv`,
          )
        }
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
              aria-label="캐시를 비우고 스탯·보직·팀별 뎁스 차트 JSON을 다시 불러오기"
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

      <PlayerDrawer
        row={selected}
        onClose={() => setSelected(null)}
        rpMeta={rp.meta}
        oopsyByPlayerId={oopsyByPlayerId}
      />
    </div>
  )
}

