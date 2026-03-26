import type {
  CategoryConfig,
  CategoryId,
  MlbPitchingSplit,
  OopsyPitcherFields,
  PlayerRow,
  PlayerRpRow,
  RpConfig,
  RpMeta,
} from './types'
import { MIN_SUPPORTED_SEASON, PROJECTION_SEASON } from './seasonPolicy'
import { mergeOopsyIntoStats } from './oopsyProjectionsData'
import { isRrRoleStartingPitcher } from './rrTypeLabel'

export { MIN_SUPPORTED_SEASON, PROJECTION_SEASON }

export const DEFAULT_RP_CONFIG: RpConfig = {
  // Default to last completed season to avoid empty early-season results.
  season: Math.max(MIN_SUPPORTED_SEASON, new Date().getFullYear() - 1),
  useProjection: false,
  minIP: 10,
  maxStarts: 1,
  minGames: 5,
}

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { id: 'SV', label: 'SV', weight: 1, direction: 'higher', enabled: true },
  { id: 'HLD', label: 'HLD', weight: 1, direction: 'higher', enabled: true },
  { id: 'SVH', label: 'SV+H', weight: 1, direction: 'higher', enabled: false },
  { id: 'NSVH', label: 'NSVH', weight: 1, direction: 'higher', enabled: false },
  { id: 'K', label: 'K', weight: 0.8, direction: 'higher', enabled: true },
  { id: 'ERA', label: 'ERA', weight: 1, direction: 'lower', enabled: true },
  { id: 'WHIP', label: 'WHIP', weight: 1, direction: 'lower', enabled: true },
  { id: 'WHIFF', label: 'Whiff%', weight: 0, direction: 'higher', enabled: false },
  { id: 'XERA', label: 'xERA', weight: 0, direction: 'lower', enabled: false },
  { id: 'XFIP', label: 'xFIP', weight: 0, direction: 'lower', enabled: false },
  { id: 'FIP', label: 'FIP', weight: 0, direction: 'lower', enabled: false },
  { id: 'WPA', label: 'WPA', weight: 0, direction: 'higher', enabled: false },
  { id: 'LOBP', label: 'LOB%', weight: 0, direction: 'higher', enabled: false },
  { id: 'BABIP', label: 'BABIP', weight: 0, direction: 'lower', enabled: false },
  { id: 'HRFB', label: 'HR/FB', weight: 0, direction: 'lower', enabled: false },
  { id: 'W', label: 'W', weight: 0.25, direction: 'higher', enabled: false },
  { id: 'L', label: 'L', weight: 0.25, direction: 'lower', enabled: false },
  { id: 'IP', label: 'IP', weight: 0.25, direction: 'higher', enabled: false },
  { id: 'K9', label: 'K/9', weight: 0.35, direction: 'higher', enabled: false },
  { id: 'BB9', label: 'BB/9', weight: 0.2, direction: 'lower', enabled: false },
  { id: 'BB', label: 'BB', weight: 0.25, direction: 'lower', enabled: false },
  { id: 'HR', label: 'HR', weight: 0.25, direction: 'lower', enabled: false },
  { id: 'GIDP', label: 'GIDP', weight: 0.25, direction: 'higher', enabled: false },
  { id: 'H', label: 'H', weight: 0.25, direction: 'lower', enabled: false },
  { id: 'ER', label: 'ER', weight: 0.25, direction: 'lower', enabled: false },
  { id: 'RAPP', label: 'RAPP', weight: 0.25, direction: 'higher', enabled: false },
  { id: 'QS', label: 'QS', weight: 0.25, direction: 'higher', enabled: false },
]

/** UI order for Settings: fantasy-league stats first; rest are "세부 지표". */
export const FANTASY_LEAGUE_CATEGORY_ORDER: CategoryId[] = [
  'IP',
  'W',
  'L',
  'H',
  'ER',
  'HR',
  'BB',
  'K',
  'GIDP',
  'ERA',
  'WHIP',
  'K9',
  'QS',
  'SV',
  'HLD',
  'SVH',
  'NSVH',
  'RAPP',
]

type CategoryPresetId = 'adl' | 'angels' | 'dor' | 'dbv' | 'twenty' | 'infield' | 'jays'

