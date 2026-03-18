type WhiffResult =
  | { ok: true; whiffPct: number | null; fetchedAt: string }
  | { ok: false; error: string; fetchedAt: string }

const LS_PREFIX = 'bullpen-rp:savantWhiff:v1'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function key(season: number, playerId: number) {
  return `${LS_PREFIX}:${season}:${playerId}`
}

function buildUrl(season: number) {
  // Baseball Savant custom leaderboard supports whiff_percent, and can be downloaded as CSV.
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

function parseWhiffPctFromCsv(csv: string, playerId: number): number | null {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return null
  const header = parseCsvLine(lines[0]).map((h) => h.trim())
  const idIdx = header.indexOf('player_id')
  const whiffIdx = header.indexOf('whiff_percent')
  if (idIdx === -1 || whiffIdx === -1) return null

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const idStr = cols[idIdx]?.trim()
    if (!idStr) continue
    if (Number(idStr) !== playerId) continue
    const w = cols[whiffIdx]?.trim()
    if (!w) return null
    const n = Number(w)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export async function fetchWhiffPct(opts: {
  season: number
  playerId: number
  signal?: AbortSignal
}): Promise<WhiffResult> {
  const fetchedAt = new Date().toISOString()
  const k = key(opts.season, opts.playerId)
  const cached = localStorage.getItem(k)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as (WhiffResult & { cachedAt?: number })
      if (typeof parsed?.cachedAt === 'number' && Date.now() - parsed.cachedAt < ONE_DAY_MS) {
        return { ...parsed, fetchedAt: parsed.fetchedAt ?? fetchedAt }
      }
    } catch {
      // ignore corrupted cache
    }
  }

  const url = buildUrl(opts.season)
  try {
    const res = await fetch(url, { signal: opts.signal, headers: { Accept: 'text/csv,*/*' } })
    if (!res.ok) {
      const out: WhiffResult & { cachedAt: number } = {
        ok: false,
        error: `Savant HTTP ${res.status}`,
        fetchedAt,
        cachedAt: Date.now(),
      }
      localStorage.setItem(k, JSON.stringify(out))
      return out
    }
    const csv = await res.text()
    const whiffPct = parseWhiffPctFromCsv(csv, opts.playerId)
    const out: WhiffResult & { cachedAt: number } = { ok: true, whiffPct, fetchedAt, cachedAt: Date.now() }
    localStorage.setItem(k, JSON.stringify(out))
    return out
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fetch failed'
    const out: WhiffResult & { cachedAt: number } = { ok: false, error: msg, fetchedAt, cachedAt: Date.now() }
    localStorage.setItem(k, JSON.stringify(out))
    return out
  }
}

