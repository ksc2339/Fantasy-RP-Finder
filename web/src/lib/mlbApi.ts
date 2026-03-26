import type { MlbPitchingSplit, SeasonPitchingResponse } from './types'

type FetchSeasonPitchingStatsArgs = {
  season: number
  signal?: AbortSignal
}

const LS_PREFIX = 'bullpen-rp:mlbStats:v1'
/** Cache until Pacific day changes (America/Los_Angeles). */

function buildUrl(season: number) {
  const params = new URLSearchParams({
    stats: 'season',
    group: 'pitching',
    season: String(season),
    gameType: 'R',
    playerPool: 'ALL',
    limit: '100000',
  })
  return `https://statsapi.mlb.com/api/v1/stats?${params.toString()}`
}

function coerceSplits(x: unknown): MlbPitchingSplit[] {
  const splits = (x as any)?.stats?.[0]?.splits
  if (!Array.isArray(splits)) return []
  return splits as MlbPitchingSplit[]
}

const LS_TEAM_ABBR = 'bullpen-rp:mlbTeamAbbr:v1'

async function getTeamIdToAbbreviation(signal?: AbortSignal): Promise<Map<number, string>> {
  const todayLA = getLosAngelesDayStamp()
  const cached = localStorage.getItem(LS_TEAM_ABBR)
  if (cached) {
    try {
      const p = JSON.parse(cached) as { day?: string; map?: Record<string, string> }
      if (p?.day === todayLA && p.map && typeof p.map === 'object') {
        return new Map(Object.entries(p.map).map(([id, ab]) => [Number(id), ab]))
      }
    } catch {
      // ignore
    }
  }
  const res = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1&activeStatus=ACTIVE', {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return new Map()
  const json = (await res.json()) as { teams?: { id: number; abbreviation?: string }[] }
  const map = new Map<number, string>()
  for (const t of json.teams ?? []) {
    if (typeof t.id === 'number' && t.abbreviation) map.set(t.id, t.abbreviation)
  }
  try {
    localStorage.setItem(LS_TEAM_ABBR, JSON.stringify({ day: todayLA, map: Object.fromEntries(map) }))
  } catch {
    // quota ignore
  }
  return map
}

function enrichSplitsWithTeamAbbreviation(
  splits: MlbPitchingSplit[],
  abbrById: Map<number, string>,
): MlbPitchingSplit[] {
  return splits.map((s) => {
    const t = s.team
    if (!t?.id) return s
    const abbr = abbrById.get(t.id) ?? t.abbreviation
    if (!abbr) return s
    return { ...s, team: { ...t, abbreviation: abbr } }
  })
}

export async function fetchSeasonPitchingStats({
  season,
  signal,
}: FetchSeasonPitchingStatsArgs): Promise<SeasonPitchingResponse> {
  pruneLegacyCaches()
  const key = `${LS_PREFIX}:${season}`
  const todayLA = getLosAngelesDayStamp()
  const cached = localStorage.getItem(key)
  let fallback: SeasonPitchingResponse | null = null
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as SeasonPitchingResponse & { cachedDay?: string }
      if (parsed?.cachedDay === todayLA) {
        const abbr = await getTeamIdToAbbreviation(signal)
        const splits = enrichSplitsWithTeamAbbreviation(parsed.splits, abbr)
        return { fetchedAt: parsed.fetchedAt, splits }
      }
      fallback = { fetchedAt: parsed?.fetchedAt, splits: parsed?.splits }
    } catch {
      // ignore corrupted cache
    }
  }

  const url = buildUrl(season)
  try {
    const res = await fetch(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`MLB Stats API error: ${res.status} ${res.statusText}`)
    const json = (await res.json()) as unknown
    const rawSplits = coerceSplits(json)
    const abbr = await getTeamIdToAbbreviation(signal)
    const splits = enrichSplitsWithTeamAbbreviation(rawSplits, abbr)
    const todayLA = getLosAngelesDayStamp()
    const out: SeasonPitchingResponse & { cachedAt: number; cachedDay: string } = {
      fetchedAt: new Date().toISOString(),
      cachedAt: Date.now(),
      cachedDay: todayLA,
      splits,
    }
    try {
      localStorage.setItem(key, JSON.stringify(out))
    } catch {
      // quota — still return fresh splits
    }
    return { fetchedAt: out.fetchedAt, splits: out.splits }
  } catch (e) {
    if (fallback?.splits?.length) {
      const abbr = await getTeamIdToAbbreviation(signal)
      const splits = enrichSplitsWithTeamAbbreviation(fallback.splits, abbr)
      return { fetchedAt: fallback.fetchedAt, splits }
    }
    throw e
  }
}

