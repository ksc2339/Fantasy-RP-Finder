/**
 * roster_resource_roles.json 의 byPlayerId에 depth teamSlug·name을 채웁니다.
 * MLB `people?personIds=…&hydrate=currentTeam`으로 **현재 소속**을 쓰므로,
 * 시즌 스플릿에 남아 있는 이전 팀(예: 트레이드 전)과 어긋나지 않습니다.
 * 배포/로컬 유지보수용 — 앱 런타임에는 사용하지 않습니다.
 *
 * Usage (from web/): node scripts/enrich-roster-resource-teamslug.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'

/** mlbTeamDepthLabels SLUG_TO_LABEL.abb → depth slug */
const ABB_TO_SLUG = {
  LAA: 'angels',
  HOU: 'astros',
  ATH: 'athletics',
  TOR: 'blue-jays',
  ATL: 'braves',
  MIL: 'brewers',
  STL: 'cardinals',
  CHC: 'cubs',
  AZ: 'diamondbacks',
  ARI: 'diamondbacks',
  LAD: 'dodgers',
  SF: 'giants',
  SFG: 'giants',
  CLE: 'guardians',
  SEA: 'mariners',
  MIA: 'marlins',
  NYM: 'mets',
  WSH: 'nationals',
  WAS: 'nationals',
  WSN: 'nationals',
  BAL: 'orioles',
  SD: 'padres',
  SDP: 'padres',
  PHI: 'phillies',
  PIT: 'pirates',
  TEX: 'rangers',
  TB: 'rays',
  TBR: 'rays',
  CIN: 'reds',
  BOS: 'red-sox',
  COL: 'rockies',
  KC: 'royals',
  KCR: 'royals',
  DET: 'tigers',
  MIN: 'twins',
  CWS: 'white-sox',
  NYY: 'yankees',
}

function abbrevToSlug(abbrev) {
  if (!abbrev || typeof abbrev !== 'string') return null
  const u = abbrev.trim().toUpperCase()
  return ABB_TO_SLUG[u] ?? null
}

async function fetchTeamIdToAbbreviation() {
  const res = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1&activeStatus=ACTIVE', {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return new Map()
  const json = await res.json()
  const map = new Map()
  for (const t of json.teams ?? []) {
    if (typeof t.id === 'number' && t.abbreviation) map.set(t.id, t.abbreviation)
  }
  return map
}

const CHUNK = 50

async function fetchCurrentTeamsForIds(ids, abbrByTeamId) {
  /** @type {Map<string, { abb: string, name: string }>} */
  const out = new Map()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const url = `https://statsapi.mlb.com/api/v1/people?personIds=${chunk.join(',')}&hydrate=currentTeam`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      console.warn(`people chunk HTTP ${res.status}`)
      continue
    }
    const json = await res.json()
    for (const p of json.people ?? []) {
      const id = p?.id
      if (id == null || !Number.isFinite(Number(id))) continue
      const pid = String(id)
      const tid = p?.currentTeam?.id
      const abb = typeof tid === 'number' ? abbrByTeamId.get(tid) : null
      if (!abb) continue
      const name = typeof p?.fullName === 'string' ? p.fullName.trim() : ''
      out.set(pid, { abb, name })
    }
    await new Promise((r) => setTimeout(r, 120))
  }
  return out
}

async function main() {
  const file = path.join(process.cwd(), 'public', 'data', 'roster_resource_roles.json')
  const raw = JSON.parse(await fs.readFile(file, 'utf8'))
  if (!raw.byPlayerId || typeof raw.byPlayerId !== 'object') {
    console.error('missing byPlayerId')
    process.exit(1)
  }

  const abbrByTeamId = await fetchTeamIdToAbbreviation()
  if (abbrByTeamId.size === 0) {
    console.error('could not load MLB teams list')
    process.exit(1)
  }

  const ids = Object.keys(raw.byPlayerId)
  const latest = await fetchCurrentTeamsForIds(ids, abbrByTeamId)

  let attached = 0
  let skipped = 0
  for (const pid of ids) {
    const row = latest.get(pid)
    const slug = row ? abbrevToSlug(row.abb) : null
    const entry = raw.byPlayerId[pid]
    if (slug) {
      entry.teamSlug = slug
      if (row.name) entry.name = row.name
      attached++
    } else {
      skipped++
    }
  }

  await fs.writeFile(file, JSON.stringify(raw))
  console.log(`wrote ${path.basename(file)} (currentTeam) teamSlug attached=${attached} no_match=${skipped}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
