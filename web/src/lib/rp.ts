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
  { id: 'W', label: 'W', weight: 0.25, direction: 'higher', enabled: false },
  { id: 'IP', label: 'IP', weight: 0.25, direction: 'higher', enabled: false },
  { id: 'K9', label: 'K/9', weight: 0.35, direction: 'higher', enabled: false },
  { id: 'BB9', label: 'BB/9', weight: 0.2, direction: 'lower', enabled: false },
]

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

export function buildRows(splits: MlbPitchingSplit[]): PlayerRow[] {
  return splits.map((s) => {
    const teamName = s.team?.name ?? ''
    const sv = num(getStat(s, 'saves'))
    const hld = num(getStat(s, 'holds'))
    const bs = num(getStat(s, 'blownSaves'))
    const svh = (sv ?? 0) + (hld ?? 0)
    const stats: PlayerRow['stats'] = {
      K: num(getStat(s, 'strikeOuts')),
      SV: sv,
      HLD: hld,
      SVH: Number.isFinite(svh) ? svh : null,
      NSVH: Number.isFinite(svh) ? svh - (bs ?? 0) : null,
      W: num(getStat(s, 'wins')),
      IP: inningsToFloat(getStat(s, 'inningsPitched')),
      ERA: num(getStat(s, 'era')),
      WHIP: num(getStat(s, 'whip')),
      K9: num(getStat(s, 'strikeoutsPer9Inn')),
      BB9: num(getStat(s, 'walksPer9Inn')),
    }
    return {
      playerId: s.player.id,
      name: s.player.fullName,
      team: teamName,
      stats,
      raw: s,
    }
  })
}

function mean(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)
}

function stdev(vals: number[], mu: number): number {
  if (vals.length < 2) return 0
  const v = vals.reduce((acc, x) => acc + (x - mu) * (x - mu), 0) / (vals.length - 1)
  return Math.sqrt(v)
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
      IP: null,
      ERA: null,
      WHIP: null,
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
      IP: null,
      ERA: null,
      WHIP: null,
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

