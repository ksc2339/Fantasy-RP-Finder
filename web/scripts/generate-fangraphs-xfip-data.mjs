import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * FanGraphs leaderboards xFIP are partially accessible without membership.
 * This script scrapes xFIP/xMLBAMID from the HTML's embedded __NEXT_DATA__.
 * Output is a sparse map: MLBAM playerId -> xFIP (null-missing is simply absent).
 */

function buildUrl(season) {
  // Season-specific pitching leaderboards (type=8 is "standard" dashboard layout).
  // We only scrape what's present in the first HTML payload (no member-only export).
  const start = `${season}-01-01`
  const end = `${season}-12-31`
  // Important:
  // - members-only export is disabled, but HTML payload does contain xFIP/xMLBAMID for the shown page.
  // - pageitems+qual+rost tuning affects how many rows are embedded in __NEXT_DATA__.
  return `https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&type=8&team=0&season=${season}&season1=${season}&startdate=${start}&enddate=${end}&qual=0&rost=0&pageitems=5000`
}

function extractNextData(html) {
  const marker = 'id="__NEXT_DATA__"'
  const startIdx = html.indexOf(marker)
  if (startIdx < 0) return null
  const scriptStart = html.indexOf('>', startIdx)
  if (scriptStart < 0) return null
  const endIdx = html.indexOf('</script>', scriptStart)
  if (endIdx < 0) return null
  const jsonStr = html.slice(scriptStart + 1, endIdx)
  try {
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

function numOrNull(v) {
  if (v == null) return null
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

function collectFanGraphsPitcherFields(nextData) {
  const byPlayerId = {}
  let found = 0

  // Iterative traversal to avoid deep recursion limits.
  const stack = [nextData]
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue

    if (Array.isArray(node)) {
      for (const it of node) stack.push(it)
      continue
    }

    const idNum = numOrNull(node.xMLBAMID)
    if (typeof idNum === 'number') {
      const xFIP = numOrNull(node.xFIP)
      const FIP = numOrNull(node.FIP)
      const WPA = numOrNull(node.WPA)
      const LOBP =
        // FanGraphs uses keys like "LOB%" in the data payload.
        numOrNull(node['LOB%']) ??
        numOrNull(node.LOB_pct) ??
        numOrNull(node.LOBP) ??
        numOrNull(node.LOB_pct_) ??
        numOrNull(node.LOB)
      const HRFB = numOrNull(node['HR/FB'])
      const QS = numOrNull(node.QS)

      // Require xFIP to consider the row present; other fields can be null.
      if (xFIP != null) {
        byPlayerId[String(idNum)] = { xFIP, FIP, WPA, LOBP, HRFB, QS }
        found++
      }
    }

    for (const v of Object.values(node)) stack.push(v)
    if (found >= 20000) break
  }
  return { byPlayerId, found }
}

const MIN_SEASON = 2023

async function main() {
  const y = new Date().getUTCFullYear()
  const seasons = [y - 1, y - 2, y - 3]

  const outDir = path.join(process.cwd(), 'public', 'data')
  await fs.mkdir(outDir, { recursive: true })

  try {
    const files = await fs.readdir(outDir)
    for (const f of files) {
      const m = /^fangraphs_xfip_(\d{4})\.json$/.exec(f)
      if (m && Number(m[1]) < MIN_SEASON) {
        await fs.unlink(path.join(outDir, f))
        console.log(`removed legacy ${f}`)
      }
    }
  } catch {
    // ignore
  }

  for (const season of seasons) {
    if (season < MIN_SEASON) continue
    const url = buildUrl(season)
    try {
      const res = await fetch(url, { headers: { Accept: 'text/html,*/*' } })
      if (!res.ok) {
        console.warn(`fangraphs ${season}: HTTP ${res.status}`)
        continue
      }
      const html = await res.text()
      const nextData = extractNextData(html)
      if (!nextData) {
        console.warn(`fangraphs ${season}: __NEXT_DATA__ not found`)
        continue
      }

      const { byPlayerId, found } = collectFanGraphsPitcherFields(nextData)
      if (Object.keys(byPlayerId).length === 0) {
        console.warn(`fangraphs ${season}: no xFIP found (keep existing if any)`)
        continue
      }

      const payload = {
        season,
        fetchedAt: new Date().toISOString(),
        byPlayerId,
        // Note: no membership -> partial scrape from first payload.
        source: 'fangraphs leaders major-league type=8 (scrape __NEXT_DATA__)',
      }

      const file = path.join(outDir, `fangraphs_xfip_${season}.json`)
      await fs.writeFile(file, JSON.stringify(payload))
      console.log(`wrote ${path.basename(file)} (${Object.keys(byPlayerId).length} players, found=${found})`)
    } catch (e) {
      console.warn(`fangraphs ${season}: refresh failed (keep existing if any)`, e)
      continue
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

