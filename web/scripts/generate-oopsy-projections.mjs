import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Scrape FanGraphs OOPSY projections from HTML __NEXT_DATA__.
 * Output: `public/data/oopsy_pitcher_${season}.json` (playerId -> projected stats).
 * 같은 playerId가 여러 노드에 흩어져 있으면 숫자 필드를 병합합니다.
 */

const MIN_SEASON = 2023

function buildUrl(season) {
  return `https://www.fangraphs.com/projections?pos=all&stats=pit&type=oopsy&lg=all&team=0&pageitems=5000&players=0&season=${season}`
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

function findPlayerId(node) {
  const candidates = [node?.xMLBAMID, node?.xMlbamId, node?.mlbamid, node?.mlbAMID, node?.playerId, node?.playerid]
  for (const c of candidates) {
    const n = numOrNull(c)
    if (typeof n === 'number' && n > 0) return String(Math.trunc(n))
  }
  return null
}

function pickStat(node, keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(node, k)) {
      const n = numOrNull(node[k])
      if (n != null) return n
    }
  }
  return null
}

function mergeInto(byPlayerId, pid, patch) {
  let cur = byPlayerId[pid]
  if (!cur) cur = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v != null && typeof v === 'number' && Number.isFinite(v)) {
      cur[k] = v
    }
  }
  if (Object.keys(cur).length > 0) byPlayerId[pid] = cur
}

/** FanGraphs 투수 OOPSY 행에서 숫자 스탯 최대한 수집(camelCase 저장). */
function collectPatchFromNode(node) {
  const IP = pickStat(node, ['IP', 'ip', 'Inn', 'innings'])
  const GS = pickStat(node, ['GS', 'gs', 'gamesStarted'])
  const W = pickStat(node, ['W', 'w', 'wins'])
  const L = pickStat(node, ['L', 'l', 'losses'])
  const G = pickStat(node, ['G', 'g', 'games', 'gamesPitched'])
  const SV = pickStat(node, ['SV', 'sv', 'saves'])
  const HLD = pickStat(node, ['HLD', 'hld', 'holds'])
  const BS = pickStat(node, ['BS', 'bs', 'blownSaves'])
  const TBF = pickStat(node, ['TBF', 'BF', 'battersFaced'])
  const H = pickStat(node, ['H', 'h', 'hits'])
  const R = pickStat(node, ['R', 'r', 'runs'])
  const ER = pickStat(node, ['ER', 'er', 'earnedRuns'])
  const HR = pickStat(node, ['HR', 'hr', 'homeRuns'])
  const SO = pickStat(node, ['SO', 'K', 'SO_x', 'strikeouts', 'SO.1'])
  const BB = pickStat(node, ['BB', 'BB_x', 'walks', 'baseOnBalls'])
  const HBP = pickStat(node, ['HBP', 'hbp'])
  const IBB = pickStat(node, ['IBB', 'ibb'])
  const ERA = pickStat(node, ['ERA', 'era'])
  const WHIP = pickStat(node, ['WHIP', 'whip'])
  const BABIP = pickStat(node, ['BABIP', 'babip'])
  const k9 = pickStat(node, ['K/9', 'SO/9', 'K9', 'K_9'])
  const bb9 = pickStat(node, ['BB/9', 'BB9', 'BB_9'])
  const hr9 = pickStat(node, ['HR/9', 'HR9', 'HR_9'])
  const kbb = pickStat(node, ['K/BB', 'K_BB', 'KBB'])
  const FIP = pickStat(node, ['FIP', 'fip'])
  const xFIP = pickStat(node, ['xFIP', 'xfip'])
  const WAR = pickStat(node, ['WAR', 'war', 'WAR.1'])
  const ra9War = pickStat(node, ['RA9-WAR', 'RA9_WAR', 'RA9WAR'])
  const QS = pickStat(node, ['QS', 'qs'])
  const GIDP = pickStat(node, ['GIDP', 'gidp'])
  const lobPct = pickStat(node, ['LOB%', 'LOB'])
  const kPct = pickStat(node, ['K%', 'K_pct'])
  const bbPct = pickStat(node, ['BB%', 'BB_pct'])
  const gbPct = pickStat(node, ['GB%', 'GB_pct'])
  const kbbPct = pickStat(node, ['K-BB%', 'K-BB_pct', 'KBB%'])
  const avg = pickStat(node, ['AVG', 'avg'])
  const FPTS = pickStat(node, ['FPTS', 'fpts'])
  const fptsIp = pickStat(node, ['FPTS_IP', 'FPTS/IP'])
  const SPTS = pickStat(node, ['SPTS', 'spts'])
  const sptsIp = pickStat(node, ['SPTS_IP', 'SPTS/IP'])
  const ADP = pickStat(node, ['ADP', 'adp'])

  return {
    IP,
    GS,
    W,
    L,
    G,
    SV,
    HLD,
    BS,
    TBF,
    H,
    R,
    ER,
    HR,
    SO,
    BB,
    HBP,
    IBB,
    ERA,
    WHIP,
    BABIP,
    k9,
    bb9,
    hr9,
    kbb,
    FIP,
    xFIP,
    WAR,
    ra9War,
    QS,
    GIDP,
    lobPct,
    kPct,
    bbPct,
    gbPct,
    kbbPct,
    avg,
    FPTS,
    fptsIp,
    SPTS,
    sptsIp,
    ADP,
  }
}