export const CATEGORY_PRESETS: {
  id: CategoryPresetId
  label: string
  enabledIds: CategoryId[]
  enabledWeight?: number
  enabledWeights?: Partial<Record<CategoryId, number>>
}[] = [
  {
    id: 'adl',
    label: 'ADL',
    enabledIds: ['IP', 'BB', 'K', 'GIDP', 'ERA', 'WHIP', 'RAPP', 'SVH'],
    enabledWeight: 1,
  },
  {
    id: 'angels',
    label: '에인절스',
    enabledIds: ['IP', 'W', 'HR', 'BB', 'K', 'GIDP', 'ERA', 'WHIP', 'RAPP', 'SVH'],
    enabledWeight: 1,
  },
  {
    id: 'dor',
    label: 'DOR',
    enabledIds: ['IP', 'W', 'HR', 'BB', 'K', 'GIDP', 'ERA', 'WHIP', 'RAPP', 'SVH'],
    enabledWeight: 1,
  },
  {
    id: 'dbv',
    label: 'DBV',
    enabledIds: ['IP', 'W', 'H', 'ER', 'BB', 'K', 'GIDP', 'ERA', 'WHIP', 'RAPP', 'SVH'],
    enabledWeight: 1,
  },
  {
    id: 'twenty',
    label: '20인 리그',
    enabledIds: ['IP', 'W', 'L', 'SV', 'HR', 'BB', 'K', 'GIDP', 'HLD', 'ERA', 'WHIP', 'RAPP'],
    enabledWeight: 1,
  },
  {
    id: 'infield',
    label: 'Infield Report',
    enabledIds: ['IP', 'W', 'L', 'SV', 'HR', 'BB', 'K', 'GIDP', 'HLD', 'ERA', 'WHIP', 'RAPP'],
    enabledWeight: 1,
  },
  {
    id: 'jays',
    label: 'Jays Go~',
    enabledIds: ['W', 'L', 'HR', 'BB', 'K', 'GIDP', 'ERA', 'WHIP', 'K9', 'NSVH'],
    enabledWeight: 1,
  },
]

export function applyCategoryPreset(
  categories: CategoryConfig[],
  enabledIds: Set<CategoryId>,
  opts?: { enabledWeight?: number; enabledWeights?: Partial<Record<CategoryId, number>> },
): CategoryConfig[] {
  return categories.map((c) => {
    const enabled = enabledIds.has(c.id)
    if (!enabled) return { ...c, enabled }
    const weightOverride = opts?.enabledWeights?.[c.id] ?? opts?.enabledWeight
    if (weightOverride != null) return { ...c, enabled, weight: weightOverride }
    return { ...c, enabled }
  })
}

