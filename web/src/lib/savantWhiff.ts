type WhiffResult =
  | { ok: true; whiffPct: number | null; fetchedAt: string }
  | { ok: false; error: string; fetchedAt: string }

/** One refresh per calendar day per season (localStorage write at most once/day for Whiff data). */
const LS_DAILY_KEY_PREFIX = 'bullpen-rp:whiffDaily:v2'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function dailyKey(season: number) {
  return `${LS_DAILY_KEY_PREFIX}:${season}`
}

function buildUrl(season: number) {
  const params = new URLSearchParams({
    year: String(season),
    type: 'pitcher',
    min: 'q',
    selections: 'player_id,whiff_percent',
    sort: 'whiff_percent',
    sortDir: 'desc',
    csv: 'true',
  })
  return `https://baseballsavant.mlb.com/leaderboard/custom?${params.toString()}`
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let i = 0
  let inQuotes = false
  while (i < line.length) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1]
        if (next === '"') {
          cur += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cur += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      out.push(cur)
      cur = ''
      i++
      continue
    }
    cur += ch
    i++
  }
  out.push(cur)
  return out
}

function parseWhiffMapFromCsv(csv: string): Record<string, number> {
  const map: Record<string, number> = {}
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return map
  const header = parseCsvLine(lines[0]).map((h) => h.trim())
  const idIdx = header.indexOf('player_id')
  const whiffIdx = header.indexOf('whiff_percent')
  if (idIdx === -1 || whiffIdx === -1) return map
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const idStr = (cols[idIdx] ?? '').trim()
    const wStr = (cols[whiffIdx] ?? '').trim()
    const id = Number(idStr)
    const w = Number(wStr)
    if (!Number.isFinite(id) || !Number.isFinite(w)) continue
    map[String(id)] = w
  }
  return map
}

type DailyPayload = {
  cachedAt: number
  fetchedAt: string
  whiffPctByPlayerId: Record<string, number>
}

function readDailyCache(season: number): DailyPayload | null {
  try {
    const raw = localStorage.getItem(dailyKey(season))
    if (!raw) return null
    const p = JSON.parse(raw) as DailyPayload
    if (typeof p?.cachedAt !== 'number' || !p.whiffPctByPlayerId) return null
    if (Date.now() - p.cachedAt >= ONE_DAY_MS) return null
    return p
  } catch {
    return null
  }
}

function writeDailyCache(season: number, map: Record<string, number>, fetchedAt: string) {
  const payload: DailyPayload = {
    cachedAt: Date.now(),
    fetchedAt,
    whiffPctByPlayerId: map,
  }
  try {
    localStorage.setItem(dailyKey(season), JSON.stringify(payload))
  } catch {
    // Quota exceeded: skip persist; in-memory use still works this session
  }
}

/** Load full Whiff% map for season; at most one network + one localStorage write per 24h. */
async function loadWhiffMapForSeason(season: number, signal?: AbortSignal): Promise<{
  map: Record<string, number>
  fetchedAt: string
  ok: boolean
  error?: string
}> {
  const cached = readDailyCache(season)
  if (cached) {
    return { map: cached.whiffPctByPlayerId, fetchedAt: cached.fetchedAt, ok: true }
  }

  const fetchedAt = new Date().toISOString()

  try {
    const res = await fetch(`./data/whiff_${season}.json`, { signal })
    if (res.ok) {
      const json = (await res.json()) as { whiffPctByPlayerId?: Record<string, unknown> }
      const raw = json?.whiffPctByPlayerId ?? {}
      const map: Record<string, number> = {}
      for (const [k, v] of Object.entries(raw)) {
        const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
        if (Number.isFinite(n)) map[k] = n
      }
      if (Object.keys(map).length > 0) {
        writeDailyCache(season, map, fetchedAt)
        return { map, fetchedAt, ok: true }
      }
    }
  } catch {
    // fall through
  }

  try {
    const res = await fetch(buildUrl(season), { signal, headers: { Accept: 'text/csv,*/*' } })
    if (!res.ok) {
      return { map: {}, fetchedAt, ok: false, error: `Savant HTTP ${res.status}` }
    }
    const csv = await res.text()
    const map = parseWhiffMapFromCsv(csv)
    writeDailyCache(season, map, fetchedAt)
    return { map, fetchedAt, ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fetch failed'
    return { map: {}, fetchedAt, ok: false, error: msg }
  }
}

export async function fetchWhiffPct(opts: {
  season: number
  playerId: number
  signal?: AbortSignal
}): Promise<WhiffResult> {
  const { map, fetchedAt, ok, error } = await loadWhiffMapForSeason(opts.season, opts.signal)
  if (!ok) {
    return { ok: false, error: error ?? 'No Whiff data', fetchedAt }
  }
  const w = map[String(opts.playerId)]
  return {
    ok: true,
    whiffPct: w !== undefined && Number.isFinite(w) ? w : null,
    fetchedAt,
  }
}