function getLosAngelesDayStamp(now = new Date()): string {
  // Returns YYYY-MM-DD in America/Los_Angeles timezone.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function pruneLegacyCaches() {
  // Older versions used these prefixes; remove once so storage doesn't grow over time.
  const legacyPrefixes = ['bullpen-rp:whiffDaily:', 'bullpen-rp:savantDaily:', 'bullpen-rp:savantWhiff:']
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    if (legacyPrefixes.some((p) => k.startsWith(p))) {
      localStorage.removeItem(k)
    }
  }
}

type FetchPlayerPersonArgs = {
  playerId: number
  signal?: AbortSignal
}

const LS_FULL_NAME_BY_ID = 'bullpen-rp:mlbFullNameById:v1'

/**
 * MLBAM ID 목록에 대해 `fullName`을 조회합니다. FanGraphs RR JSON에 이름이 비어 있을 때 뎁스 표에 쓰기 위함.
 * 로컬 스토리지에 병합 캐시합니다.
 */
export async function fetchMlbFullNamesByPlayerIds(
  ids: string[],
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id) => typeof id === 'string' && /^\d+$/.test(id)))]
  const out: Record<string, string> = {}
  try {
    const raw = localStorage.getItem(LS_FULL_NAME_BY_ID)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>
      if (parsed && typeof parsed === 'object') {
        for (const id of unique) {
          const n = parsed[id]
          if (typeof n === 'string' && n.trim()) out[id] = n.trim()
        }
      }
    }
  } catch {
    // ignore
  }

  const missing = unique.filter((id) => !out[id])
  const CHUNK = 50
  const PARALLEL = 6
  const chunks: string[][] = []
  for (let i = 0; i < missing.length; i += CHUNK) {
    chunks.push(missing.slice(i, i + CHUNK))
  }
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    if (signal?.aborted) break
    const group = chunks.slice(i, i + PARALLEL)
    await Promise.all(
      group.map(async (chunk) => {
        const url = `https://statsapi.mlb.com/api/v1/people?personIds=${chunk.join(',')}`
        try {
          const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
          if (!res.ok) return
          const json = (await res.json()) as { people?: { id?: number; fullName?: string }[] }
          for (const p of json.people ?? []) {
            const id = p.id != null ? String(p.id) : ''
            if (id && typeof p.fullName === 'string' && p.fullName.trim()) {
              out[id] = p.fullName.trim()
            }
          }
        } catch {
          // network / abort
        }
      }),
    )
  }

  try {
    const raw = localStorage.getItem(LS_FULL_NAME_BY_ID)
    const merged = { ...(raw ? (JSON.parse(raw) as Record<string, string>) : {}), ...out }
    localStorage.setItem(LS_FULL_NAME_BY_ID, JSON.stringify(merged))
  } catch {
    // quota
  }

  return out
}

export async function fetchPlayerPitchHandAndAge({
  playerId,
  signal,
}: FetchPlayerPersonArgs): Promise<{
  age: number | null
  pitchHand: string | null
  ok: boolean
  error?: string
}> {
  const LS_PREFIX_PERSON = 'bullpen-rp:mlbPerson:v1'
  const todayLA = getLosAngelesDayStamp()
  const key = `${LS_PREFIX_PERSON}:${playerId}`

  const cached = localStorage.getItem(key)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { cachedDay?: string; age?: number | null; pitchHand?: string | null }
      if (parsed?.cachedDay === todayLA) {
        return { age: parsed.age ?? null, pitchHand: parsed.pitchHand ?? null, ok: true }
      }
    } catch {
      // ignore corrupted cache
    }
  }

  const url = `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=person`
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) {
      return { age: null, pitchHand: null, ok: false, error: `MLB person error: ${res.status}` }
    }
    const json = (await res.json()) as any
    const person = json?.people?.[0]
    const age = typeof person?.currentAge === 'number' ? person.currentAge : null
    const pitchHand = person?.pitchHand?.code ?? null

    try {
      localStorage.setItem(key, JSON.stringify({ cachedDay: todayLA, age, pitchHand }))
    } catch {
      // quota ignore
    }
    return { age, pitchHand, ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fetch failed'
    return { age: null, pitchHand: null, ok: false, error: msg }
  }
}

