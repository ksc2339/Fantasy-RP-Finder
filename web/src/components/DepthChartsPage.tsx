import { useEffect, useRef, useState } from 'preact/hooks'
import {
  enrichDepthTeamsWithMlbNames,
  loadDepthChartsData,
  type TeamDepthBucket,
  type TeamDepthPitcher,
} from '../lib/rosterResourceRoles'
import {
  DEPTH_DIVISIONS,
  type DepthDivisionId,
  depthTeamTitle,
} from '../lib/mlbTeamDepthLabels'
import {
  fmtRrResourceType,
  isDepthChartExcludedSpStarter,
  isRrMinorsOrWaiting,
} from '../lib/rrTypeLabel'
import styles from './DepthChartsPage.module.css'

function nameHasHyphen(name: string | null | undefined): boolean {
  return typeof name === 'string' && name.includes('-')
}

/**
 * Roster Resource JSON은 이름이 비어 있는 행이 많음(null). 뎁스 표는 그대로 두고 '—'로 표시.
 * 하이픈(-) 포함 이름만 제외(RP 랭킹과 동일). `off-*`(마이너/대기) 행은 표시하지 않음.
 * 보직이 SP·SP1… 선발이거나, IL인데 포지션이 SP인 행은 제외(불펜 위주).
 */
function filterPitchersForDisplay(pitchers: TeamDepthPitcher[]): TeamDepthPitcher[] {
  return pitchers.filter(
    (p) =>
      !nameHasHyphen(p.name) &&
      !isRrMinorsOrWaiting(p.rrType) &&
      !isDepthChartExcludedSpStarter(p),
  )
}

/** 표시 순: CL → SU(번호 큰 순) → MID → LR → 기타 → IL */
function rankDepthPitcher(p: TeamDepthPitcher): number {
  const r = String(p.rrRole ?? '').trim().toUpperCase()
  const typ = String(p.rrType ?? '').toLowerCase()
  if (typ.startsWith('il-')) return 200
  if (/^\d*IL$/i.test(r) || r === 'INJ') return 200
  if (r === 'CL') return 0
  const su = /^SU(\d+)$/i.exec(r)
  if (su) {
    const n = parseInt(su[1], 10)
    return 10 + (100 - n)
  }
  if (r === 'MID') return 120
  if (r === 'LR') return 130
  return 150
}

function sortPitchersForDepthDisplay(pitchers: TeamDepthPitcher[]): TeamDepthPitcher[] {
  return [...pitchers].sort((a, b) => {
    const ra = rankDepthPitcher(a)
    const rb = rankDepthPitcher(b)
    if (ra !== rb) return ra - rb
    return String(a.rrRole).localeCompare(String(b.rrRole), undefined, { numeric: true })
  })
}

function PitcherTable({ pitchers, slug }: { pitchers: TeamDepthPitcher[]; slug: string }) {
  if (pitchers.length === 0) {
    return (
      <p class={styles.meta} style={{ padding: '12px 14px', margin: 0 }}>
        투수 행이 없습니다.
      </p>
    )
  }
  return (
    <table class={styles.table}>
      <thead>
        <tr>
          <th>이름</th>
          <th>보직</th>
          <th>구분</th>
          <th>포지션</th>
        </tr>
      </thead>
      <tbody>
        {pitchers.map((p, i) => (
          <tr key={`${slug}-${p.playerId}-${p.rrRole}-${i}`}>
            <td class={styles.nameCell}>{p.name ?? '—'}</td>
            <td>{p.rrRole}</td>
            <td>{fmtRrResourceType(p.rrType)}</td>
            <td>{p.position1 ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

type Props = {
  /** 바뀌면 일 캐시를 쓰지 않고 `roster_resource_roles.json`을 다시 받습니다 */
  refreshKey?: number
}

export function DepthChartsPage({ refreshKey = 0 }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [byTeam, setByTeam] = useState<Record<string, TeamDepthBucket> | null>(null)
  const [errDetail, setErrDetail] = useState<string | null>(null)
  const [divisionId, setDivisionId] = useState<DepthDivisionId>(() => DEPTH_DIVISIONS[0].id)
  const prevRefreshKey = useRef<number | null>(null)

  useEffect(() => {
    setStatus('loading')
    setErrDetail(null)
    const skipDayCache = prevRefreshKey.current !== null && prevRefreshKey.current !== refreshKey
    prevRefreshKey.current = refreshKey

    const ac = new AbortController()
    let cancelled = false
    loadDepthChartsData(ac.signal, { skipDayCache })
      .then((r) => {
        if (!r.ok || !r.byTeam) {
          setErrDetail(r.error ?? 'unknown')
          setStatus('error')
          return null
        }
        setByTeam(r.byTeam)
        setStatus('ready')
        return enrichDepthTeamsWithMlbNames(r.byTeam, ac.signal)
      })
      .then((enriched) => {
        if (cancelled || ac.signal.aborted) return
        if (enriched) setByTeam(enriched)
      })
      .catch((e) => {
        if (cancelled || ac.signal.aborted) return
        const msg = e instanceof Error ? e.message : 'unknown'
        setErrDetail(msg)
        setStatus('error')
      })
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [refreshKey])

  return (
    <div class={styles.wrap}>
      {status === 'loading' ? (
        <p class={styles.meta}>불러오는 중…</p>
      ) : status === 'error' ? (
        <div class={styles.error}>
          {errDetail === 'roster_json_missing_team_layout' ? (
            <>
              Roster Resource JSON에 FanGraphs 팀별 뎁스 블록(<code>byTeam</code>)이 없습니다.{' '}
              <code>node scripts/generate-roster-resource-roles.mjs</code> 로 생성한 뒤 배포해 주세요.
            </>
          ) : errDetail === 'empty_roster_json' ? (
            <>Roster Resource JSON에 투수 데이터가 없습니다.</>
          ) : (
            <>데이터를 불러오지 못했습니다. ({errDetail})</>
          )}
        </div>
      ) : (
        <>
          <div class={styles.divisionBar} role="tablist" aria-label="지구 선택">
            {DEPTH_DIVISIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={divisionId === d.id}
                class={divisionId === d.id ? styles.divTabActive : styles.divTab}
                onClick={() => setDivisionId(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div class={styles.teamGrid}>
            {(DEPTH_DIVISIONS.find((x) => x.id === divisionId)?.slugs ?? []).map((slug) => {
              const bucket = byTeam?.[slug]
              const pitchers = sortPitchersForDepthDisplay(filterPitchersForDisplay(bucket?.pitchers ?? []))
              return (
                <details key={slug} class={styles.teamCard}>
                  <summary>
                    <span class={styles.teamTitle}>{depthTeamTitle(slug)}</span>
                    <span class={styles.count}>{pitchers.length}명</span>
                  </summary>
                  <div class={styles.tableWrap}>
                    <PitcherTable pitchers={pitchers} slug={slug} />
                  </div>
                </details>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
