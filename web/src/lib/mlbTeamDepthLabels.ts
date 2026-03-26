/** FanGraphs Roster Resource URL slug → 표시용 (스크립트 TEAM_SLUGS 순서와 동일하게 유지) */
export const ROSTER_DEPTH_SLUGS: readonly string[] = [
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

/** 뎁스 UI: 지구(디비전)별 5팀 — FanGraphs slug 기준 */
export type DepthDivisionId =
  | 'al-east'
  | 'al-central'
  | 'al-west'
  | 'nl-east'
  | 'nl-central'
  | 'nl-west'

export const DEPTH_DIVISIONS: readonly {
  id: DepthDivisionId
  label: string
  slugs: readonly string[]
}[] = [
  {
    id: 'al-east',
    label: 'AL 동부',
    slugs: ['blue-jays', 'orioles', 'rays', 'red-sox', 'yankees'],
  },
  {
    id: 'al-central',
    label: 'AL 중부',
    slugs: ['white-sox', 'guardians', 'royals', 'tigers', 'twins'],
  },
  {
    id: 'al-west',
    label: 'AL 서부',
    slugs: ['angels', 'astros', 'athletics', 'mariners', 'rangers'],
  },
  {
    id: 'nl-east',
    label: 'NL 동부',
    slugs: ['braves', 'marlins', 'mets', 'nationals', 'phillies'],
  },
  {
    id: 'nl-central',
    label: 'NL 중부',
    slugs: ['brewers', 'cardinals', 'cubs', 'pirates', 'reds'],
  },
  {
    id: 'nl-west',
    label: 'NL 서부',
    slugs: ['diamondbacks', 'dodgers', 'giants', 'padres', 'rockies'],
  },
]

const SLUG_TO_LABEL: Record<string, { abb: string; name: string }> = {
  angels: { abb: 'LAA', name: 'Angels' },
  astros: { abb: 'HOU', name: 'Astros' },
  athletics: { abb: 'ATH', name: 'Athletics' },
  'blue-jays': { abb: 'TOR', name: 'Blue Jays' },
  braves: { abb: 'ATL', name: 'Braves' },
  brewers: { abb: 'MIL', name: 'Brewers' },
  cardinals: { abb: 'STL', name: 'Cardinals' },
  cubs: { abb: 'CHC', name: 'Cubs' },
  diamondbacks: { abb: 'AZ', name: 'Diamondbacks' },
  dodgers: { abb: 'LAD', name: 'Dodgers' },
  giants: { abb: 'SF', name: 'Giants' },
  guardians: { abb: 'CLE', name: 'Guardians' },
  mariners: { abb: 'SEA', name: 'Mariners' },
  marlins: { abb: 'MIA', name: 'Marlins' },
  mets: { abb: 'NYM', name: 'Mets' },
  nationals: { abb: 'WSH', name: 'Nationals' },
  orioles: { abb: 'BAL', name: 'Orioles' },
  padres: { abb: 'SD', name: 'Padres' },
  phillies: { abb: 'PHI', name: 'Phillies' },
  pirates: { abb: 'PIT', name: 'Pirates' },
  rangers: { abb: 'TEX', name: 'Rangers' },
  rays: { abb: 'TB', name: 'Rays' },
  reds: { abb: 'CIN', name: 'Reds' },
  'red-sox': { abb: 'BOS', name: 'Red Sox' },
  rockies: { abb: 'COL', name: 'Rockies' },
  royals: { abb: 'KC', name: 'Royals' },
  tigers: { abb: 'DET', name: 'Tigers' },
  twins: { abb: 'MIN', name: 'Twins' },
  'white-sox': { abb: 'CWS', name: 'White Sox' },
  yankees: { abb: 'NYY', name: 'Yankees' },
}

export function depthTeamTitle(slug: string): string {
  const m = SLUG_TO_LABEL[slug]
  return m ? `${m.abb} · ${m.name}` : slug
}

/**
 * MLB Stats API 스플릿의 team.abbreviation 과 우리 표의 약어가 다를 때 보정 후 slug 매칭.
 * (예: ARI→AZ, TBR→TB, WSN→WSH)
 */
const MLB_ABB_TO_CANON: Record<string, string> = {
  TBR: 'TB',
  KCR: 'KC',
  SDP: 'SD',
  SFG: 'SF',
  WAS: 'WSH',
  WSN: 'WSH',
  ARI: 'AZ',
}

/** 스플릿 약어 → ROSTER_DEPTH_SLUGS 키 (없으면 null) */
export function mlbAbbrevToDepthSlug(apiAbbr: string): string | null {
  const u = apiAbbr.trim().toUpperCase()
  const canon = MLB_ABB_TO_CANON[u] ?? u
  for (const slug of ROSTER_DEPTH_SLUGS) {
    const row = SLUG_TO_LABEL[slug]
    if (row && row.abb.toUpperCase() === canon) return slug
  }
  return null
}
