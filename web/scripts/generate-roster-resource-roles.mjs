import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * FanGraphs Roster Resource depth charts embed pitcher rows in __NEXT_DATA__:
 * mlbamid, role (SP1, CL, MID, …), type (mlb-sp, mlb-bp, il-sp, off-sp, …), position1.
 * Run at deploy; output is keyed by MLBAM player id.
 */

const TEAM_SLUGS = [
  'angels',
  'astros',
  'athletics',
  'blue-jays',
  'braves',
  'brewers',
  'cardinals',
  'cubs',
  'diamondbacks',
  'dodgers',
  'giants',
  'guardians',
  'mariners',
  'marlins',
  'mets',
  'nationals',
  'orioles',
  'padres',
  'phillies',
  'pirates',
  'rangers',
  'rays',
  'reds',
  'red-sox',
  'rockies',
  'royals',
  'tigers',
  'twins',
  'white-sox',
  'yankees',
]

const TYPE_PRIORITY = {
  'mlb-sp': 5,
  'mlb-bp': 5,
  'il-sp': 3,
  'il-bp': 3,
  'off-sp': 1,
  'off-bp': 1,
}

function extractNextData(html) {
  const marker = 'id="__NEXT_DATA__"'
  const startIdx = html.indexOf(marker)
  if (startIdx < 0) return null
  const scriptStart = html.indexOf('>', startIdx)
  if (scriptStart < 0) return null
  const endIdx = html.indexOf('</script>', scriptStart)
  if (endIdx < 0) return null
  try {
    return JSON.parse(html.slice(scriptStart + 1, endIdx))
  } catch {
    return null
  }
}

function collectPitchersFromNextData(nextData) {
  const out = []

  const stack = [nextData]
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    if (Array.isArray(node)) {
      for (const it of node) stack.push(it)
      continue
    }

    const id = node.mlbamid
    const pos = node.position
    const typ = node.type
    if (typeof id === 'number' && (pos === 'SP' || pos === 'RP') && typeof typ === 'string') {
      const role = node.role
      if (role != null && role !== '') {
        out.push({
          key: String(id),
          rrRole: String(role),
          rrType: typ,
          position1: node.position1 != null ? String(node.position1) : null,
        })
      }
    }

    for (const v of Object.values(node)) stack.push(v)
  }
  return out
}

function pickBetter(a, b) {
  const pa = TYPE_PRIORITY[a.rrType] ?? 0
  const pb = TYPE_PRIORITY[b.rrType] ?? 0
  if (pa !== pb) return pa >= pb ? a : b
  return a
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'data')
  await fs.mkdir(outDir, { recursive: true })

  const byPlayerId = {}

  for (const slug of TEAM_SLUGS) {
    const url = `https://www.fangraphs.com/roster-resource/depth-charts/${slug}`
    try {
      const res = await fetch(url, {
        headers: { Accept: 'text/html,*/*', 'User-Agent': 'Mozilla/5.0 Chrome/120' },
      })
      if (!res.ok) {
        console.warn(`roster-resource ${slug}: HTTP ${res.status}`)
        continue
      }
      const html = await res.text()
      const nextData = extractNextData(html)
      if (!nextData) {
        console.warn(`roster-resource ${slug}: no __NEXT_DATA__`)
        continue
      }
      const rows = collectPitchersFromNextData(nextData)
      for (const row of rows) {
        const { key, ...entry } = row
        const prev = byPlayerId[key]
        byPlayerId[key] = prev ? pickBetter(prev, entry) : entry
      }
      console.log(`roster-resource ${slug}: +${rows.length} pitcher rows`)
    } catch (e) {
      console.warn(`roster-resource ${slug}:`, e)
    }
    await sleep(200)
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    byPlayerId,
    source: 'fangraphs roster-resource depth-charts __NEXT_DATA__ (all 30 teams)',
  }

  const file = path.join(outDir, 'roster_resource_roles.json')
  await fs.writeFile(file, JSON.stringify(payload))
  console.log(`wrote ${path.basename(file)} (${Object.keys(byPlayerId).length} players)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