function num(x: unknown): number | null {
  if (x == null) return null
  if (typeof x === 'number') return Number.isFinite(x) ? x : null
  if (typeof x === 'string') {
    const t = x.trim()
    if (!t || t === '.---' || t === '---') return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function inningsToFloat(ip: unknown): number | null {
  const s = typeof ip === 'string' ? ip : typeof ip === 'number' ? String(ip) : ''
  const m = s.match(/^(\d+)(?:\.(\d))?$/)
  if (!m) return num(ip)
  const whole = Number(m[1])
  const frac = m[2] ? Number(m[2]) : 0
  if (!Number.isFinite(whole) || !Number.isFinite(frac)) return null
  // MLB uses .1=.333.., .2=.666..
  return whole + (frac === 1 ? 1 / 3 : frac === 2 ? 2 / 3 : 0)
}

function getStat(split: MlbPitchingSplit, key: string): unknown {
  return (split.stat as any)?.[key]
}

/** (H − HR) / (BF − SO − BB − HBP − HR) from MLB season counting stats. */
function pitcherBabip(split: MlbPitchingSplit): number | null {
  const h = num(getStat(split, 'hits'))
  const hr = num(getStat(split, 'homeRuns'))
  const bf = num(getStat(split, 'battersFaced'))
  const k = num(getStat(split, 'strikeOuts'))
  const bb = num(getStat(split, 'baseOnBalls'))
  const hbp = num(getStat(split, 'hitByPitch'))
  if (h == null || hr == null || bf == null || k == null || bb == null || hbp == null) return null
  const bip = bf - k - bb - hbp - hr
  if (!(bip > 0)) return null
  return (h - hr) / bip
}

function reliefAppearances(gamesPitched: number | null, gamesStarted: number | null): number | null {
  if (gamesPitched == null || gamesStarted == null) return null
  const v = gamesPitched - gamesStarted
  if (!Number.isFinite(v) || v < 0) return null
  return v
}

export function buildRows(splits: MlbPitchingSplit[]): PlayerRow[] {
  const out: PlayerRow[] = []
  for (const s of splits) {
    if (!s?.player || typeof s.player.id !== 'number') continue
    const t = s.team
    const teamLabel =
      (t?.abbreviation && String(t.abbreviation).trim()) || t?.name || ''
    const age = num(getStat(s, 'age'))
    const sv = num(getStat(s, 'saves'))
    const hld = num(getStat(s, 'holds'))
    const bs = num(getStat(s, 'blownSaves'))
    const svh = (sv ?? 0) + (hld ?? 0)
    const gamesStarted = num(getStat(s, 'gamesStarted'))
    const gamesPitched = num(getStat(s, 'gamesPitched')) ?? num(getStat(s, 'gamesPlayed')) ?? null
    const ip = inningsToFloat(getStat(s, 'inningsPitched'))
    const earnedRuns = num(getStat(s, 'earnedRuns'))
    const stats: PlayerRow['stats'] = {
      K: num(getStat(s, 'strikeOuts')),
      SV: sv,
      HLD: hld,
      SVH: Number.isFinite(svh) ? svh : null,
      NSVH: Number.isFinite(svh) ? svh - (bs ?? 0) : null,
      W: num(getStat(s, 'wins')),
      L: num(getStat(s, 'losses')),
      BB: num(getStat(s, 'baseOnBalls')),
      HR: num(getStat(s, 'homeRuns')),
      GIDP: num(getStat(s, 'groundIntoDoublePlay')),
      H: num(getStat(s, 'hits')),
      ER: earnedRuns,
      RAPP: reliefAppearances(gamesPitched, gamesStarted),
      // QS comes from FanGraphs (type=8 leaderboards scrape), not MLB Stats API.
      QS: null,
      IP: ip,
      ERA: num(getStat(s, 'era')),
      WHIP: num(getStat(s, 'whip')),
      WHIFF: null,
      XERA: null,
      XFIP: null,
      FIP: null,
      WPA: null,
      LOBP: null,
      BABIP: pitcherBabip(s),
      HRFB: null,
      K9: num(getStat(s, 'strikeoutsPer9Inn')),
      BB9: num(getStat(s, 'walksPer9Inn')),
    }
    out.push({
      playerId: s.player.id,
      name: typeof s.player.fullName === 'string' ? s.player.fullName : '',
      team: teamLabel,
      teamCurrent: null,
      age,
      pitchHand: null,
      rrRole: null,
      rrType: null,
      rrPosition1: null,
      stats,
      raw: s,
    })
  }
  return out
}

/**
 * MLB 시즌 스플릿에 없어도 OOPSY에만 있는 투수를 한 행으로 만듭니다(2026 Proj 등).
 */
export function buildOopsySupplementPlayerRows(
  playerIds: string[],
  namesById: Record<string, string>,
  oopsyByPlayerId: Record<string, OopsyPitcherFields>,
  seasonYear: number,
): PlayerRow[] {
  const out: PlayerRow[] = []
  for (const id of playerIds) {
    const o = oopsyByPlayerId[id]
    if (!o) continue
    if (o.IP == null && o.ERA == null && o.SO == null) continue
    const pid = Number(id)
    if (!Number.isFinite(pid)) continue
    const name = (namesById[id]?.trim() || `Player ${id}`).trim()
    const stub: MlbPitchingSplit = {
      season: String(seasonYear),
      player: { id: pid, fullName: name },
      stat: {
        gamesStarted: 0,
        gamesPitched: 0,
        gamesPlayed: 0,
        inningsPitched: '0.0',
      },
    }
    const built = buildRows([stub])
    const row = built[0]
    if (!row) continue
    row.stats = mergeOopsyIntoStats(row.stats, o) as PlayerRow['stats']
    row.oopsyGs = o.GS != null && Number.isFinite(o.GS) ? o.GS : null
    row.oopsyProjection = o
    out.push(row)
  }
  return out
}

function relieverFilter(rows: PlayerRow[], cfg: RpConfig) {
  const included: PlayerRow[] = []
  let excluded = 0
  const proj = cfg.useProjection && cfg.season === PROJECTION_SEASON
  const skipMinGames = proj
  for (const r of rows) {
    const displayName = typeof r.name === 'string' ? r.name.trim() : ''
    if (!displayName) {
      excluded++
      continue
    }
    if (displayName.includes('-')) {
      excluded++
      continue
    }
    const gs = num((r.raw.stat as any)?.gamesStarted) ?? 0
    const g = num((r.raw.stat as any)?.gamesPitched) ?? num((r.raw.stat as any)?.gamesPlayed) ?? 0
    const ip = r.stats.IP ?? 0
    const projGs = r.oopsyGs != null && Number.isFinite(r.oopsyGs) ? r.oopsyGs : 0
    if (proj && isRrRoleStartingPitcher(r.rrRole)) {
      excluded++
      continue
    }
    // OOPSY(Proj): 실제/프로젝션 GS≥1 또는 프로젝션 이닝 30 이하 제외
    if (proj && (gs >= 1 || projGs >= 1 || ip <= 30)) {
      excluded++
      continue
    }
    if (!proj && gs > cfg.maxStarts) {
      excluded++
      continue
    }
    if (!skipMinGames && g < cfg.minGames) {
      excluded++
      continue
    }
    if (ip < cfg.minIP) {
      excluded++
      continue
    }
    included.push(r)
  }
  return { included, excluded }
}

function mean(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)
}

function stdev(vals: number[], mu: number): number {
  if (vals.length < 2) return 0
  const v = vals.reduce((acc, x) => acc + (x - mu) * (x - mu), 0) / (vals.length - 1)
  return Math.sqrt(v)
}

/** 동률은 평균 순위. 값 오름차순 정렬 후 rank 0..n-1 → 0~1 백분위. */
function percentileByPlayer(
  included: PlayerRow[],
  catId: CategoryId,
  direction: 'higher' | 'lower',
): Map<number, number> {
  const pairs = included
    .map((r) => ({ pid: r.playerId, v: r.stats[catId] }))
    .filter((x): x is { pid: number; v: number } => typeof x.v === 'number' && Number.isFinite(x.v))
  const n = pairs.length
  if (n === 0) return new Map()
  if (n === 1) return new Map([[pairs[0].pid, 0.5]])

  pairs.sort((a, b) => a.v - b.v)
  const ranks = new Array<number>(n).fill(0)
  let j = 0
  while (j < n) {
    let k = j
    while (k < n && pairs[k].v === pairs[j].v) k++
    const avgRank = (j + k - 1) / 2
    for (let t = j; t < k; t++) ranks[t] = avgRank
    j = k
  }

  const out = new Map<number, number>()
  const denom = n - 1
  for (let i = 0; i < n; i++) {
    const rank = ranks[i]
    const pct = direction === 'higher' ? rank / denom : 1 - rank / denom
    out.set(pairs[i].pid, pct)
  }
  return out
}

export function computeRp(rows: PlayerRow[], cfg: RpConfig, cats: CategoryConfig[]) {
  /** 체크된 카테고리 전부(가중치 0 포함): 백분위(0~1)·기여(contrib)·RP 합. */
  const activeCats = cats.filter((c) => c.enabled)
  const { included, excluded } = relieverFilter(rows, cfg)

  const means: Partial<Record<CategoryId, number>> = {}
  const stdevs: Partial<Record<CategoryId, number>> = {}
  const percentileByCat = new Map<CategoryId, Map<number, number>>()

  for (const c of activeCats) {
    const vals = included
      .map((r) => r.stats[c.id])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const mu = mean(vals)
    const sd = stdev(vals, mu)
    means[c.id] = mu
    stdevs[c.id] = sd
    percentileByCat.set(c.id, percentileByPlayer(included, c.id, c.direction))
  }

  const rpRows: PlayerRpRow[] = included.map((r) => {
    const z: PlayerRpRow['z'] = {
      K: null,
      SV: null,
      HLD: null,
      SVH: null,
      NSVH: null,
      W: null,
      L: null,
      IP: null,
      ERA: null,
      WHIP: null,
      BB: null,
      HR: null,
      GIDP: null,
      WHIFF: null,
      XERA: null,
      XFIP: null,
      FIP: null,
      WPA: null,
      LOBP: null,
      BABIP: null,
      HRFB: null,
      RAPP: null,
      QS: null,
      H: null,
      ER: null,
      K9: null,
      BB9: null,
    }
    const contrib: PlayerRpRow['contrib'] = {
      K: null,
      SV: null,
      HLD: null,
      SVH: null,
      NSVH: null,
      W: null,
      L: null,
      IP: null,
      ERA: null,
      WHIP: null,
      BB: null,
      HR: null,
      GIDP: null,
      WHIFF: null,
      XERA: null,
      XFIP: null,
      FIP: null,
      WPA: null,
      LOBP: null,
      BABIP: null,
      HRFB: null,
      RAPP: null,
      QS: null,
      H: null,
      ER: null,
      K9: null,
      BB9: null,
    }
    let rp = 0

    for (const c of activeCats) {
      const pmap = percentileByCat.get(c.id)
      const pct = pmap?.get(r.playerId)
      if (pct == null) continue

      z[c.id] = pct
      const ci = pct * c.weight
      contrib[c.id] = ci
      rp += ci
    }

    return { ...r, rp, z, contrib }
  })

  rpRows.sort((a, b) => b.rp - a.rp)

  const meta: RpMeta = {
    includedCount: included.length,
    excludedCount: excluded,
    categoryMeans: means,
    categoryStdevs: stdevs,
    cfg,
    cats,
  }

  return { rows: rpRows, meta }
}

