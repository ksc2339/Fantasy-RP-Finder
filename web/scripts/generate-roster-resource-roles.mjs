import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * FanGraphs Roster Resource depth charts embed pitcher rows in __NEXT_DATA__:
 * mlbamid, role (SP1, CL, MID, …), type (mlb-sp, mlb-bp, il-sp, off-sp, …), position1.
 * Run at deploy; output: `byPlayerId`(RP·뎁스 공통, teamSlug·name 포함), `byTeam`(30팀 뎁스용 중복).
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

function extractPlayerName(node) {
  if (typeof node.name === 'string' && node.name.trim()) return node.name.trim()
  if (typeof node.playerName === 'string' && node.playerName.trim()) return node.playerName.trim()
  if (node.player && typeof node.player === 'object') {
    const p = node.player
    if (typeof p.name === 'string' && p.name.trim()) return p.name.trim()
    if (typeof p.fullName === 'string' && p.fullName.trim()) return p.fullName.trim()
  }
  return null
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
          name: extractPlayerName(node),
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

/** IL/부상 행은 활성(mlb-*) 행과 같이 있을 때 우선(__NEXT_DATA__에 중복 노드가 있을 수 있음). */
function isInjuryLike(row) {
  const t = String(row.rrType || '').toLowerCase()
  if (t.startsWith('il') || t.includes('il-')) return true
  const r = String(row.rrRole || '').trim().toLowerCase()
  if (r === 'inj' || r === 'il' || r.includes('il') || r.includes('60')) return true
  return false
}

function pickBetter(a, b) {
  const aInj = isInjuryLike(a)
  const bInj = isInjuryLike(b)
  if (aInj !== bInj) return aInj ? a : b
  const pa = TYPE_PRIORITY[a.rrType] ?? 0
  const pb = TYPE_PRIORITY[b.rrType] ?? 0
  if (pa !== pb) return pa >= pb ? a : b
  return a
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function pickBetterTeamRow(a, b) {
  const aInj = isInjuryLike(a)
  const bInj = isInjuryLike(b)
  if (aInj !== bInj) return aInj ? a : b
  const pa = TYPE_PRIORITY[a.rrType] ?? 0
  const pb = TYPE_PRIORITY[b.rrType] ?? 0
  if (pa !== pb) return pa >= pb ? a : b
  return a.name ? a : b.name ? b : a
}

function compareDepthRoles(a, b) {
  const ma = /^SP(\d+)$/i.exec(a.trim())
  const mb = /^SP(\d+)$/i.exec(b.trim())
  if (ma && mb) return parseInt(ma[1], 10) - parseInt(mb[1], 10)
  if (ma && !mb) return -1
  if (!ma && mb) return 1
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'data')
  await fs.mkdir(outDir, { recursive: true })

  const byPlayerId = {}
  /** @type {Record<string, { slug: string, pitchers: Array<{ playerId: string, name: string | null, rrRole: string, rrType: string, position1: string | null }> }>} */
  const byTeam = {}

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
      const teamMap = {}
      for (const row of rows) {
        const { key, name, rrRole, rrType, position1 } = row
        const teamEntry = { playerId: key, name, rrRole, rrType, position1 }
        const prevT = teamMap[key]
        teamMap[key] = prevT ? pickBetterTeamRow(prevT, teamEntry) : teamEntry
        const globalEntry = { rrRole, rrType, position1, name, teamSlug: slug }
        const prevG = byPlayerId[key]
        byPlayerId[key] = prevG ? pickBetter(prevG, globalEntry) : globalEntry
      }
      const pitchers = Object.values(teamMap).sort((x, y) => compareDepthRoles(x.rrRole, y.rrRole))
      byTeam[slug] = { slug, pitchers }
      console.log(`roster-resource ${slug}: +${rows.length} pitcher rows`)
    } catch (e) {
      console.warn(`roster-resource ${slug}:`, e)
    }
    await sleep(200)
  }

  if (Object.keys(byPlayerId).length === 0) {
    console.error(
      'roster-resource: 스크랩 결과가 비었습니다(403 등). 기존 roster_resource_roles.json 을 덮어쓰지 않습니다.',
    )
    process.exit(1)
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    byPlayerId,
    byTeam,
    source: 'fangraphs roster-resource depth-charts __NEXT_DATA__ (all 30 teams)',
  }

  const file = path.join(outDir, 'roster_resource_roles.json')
  await fs.writeFile(file, JSON.stringify(payload))
  console.log(
    `wrote ${path.basename(file)} (${Object.keys(byPlayerId).length} players, ${Object.keys(byTeam).length} teams)`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