function collectOopsyPitcherProjections(nextData) {
  const byPlayerId = {}
  let seenNodesWithId = 0

  const stack = [nextData]
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    if (Array.isArray(node)) {
      for (const it of node) stack.push(it)
      continue
    }

    const pid = findPlayerId(node)
    if (pid) {
      seenNodesWithId++
      const patch = collectPatchFromNode(node)
      mergeInto(byPlayerId, pid, patch)
    }

    for (const v of Object.values(node)) stack.push(v)
  }

  // 최소 한 가지라도 있어야 행 유지
  for (const pid of Object.keys(byPlayerId)) {
    const row = byPlayerId[pid]
    const ok =
      row.IP != null ||
      row.ERA != null ||
      row.WHIP != null ||
      row.SO != null ||
      row.k9 != null
    if (!ok) delete byPlayerId[pid]
  }

  return { byPlayerId, seenNodesWithId }
}

async function main() {
  const y = new Date().getUTCFullYear()
  const seasons = []
  for (let s = MIN_SEASON; s <= y; s++) seasons.push(s)

  const outDir = path.join(process.cwd(), 'public', 'data')
  await fs.mkdir(outDir, { recursive: true })

  try {
    const files = await fs.readdir(outDir)
    for (const f of files) {
      const m = /^oopsy_pitcher_(\d{4})\.json$/.exec(f)
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
    try {
      const res = await fetch(url, { headers: { Accept: 'text/html,*/*', 'User-Agent': 'Mozilla/5.0 Chrome/120' } })
      if (!res.ok) {
        console.warn(`oopsy ${season}: HTTP ${res.status}`)
        continue
      }
      const html = await res.text()
      const nextData = extractNextData(html)
      if (!nextData) {
        console.warn(`oopsy ${season}: __NEXT_DATA__ not found`)
        continue
      }

      const { byPlayerId, seenNodesWithId } = collectOopsyPitcherProjections(nextData)
      const n = Object.keys(byPlayerId).length
      if (n === 0) {
        console.warn(`oopsy ${season}: empty result (seenNodesWithId=${seenNodesWithId}), keeping existing if any`)
        continue
      }

      const payload = {
        season,
        fetchedAt: new Date().toISOString(),
        byPlayerId,
        source: 'fangraphs projections type=oopsy (scrape __NEXT_DATA__)',
      }
      const file = path.join(outDir, `oopsy_pitcher_${season}.json`)
      await fs.writeFile(file, JSON.stringify(payload))
      console.log(`wrote ${path.basename(file)} (${n} players)`)
    } catch (e) {
      console.warn(`oopsy ${season}: refresh failed (keep existing if any)`, e)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
