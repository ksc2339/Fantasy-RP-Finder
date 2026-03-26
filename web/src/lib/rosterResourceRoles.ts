import type { PlayerRow } from './types'
import { fetchMlbFullNamesByPlayerIds } from './mlbApi'
import { ROSTER_DEPTH_SLUGS, depthTeamTitle } from './mlbTeamDepthLabels'
import { isDepthChartExcludedSpStarter, isRrMinorsOrWaiting } from './rrTypeLabel'

export type RosterResourcePitcherFields = {
  rrRole: string
  rrType: string
  position1: string | null
  /** Roster Resource 팀 URL 슬러그(angels, red-sox, …). 스크립트가 채움 */
  teamSlug?: string
  name?: string | null
}

export type TeamDepthPitcher = {
  playerId: string
  name: string | null
  rrRole: string
  rrType: string
  position1: string | null
}

export type TeamDepthBucket = {
  slug: string
  pitchers: TeamDepthPitcher[]
}

export type RosterResourceRolesPayload = {
  fetchedAt: string
  byPlayerId: Record<string, RosterResourcePitcherFields>
  byTeam?: Record<string, TeamDepthBucket>
  source?: string
}

function compareDepthRoles(a: string, b: string): number {
  const ma = /^SP(\d+)$/i.exec(a.trim())
  const mb = /^SP(\d+)$/i.exec(b.trim())
  if (ma && mb) return parseInt(ma[1], 10) - parseInt(mb[1], 10)
  if (ma && !mb) return -1
  if (!ma && mb) return 1
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function countDepthPitchers(byTeam: Record<string, TeamDepthBucket>): number {
  let n = 0
  for (const b of Object.values(byTeam)) n += b.pitchers.length
  return n
}

/**
 * 30팀 뎁스 **페이지** 전용: FanGraphs 스크립트가 넣은 `byTeam`만 사용 (팀별 뎁스 페이지 스크랩).
 */
function resolveDepthBucketsFgOnly(payload: RosterResourceRolesPayload): Record<string, TeamDepthBucket> | null {
  const bt = payload.byTeam
  if (!bt || Object.keys(bt).length === 0) return null
  return bt
}

function collectPlayerIdsFromDepthBuckets(byTeam: Record<string, TeamDepthBucket>): string[] {
  const ids = new Set<string>()
  for (const b of Object.values(byTeam)) {
    for (const p of b.pitchers) {
      if (p.playerId && !isRrMinorsOrWaiting(p.rrType) && !isDepthChartExcludedSpStarter(p)) ids.add(p.playerId)
    }
  }
  return [...ids]
}

/** FanGraphs 스크랩에 이름이 없을 때 MLB `people` API로 채움(RP 랭킹과 동일한 표시용 이름). */
function enrichDepthBucketsWithMlbNames(
  byTeam: Record<string, TeamDepthBucket>,
  names: Record<string, string>,
): Record<string, TeamDepthBucket> {
  const result: Record<string, TeamDepthBucket> = {}
  for (const [slug, bucket] of Object.entries(byTeam)) {
    result[slug] = {
      ...bucket,
      pitchers: bucket.pitchers.map((p) => {
        const hasRr = typeof p.name === 'string' && p.name.trim()
        const fromMlb = names[p.playerId]
        return {
          ...p,
          name: hasRr ? p.name!.trim() : fromMlb ?? null,
        }
      }),
    }
  }
  return result
}

/**
 * JSON 페이로드에서 RP용 뎁스 버킷: `byTeam`이 있으면 우선, 없으면 `byPlayerId.teamSlug`로 조립.
 */
export function resolveDepthBucketsFromPayload(
  payload: RosterResourceRolesPayload,
): { byTeam: Record<string, TeamDepthBucket>; sourceMode: 'file_teams' | 'built_from_rr_teams' } | null {
  const pidKeys = payload?.byPlayerId ? Object.keys(payload.byPlayerId) : []
  if (pidKeys.length === 0) return null

  const bt = payload.byTeam
  if (bt && Object.keys(bt).length > 0) {
    return { byTeam: bt, sourceMode: 'file_teams' }
  }

  const byTeam = buildDepthBucketsFromByPlayerId(payload.byPlayerId)
  if (countDepthPitchers(byTeam) === 0) return null
  return { byTeam, sourceMode: 'built_from_rr_teams' }
}

/**
 * RP 랭킹: `team`은 MLB 시즌 스플릿 그대로 유지.
 * Roster Resource의 팀은 `teamCurrent`·보직 필드에만 반영합니다.
 */
export function mergeRpRowWithDepthSnapshot(
  row: PlayerRow,
  byPlayerId: Record<string, RosterResourcePitcherFields>,
  depthByTeam: Record<string, TeamDepthBucket> | null,
): PlayerRow {
  const pid = String(row.playerId)
  const fb = byPlayerId[pid]
  const ts = typeof fb?.teamSlug === 'string' ? fb.teamSlug.trim() : ''
  const slugFromRoster = ts && (ROSTER_DEPTH_SLUGS as readonly string[]).includes(ts) ? ts : null

  const currentLabel = slugFromRoster ? depthTeamTitle(slugFromRoster) : null

  if (slugFromRoster) {
    if (depthByTeam?.[slugFromRoster]) {
      const pitcher = depthByTeam[slugFromRoster].pitchers.find((p) => p.playerId === pid)
      if (pitcher) {
        return {
          ...row,
          teamCurrent: currentLabel,
          rrRole: pitcher.rrRole,
          rrType: pitcher.rrType,
          rrPosition1: pitcher.position1,
        }
      }
      return {
        ...row,
        teamCurrent: currentLabel,
        rrRole: fb?.rrRole ?? null,
        rrType: fb?.rrType ?? null,
        rrPosition1: fb?.position1 ?? null,
      }
    }
    return {
      ...row,
      teamCurrent: currentLabel,
      rrRole: fb?.rrRole ?? null,
      rrType: fb?.rrType ?? null,
      rrPosition1: fb?.position1 ?? null,
    }
  }

  if (!fb) return { ...row, teamCurrent: row.teamCurrent ?? null }

  return {
    ...row,
    teamCurrent: row.teamCurrent ?? null,
    rrRole: fb.rrRole,
    rrType: fb.rrType,
    rrPosition1: fb.position1,
  }
}

/** `byPlayerId`의 `teamSlug`로 30구단 버킷 구성(RP JSON과 동일 출처, MLB API 없음) */
function buildDepthBucketsFromByPlayerId(
  byPlayerId: Record<string, RosterResourcePitcherFields>,
): Record<string, TeamDepthBucket> {
  const perSlug: Record<string, TeamDepthPitcher[]> = {}
  for (const slug of ROSTER_DEPTH_SLUGS) {
    perSlug[slug] = []
  }

  for (const [pid, rr] of Object.entries(byPlayerId)) {
    const teamSlug = typeof rr.teamSlug === 'string' ? rr.teamSlug.trim() : ''
    if (!teamSlug || !perSlug[teamSlug]) continue
    const nm = rr.name
    perSlug[teamSlug].push({
      playerId: pid,
      name: typeof nm === 'string' && nm.trim() ? nm.trim() : null,
      rrRole: rr.rrRole,
      rrType: rr.rrType,
      position1: rr.position1,
    })
  }

  const byTeam: Record<string, TeamDepthBucket> = {}
  for (const slug of ROSTER_DEPTH_SLUGS) {
    const list = [...perSlug[slug]].sort((a, b) => compareDepthRoles(a.rrRole, b.rrRole))
    byTeam[slug] = { slug, pitchers: list }
  }
  return byTeam
}

const LS_ROSTER = 'bullpen-rp:rosterResource:v1'

function dayStampLA(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function rosterCacheKey() {
  return `${LS_ROSTER}:day`
}

function readRosterPayloadFromDayCache(): RosterResourceRolesPayload | null {
  const todayLA = dayStampLA()
  try {
    const raw = localStorage.getItem(rosterCacheKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as { cachedDay?: string; payload?: RosterResourceRolesPayload }
    if (parsed?.cachedDay === todayLA && parsed.payload?.byPlayerId) {
      return parsed.payload
    }
  } catch {
    // ignore
  }
  return null
}

function writeRosterPayloadToDayCache(payload: RosterResourceRolesPayload): void {
  try {
    localStorage.setItem(rosterCacheKey(), JSON.stringify({ cachedDay: dayStampLA(), payload }))
  } catch {
    // quota
  }
}

export type RosterResourceRolesRes = {
  byPlayerId: Record<string, RosterResourcePitcherFields>
  /** 패치 시점 뎁스(30팀) — `byTeam` 또는 teamSlug 조립본 */
  depthByTeam: Record<string, TeamDepthBucket> | null
  fetchedAt: string | null
  ok: boolean
  error?: string
}

/**
 * Baked map from deploy script (30 team depth charts). Not tied to stats season;
 * reflects Roster Resource snapshot at generation time.
 */
export async function getRosterResourceRolesMap(signal?: AbortSignal): Promise<RosterResourceRolesRes> {
  const hit = readRosterPayloadFromDayCache()
  if (hit) {
    const resolved = resolveDepthBucketsFromPayload(hit)
    return {
      byPlayerId: hit.byPlayerId,
      depthByTeam: resolved?.byTeam ?? null,
      fetchedAt: hit.fetchedAt,
      ok: true,
    }
  }

  const fileUrl = './data/roster_resource_roles.json'
  const fallback: RosterResourceRolesRes = {
    byPlayerId: {},
    depthByTeam: null,
    fetchedAt: null,
    ok: false,
    error: 'missing file',
  }
  try {
    const res = await fetch(fileUrl, { signal, cache: 'no-store' })
    if (!res.ok) return fallback
    const payload = (await res.json()) as RosterResourceRolesPayload
    if (!payload?.byPlayerId) return fallback
    writeRosterPayloadToDayCache(payload)
    const resolved = resolveDepthBucketsFromPayload(payload)
    return {
      byPlayerId: payload.byPlayerId,
      depthByTeam: resolved?.byTeam ?? null,
      fetchedAt: payload.fetchedAt,
      ok: true,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fetch failed'
    return { byPlayerId: {}, depthByTeam: null, fetchedAt: null, ok: false, error: msg }
  }
}

export type DepthChartsLoadResult = {
  ok: boolean
  byTeam: Record<string, TeamDepthBucket> | null
  fetchedAt: string | null
  /** 팀별 스크랩 `byTeam`만 사용 */
  sourceMode?: 'fg_by_team'
  error?: string
}

/**
 * `byTeam`에 MLB Stats `people`의 `fullName`을 채웁니다. 실패 시 원본을 그대로 둡니다.
 * UI는 `loadDepthChartsData` 직후 이 함수를 **비동기로** 호출해 이름만 늦게 갱신합니다.
 */
export async function enrichDepthTeamsWithMlbNames(
  byTeam: Record<string, TeamDepthBucket>,
  signal?: AbortSignal,
): Promise<Record<string, TeamDepthBucket>> {
  try {
    const ids = collectPlayerIdsFromDepthBuckets(byTeam)
    const names = await fetchMlbFullNamesByPlayerIds(ids, signal)
    return enrichDepthBucketsWithMlbNames(byTeam, names)
  } catch {
    return byTeam
  }
}

/**
 * 30팀 뎁스: `roster_resource_roles.json`의 **`byTeam`만** 사용(FanGraphs 팀 뎁스 페이지 스크랩).
 * `byPlayerId`+teamSlug 조립은 쓰지 않습니다. 표시 이름 보강은 `enrichDepthTeamsWithMlbNames`를 따로 호출합니다.
 * `skipDayCache`: Fetch 후 `clearDataCaches`와 함께 쓸 때 브라우저 일 캐시를 건너뛰고 파일을 다시 받습니다.
 */
export async function loadDepthChartsData(
  signal?: AbortSignal,
  options?: { skipDayCache?: boolean },
): Promise<DepthChartsLoadResult> {
  if (!options?.skipDayCache) {
    const fromCache = readRosterPayloadFromDayCache()
    if (fromCache) {
      const fetchedAt = fromCache.fetchedAt ?? null
      const byTeamFg = resolveDepthBucketsFgOnly(fromCache)
      if (!byTeamFg) {
        return {
          ok: false,
          byTeam: null,
          fetchedAt,
          error: 'roster_json_missing_team_layout',
        }
      }
      return {
        ok: true,
        byTeam: byTeamFg,
        fetchedAt,
        sourceMode: 'fg_by_team',
      }
    }
  }

  const fileUrl = './data/roster_resource_roles.json'
  try {
    const res = await fetch(fileUrl, { signal, cache: 'no-store' })
    if (!res.ok) return { ok: false, byTeam: null, fetchedAt: null, error: `HTTP ${res.status}` }
    const payload = (await res.json()) as RosterResourceRolesPayload
    const fetchedAt = payload?.fetchedAt ?? null

    writeRosterPayloadToDayCache(payload)

    const byTeamFg = resolveDepthBucketsFgOnly(payload)
    if (!byTeamFg) {
      return {
        ok: false,
        byTeam: null,
        fetchedAt,
        error: 'roster_json_missing_team_layout',
      }
    }
    return {
      ok: true,
      byTeam: byTeamFg,
      fetchedAt,
      sourceMode: 'fg_by_team',
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fetch failed'
    return { ok: false, byTeam: null, fetchedAt: null, error: msg }
  }
}
