import type { MlbPitchingSplit, SeasonPitchingResponse } from './types'

type FetchSeasonPitchingStatsArgs = {
  season: number
  signal?: AbortSignal
}

const LS_PREFIX = 'bullpen-rp:mlbStats:v1'
/** At most one MLB season fetch + localStorage write per 24h per season. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

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

export async function fetchSeasonPitchingStats({
  season,
  signal,
}: FetchSeasonPitchingStatsArgs): Promise<SeasonPitchingResponse> {
  const key = `${LS_PREFIX}:${season}`
  const cached = localStorage.getItem(key)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as SeasonPitchingResponse & { cachedAt?: number }
      if (typeof parsed?.cachedAt === 'number' && Date.now() - parsed.cachedAt < CACHE_TTL_MS) {
        return { fetchedAt: parsed.fetchedAt, splits: parsed.splits }
      }
    } catch {
      // ignore corrupted cache
    }
  }

  const url = buildUrl(season)
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`MLB Stats API error: ${res.status} ${res.statusText}`)
  const json = (await res.json()) as unknown
  const splits = coerceSplits(json)
  const out: SeasonPitchingResponse & { cachedAt: number } = {
    fetchedAt: new Date().toISOString(),
    cachedAt: Date.now(),
    splits,
  }
  localStorage.setItem(key, JSON.stringify(out))
  return { fetchedAt: out.fetchedAt, splits: out.splits }
}

