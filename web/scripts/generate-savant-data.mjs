import fs from 'node:fs/promises'
import path from 'node:path'

/** One CSV: whiff%, xERA, xFIP (Statcast). min=1 includes far more pitchers than min=q. */
function buildUrl(season) {
  const params = new URLSearchParams({
    year: String(season),
    type: 'pitcher',
    min: '1',
    selections: 'player_id,whiff_percent,xera,xfip',
    sort: 'player_id',
    sortDir: 'asc',
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

function cell(s) {
  return String(s ?? '')
    .replace(/^"|"$/g, '')
    .trim()
}

function parseSavantPitcherCsv(csv) {
  const players = {}
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return players
  const headerRow = parseCsvLine(lines[0]).map((h) => cell(h))
  const headerRowLower = headerRow.map((h) => h.toLowerCase())
  const col = (name) => headerRowLower.indexOf(name.toLowerCase())
  const idCol = col('player_id')
  const wCol = col('whiff_percent')
  const xeraCol = col('xera')
  const xfipCol = col('xfip')
  if (idCol === -1) return players

  const num = (c) => {
    const s = cell(c)
    // Savant CSV sometimes returns empty cells for xFIP/xERA -> treat as missing.
    if (s === '') return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const id = Number(cell(cols[idCol]))
    if (!Number.isFinite(id)) continue
    players[String(id)] = {
      whiffPct: wCol >= 0 ? num(cols[wCol]) : null,
      xera: xeraCol >= 0 ? num(cols[xeraCol]) : null,
      xfip: xfipCol >= 0 ? num(cols[xfipCol]) : null,
    }
  }
  return players
}

const MIN_SEASON = 2023

async function main() {
  const y = new Date().getUTCFullYear()
  const seasons = []
  for (let i = 0; i < 8; i++) {
    const s = y - i
    if (s >= MIN_SEASON) seasons.push(s)
  }

  const outDir = path.join(process.cwd(), 'public', 'data')
  await fs.mkdir(outDir, { recursive: true })

  try {
    const files = await fs.readdir(outDir)
    for (const f of files) {
      const m = /^savant_pitcher_(\d{4})\.json$/.exec(f)
      if (m && Number(m[1]) < MIN_SEASON) {
        await fs.unlink(path.join(outDir, f))
        console.log(`removed legacy ${f}`)
      }
    }
  } catch {
    // ignore
  }

  for (const season of seasons) {
    const url = buildUrl(season)
    const file = path.join(outDir, `savant_pitcher_${season}.json`)
    try {
      const res = await fetch(url, { headers: { Accept: 'text/csv,*/*' } })
      if (!res.ok) {
        console.warn(`savant ${season}: HTTP ${res.status}`)
        continue
      }
      const csv = await res.text()
      const byPlayerId = parseSavantPitcherCsv(csv)
      const playerCount = Object.keys(byPlayerId).length

      if (playerCount === 0) {
        // Keep existing data if we couldn't refresh meaningfully (e.g. early season).
        let exists = false
        try {
          await fs.stat(file)
          exists = true
        } catch {
          exists = false
        }
        if (exists) {
          console.warn(`savant ${season}: empty result, keeping existing ${path.basename(file)}`)
          continue
        }
      }

      const payload = {
        season,
        fetchedAt: new Date().toISOString(),
        byPlayerId,
      }
      await fs.writeFile(file, JSON.stringify(payload))
      console.log(`wrote ${file} (${playerCount} players)`)
    } catch (e) {
      console.warn(`savant ${season}: refresh failed, keeping existing if any`, e)
      continue
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
