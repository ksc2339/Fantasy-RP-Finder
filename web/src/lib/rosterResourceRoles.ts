export type RosterResourcePitcherFields = {
  rrRole: string
  rrType: string
  position1: string | null
}

export type RosterResourceRolesPayload = {
  fetchedAt: string
  byPlayerId: Record<string, RosterResourcePitcherFields>
  source?: string
}

const LS_PREFIX = 'bullpen-rp:rosterResource:v1'

function dayStampLA(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function cacheKey() {
  return `${LS_PREFIX}:day`
}

export type RosterResourceRolesRes = {
  byPlayerId: Record<string, RosterResourcePitcherFields>
  fetchedAt: string | null
  ok: boolean
  error?: string
}

/**
 * Baked map from deploy script (30 team depth charts). Not tied to stats season;
 * reflects Roster Resource snapshot at generation time.
 */
export async function getRosterResourceRolesMap(signal?: AbortSignal): Promise<RosterResourceRolesRes> {
  const todayLA = dayStampLA()
  const k = cacheKey()
  const cached = localStorage.getItem(k)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { cachedDay?: string; payload?: RosterResourceRolesPayload }
      if (parsed?.cachedDay === todayLA && parsed.payload?.byPlayerId) {
        return { byPlayerId: parsed.payload.byPlayerId, fetchedAt: parsed.payload.fetchedAt, ok: true }
      }
    } catch {
      // ignore
    }
  }

  const fileUrl = './data/roster_resource_roles.json'
  const fallback: RosterResourceRolesRes = { byPlayerId: {}, fetchedAt: null, ok: false, error: 'missing file' }
  try {
    const res = await fetch(fileUrl, { signal })
    if (!res.ok) return fallback
    const payload = (await res.json()) as RosterResourceRolesPayload
    if (!payload?.byPlayerId) return fallback
    try {
      localStorage.setItem(k, JSON.stringify({ cachedDay: todayLA, payload }))
    } catch {
      // quota
    }
    return { byPlayerId: payload.byPlayerId, fetchedAt: payload.fetchedAt, ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fetch failed'
    return { byPlayerId: {}, fetchedAt: null, ok: false, error: msg }
  }
}
