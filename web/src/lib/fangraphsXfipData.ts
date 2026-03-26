import { MIN_SUPPORTED_SEASON } from './seasonPolicy'

export type FangraphsXfipPayload = {
  season: number
  fetchedAt: string
  byPlayerId: Record<string, FangraphsPitcherFields>
  source?: string
}

export type FangraphsPitcherFields = {
  xFIP: number
  FIP: number | null
  WPA: number | null
  LOBP: number | null
  /** FanGraphs HR/FB as a ratio (e.g. 0.091 ≈ 9.1%). */
  HRFB: number | null
  /** FanGraphs Quality Starts count. */
  QS: number | null
}

// Bump version so older sparse 30-player payloads don't stick around.
const LS_PREFIX = 'bullpen-rp:fangraphsXfip:v6'

function dayStampLA(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function key(season: number) {
  return `${LS_PREFIX}:${season}`
}

export type FangraphsXfipMapRes = {
  byPlayerId: Record<string, FangraphsPitcherFields>
  fetchedAt: string | null
  ok: boolean
  error?: string
}

/**
 * Loads a baked sparse xFIP map produced at deploy time.
 * 같은 LA 날짜에는 localStorage로 하루 1회만 네트워크 fetch.
 */
export async function getFangraphsXfipMap(season: number, signal?: AbortSignal): Promise<FangraphsXfipMapRes> {
  if (season < MIN_SUPPORTED_SEASON) {
    return {
      byPlayerId: {},
      fetchedAt: null,
      ok: false,
      error: `FanGraphs xFIP 데이터는 ${MIN_SUPPORTED_SEASON}시즌 이상만 제공합니다.`,
    }
  }
  const todayLA = dayStampLA()
  const k = key(season)
  const cached = localStorage.getItem(k)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { cachedDay?: string; payload?: FangraphsXfipPayload }
      if (parsed?.cachedDay === todayLA && parsed.payload?.byPlayerId) {
        return { byPlayerId: parsed.payload.byPlayerId, fetchedAt: parsed.payload.fetchedAt, ok: true }
      }
    } catch {
      // ignore
    }
  }

  const fileUrl = `./data/fangraphs_xfip_${season}.json`
  const fallback: FangraphsXfipMapRes = { byPlayerId: {}, fetchedAt: null, ok: false, error: 'missing file' }
  try {
    const res = await fetch(fileUrl, { signal, cache: 'no-store' })
    if (!res.ok) return fallback
    const payload = (await res.json()) as FangraphsXfipPayload
    if (!payload?.byPlayerId) return fallback
    try {
      localStorage.setItem(k, JSON.stringify({ cachedDay: todayLA, payload }))
    } catch {
      // quota ignore
    }
    return { byPlayerId: payload.byPlayerId, fetchedAt: payload.fetchedAt, ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fetch failed'
    return { byPlayerId: {}, fetchedAt: null, ok: false, error: msg }
  }
}

export function clearLegacyXfipCaches() {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    if (k.startsWith(LS_PREFIX)) keys.push(k)
  }
  keys.forEach((k) => localStorage.removeItem(k))
}

