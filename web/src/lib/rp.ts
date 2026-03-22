import type {
  CategoryConfig,
  CategoryId,
  MlbPitchingSplit,
  PlayerRow,
  PlayerRpRow,
  RpConfig,
  RpMeta,
} from './types'

export const DEFAULT_RP_CONFIG: RpConfig = {
  // Default to last completed season to avoid empty early-season results.
  season: new Date().getFullYear() - 1,
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
  { id: 'WHIFF', label: 'Whiff%', weight: 0.6, direction: 'higher', enabled: false },
  { id: 'XERA', label: 'xERA', weight: 0.6, direction: 'lower', enabled: false },
  { id: 'XFIP', label: 'xFIP', weight: 0.6, direction: 'lower', enabled: false },
  { id: 'FIP', label: 'FIP', weight: 0.6, direction: 'lower', enabled: false },
  { id: 'WPA', label: 'WPA', weight: 0.3, direction: 'higher', enabled: false },
  { id: 'LOBP', label: 'LOB%', weight: 0.4, direction: 'higher', enabled: false },
  { id: 'BABIP', label: 'BABIP', weight: 0.25, direction: 'lower', enabled: false },
  { id: 'HRFB', label: 'HR/FB', weight: 0.25, direction: 'lower', enabled: false },
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
  return splits.map((s) => {
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
    return {
      playerId: s.player.id,
      name: s.player.fullName,
      team: teamLabel,
      age,
      pitchHand: null,
      rrRole: null,
      rrType: null,
      rrPosition1: null,
      stats,
      raw: s,
    }
  })
}

function relieverFilter(rows: PlayerRow[], cfg: RpConfig) {
  const included: PlayerRow[] = []
  let excluded = 0
  for (const r of rows) {
    const gs = num((r.raw.stat as any)?.gamesStarted) ?? 0
    const g = num((r.raw.stat as any)?.gamesPitched) ?? num((r.raw.stat as any)?.gamesPlayed) ?? 0
    const ip = r.stats.IP ?? 0
    if (gs > cfg.maxStarts) {
      excluded++
      continue
    }
    if (g < cfg.minGames) {
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

export function computeRp(rows: PlayerRow[], cfg: RpConfig, cats: CategoryConfig[]) {
  const enabled = cats.filter((c) => c.enabled && c.weight !== 0)
  const { included, excluded } = relieverFilter(rows, cfg)

  const means: Partial<Record<CategoryId, number>> = {}
  const stdevs: Partial<Record<CategoryId, number>> = {}

  for (const c of enabled) {
    const vals = included
      .map((r) => r.stats[c.id])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const mu = mean(vals)
    const sd = stdev(vals, mu)
    means[c.id] = mu
    stdevs[c.id] = sd
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

    for (const c of enabled) {
      const v = r.stats[c.id]
      const mu = means[c.id]
      const sd = stdevs[c.id]
      if (v == null || mu == null || sd == null || sd === 0) continue

      const adj = c.direction === 'lower' ? -v : v
      const adjMu = c.direction === 'lower' ? -mu : mu
      const zi = (adj - adjMu) / sd
      z[c.id] = zi
      const ci = zi * c.weight
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

