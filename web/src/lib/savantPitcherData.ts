export type SavantPitcherMetrics = {
  whiffPct: number | null
  xera: number | null
  xfip: number | null
}

// Bump version so old cached xFIP=0 payload doesn't stick around.
const LS_PREFIX = 'bullpen-rp:savantPitcher:v5'

type DailyPayload = {
  cachedDay: string
  fetchedAt: string
  byPlayerId: Record<string, SavantPitcherMetrics>
}

function dailyKey(season: number) {
  return `${LS_PREFIX}:${season}`
}

function readCache(season: number, todayLA: string): DailyPayload | null {
  try {
    const raw = localStorage.getItem(dailyKey(season))
    if (!raw) return null
    const p = JSON.parse(raw) as DailyPayload
    if (p?.cachedDay !== todayLA || !p.byPlayerId) return null
    return p
  } catch {
    return null
  }
}

function readCacheAny(season: number): DailyPayload | null {
  try {
    const raw = localStorage.getItem(dailyKey(season))
    if (!raw) return null
    const p = JSON.parse(raw) as DailyPayload
    if (!p?.byPlayerId) return null
    return p
  } catch {
    return null
  }
}

function writeCache(season: number, byPlayerId: Record<string, SavantPitcherMetrics>, fetchedAt: string, cachedDay: string) {
  try {
    localStorage.setItem(
      dailyKey(season),
      JSON.stringify({ cachedDay, fetchedAt, byPlayerId } satisfies DailyPayload),
    )
  } catch {
    // quota
  }
}

function normalizeMetrics(v: unknown): SavantPitcherMetrics {
  const o = v as Record<string, unknown>
  const n = (x: unknown) => {
    const t = typeof x === 'number' ? x : typeof x === 'string' ? Number(x) : NaN
    return Number.isFinite(t) ? t : null
  }
  return {
    whiffPct: n(o?.whiffPct),
    xera: n(o?.xera),
    xfip: n(o?.xfip),
  }
}

/** Clear Savant + MLB browser caches (call before reload to pick up new deploy data). */
export function clearDataCaches() {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    if (
      k.startsWith('bullpen-rp:mlbStats:') ||
      k.startsWith('bullpen-rp:savantPitcher:') ||
      k.startsWith('bullpen-rp:mlbPerson:') ||
      k.startsWith('bullpen-rp:fangraphsXfip:') ||
      k.startsWith('bullpen-rp:whiffDaily:') ||
      k.startsWith('bullpen-rp:savantDaily:') ||
      k.startsWith('bullpen-rp:savantWhiff:')
    ) {
      keys.push(k)
    }
  }
  keys.forEach((k) => localStorage.removeItem(k))
}

export async function getSavantPitcherMetrics(
  season: number,
  playerId: number,
  signal?: AbortSignal,
): Promise<{ metrics: SavantPitcherMetrics; fetchedAt: string; ok: boolean; error?: string }> {
  const todayLA = getLosAngelesDayStamp()
  const hit = readCache(season, todayLA)
  if (hit) {
    const m = hit.byPlayerId[String(playerId)] ?? { whiffPct: null, xera: null, xfip: null }
    return { metrics: m, fetchedAt: hit.fetchedAt, ok: true }
  }

  // Day changed: don't delete old cached payload yet. If refresh fails, we keep using it.
  const empty = { whiffPct: null, xera: null, xfip: null } satisfies SavantPitcherMetrics
  const fallback = readCacheAny(season)
  const fallbackMetrics = fallback?.byPlayerId[String(playerId)] ?? empty

  const fetchedAt = new Date().toISOString()
  try {
    const res = await fetch(`./data/savant_pitcher_${season}.json`, { signal })
    if (!res.ok) {
      return {
        metrics: fallbackMetrics,
        fetchedAt,
        ok: false,
        error: `No savant data file (${res.status})`,
      }
    }
    const json = (await res.json()) as { byPlayerId?: Record<string, unknown>; fetchedAt?: string }
    const raw = json?.byPlayerId ?? {}
    const byPlayerId: Record<string, SavantPitcherMetrics> = {}
    for (const [id, v] of Object.entries(raw)) {
      byPlayerId[id] = normalizeMetrics(v)
    }
    const playerCount = Object.keys(byPlayerId).length
    if (playerCount > 0) {
      // Only overwrite localStorage if we actually got a meaningful payload.
      writeCache(season, byPlayerId, json.fetchedAt ?? fetchedAt, todayLA)
    }
    const m = byPlayerId[String(playerId)] ?? fallbackMetrics
    return {
      metrics: m,
      fetchedAt: json.fetchedAt ?? fetchedAt,
      ok: playerCount > 0,
      error: playerCount > 0 ? undefined : 'Empty savant payload (kept cached data)',
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fetch failed'
    return { metrics: fallbackMetrics, fetchedAt, ok: false, error: msg }
  }
}

export async function getSavantPitcherMetricsMap(
  season: number,
  signal?: AbortSignal,
): Promise<{
  byPlayerId: Record<string, SavantPitcherMetrics>
  fetchedAt: string
  ok: boolean
  error?: string
}> {
  const todayLA = getLosAngelesDayStamp()
  const hit = readCache(season, todayLA)
  if (hit) {
    return { byPlayerId: hit.byPlayerId, fetchedAt: hit.fetchedAt, ok: true }
  }

  // Keep any previous cached payload as a fallback to avoid wiping values.
  const fallback = readCacheAny(season)
  const fallbackMetrics = fallback?.byPlayerId ?? {}
  const fallbackFetchedAt = fallback?.fetchedAt ?? new Date().toISOString()

  try {
    const res = await fetch(`./data/savant_pitcher_${season}.json`, { signal })
    if (!res.ok) {
      return { byPlayerId: fallbackMetrics, fetchedAt: fallbackFetchedAt, ok: false, error: `HTTP ${res.status}` }
    }
    const json = (await res.json()) as { byPlayerId?: Record<string, unknown>; fetchedAt?: string }
    const raw = json?.byPlayerId ?? {}
    const byPlayerId: Record<string, SavantPitcherMetrics> = {}
    for (const [id, v] of Object.entries(raw)) {
      byPlayerId[id] = normalizeMetrics(v)
    }

    const playerCount = Object.keys(byPlayerId).length
    if (playerCount > 0) {
      writeCache(season, byPlayerId, json.fetchedAt ?? fallbackFetchedAt, todayLA)
      return { byPlayerId, fetchedAt: json.fetchedAt ?? fallbackFetchedAt, ok: true }
    }

    // Empty refresh result: keep the previous cache.
    return { byPlayerId: fallbackMetrics, fetchedAt: fallbackFetchedAt, ok: false, error: 'Empty savant payload' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fetch failed'
    return { byPlayerId: fallbackMetrics, fetchedAt: fallbackFetchedAt, ok: false, error: msg }
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
