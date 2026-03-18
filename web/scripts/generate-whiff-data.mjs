import fs from 'node:fs/promises'
import path from 'node:path'

function buildUrl(season) {
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

function parseCsvLine(line) {
  const out = []
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

function parseWhiffMap(csv) {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return {}
  const header = parseCsvLine(lines[0]).map((h) => h.trim())
  const idIdx = header.indexOf('player_id')
  const whiffIdx = header.indexOf('whiff_percent')
  if (idIdx === -1 || whiffIdx === -1) return {}

  const map = {}
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

async function main() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const seasons = [y, y - 1, y - 2]

  const outDir = path.join(process.cwd(), 'public', 'data')
  await fs.mkdir(outDir, { recursive: true })

  for (const season of seasons) {
    const url = buildUrl(season)
    // Fetch in CI (server-side) to avoid browser CORS issues.
    const res = await fetch(url, { headers: { Accept: 'text/csv,*/*' } })
    if (!res.ok) {
      console.warn(`whiff data: season ${season} fetch failed: ${res.status}`)
      continue
    }
    const csv = await res.text()
    const map = parseWhiffMap(csv)
    const payload = {
      season,
      fetchedAt: new Date().toISOString(),
      whiffPctByPlayerId: map,
    }
    const file = path.join(outDir, `whiff_${season}.json`)
    await fs.writeFile(file, JSON.stringify(payload))
    console.log(`wrote ${file} (${Object.keys(map).length} players)`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

