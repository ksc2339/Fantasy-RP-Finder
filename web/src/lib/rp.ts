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
  maxStarts: 10,
  minGames: 5,
}

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { id: 'SV', label: 'SV', weight: 1, direction: 'higher', enabled: true },
  { id: 'HLD', label: 'HLD', weight: 0.483, direction: 'higher', enabled: true },
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

type CategoryPresetId =
  | 'adl'
  | 'angels'
  | 'dor'
  | 'dbv'
  | 'twenty'
  | 'infield'
  | 'jays'

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
    enabledWeights: {
      IP: 0.65,
      BB: 0.35,
      GIDP: 0.35,
    },
  },
  {
    id: 'angels',
    label: '에인절스',
    enabledIds: ['IP', 'W', 'HR', 'BB', 'K', 'GIDP', 'ERA', 'WHIP', 'RAPP', 'SVH'],
    enabledWeight: 1,
    enabledWeights: {
      IP: 0.65,
      W: 0.3,
      HR: 0.35,
      BB: 0.35,
      GIDP: 0.35,
    },
  },
  {
    id: 'dor',
    label: 'DOR',
    enabledIds: ['IP', 'W', 'HR', 'BB', 'K', 'GIDP', 'ERA', 'WHIP', 'RAPP', 'SVH'],
    enabledWeight: 1,
    enabledWeights: {
      IP: 0.65,
      W: 0.3,
      HR: 0.35,
      BB: 0.35,
      GIDP: 0.35,
    },
  },
  {
    id: 'dbv',
    label: 'DBV',
    enabledIds: ['IP', 'W', 'H', 'ER', 'BB', 'K', 'GIDP', 'ERA', 'WHIP', 'RAPP', 'SVH'],
    enabledWeight: 1,
    enabledWeights: {
      IP: 0.65,
      W: 0.3,
      H: 0.35,
      ER: 0.35,
      BB: 0.35,
      GIDP: 0.35,
      HR: 0.35,
    },
  },
  {
    id: 'twenty',
    label: '20인 리그',
    enabledIds: ['IP', 'W', 'L', 'SV', 'HR', 'BB', 'K', 'GIDP', 'HLD', 'ERA', 'WHIP', 'RAPP'],
    enabledWeight: 1,
    enabledWeights: {
      HLD: 0.483,
      IP: 0.65,
      W: 0.3,
      L: 0.3,
      HR: 0.35,
      BB: 0.35,
      GIDP: 0.35,
    },
  },
  {
    id: 'infield',
    label: 'Infield Report',
    enabledIds: ['IP', 'W', 'L', 'SV', 'HR', 'BB', 'K', 'GIDP', 'HLD', 'ERA', 'WHIP', 'RAPP'],
    enabledWeight: 1,
    enabledWeights: {
      HLD: 0.483,
      IP: 0.65,
      W: 0.3,
      L: 0.3,
      HR: 0.35,
      BB: 0.35,
      GIDP: 0.35,
    },
  },
  {
    id: 'jays',
    label: 'Jays Go~',
    enabledIds: ['W', 'L', 'HR', 'BB', 'K', 'GIDP', 'ERA', 'WHIP', 'K9', 'NSVH'],
    enabledWeight: 1,
    enabledWeights: {
      W: 0.3,
      L: 0.3,
      HR: 0.35,
      BB: 0.35,
      GIDP: 0.35,
    },
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

/** z/RP 계산 시 숫자로 못 받은 카운팅 스탯은 0으로 간주 (문자열·누락 대응). */
const RANK_COUNTING_DEFAULT_ZERO: ReadonlySet<CategoryId> = new Set([
  'K',
  'SV',
  'HLD',
  'SVH',
  'NSVH',
  'W',
  'L',
  'IP',
  'BB',
  'HR',
  'GIDP',
  'H',
  'ER',
  'RAPP',
  'QS',
])

/** `stats[c.id]`를 num()으로 파싱 — 문자열 "42" 등도 유한 숫자로 인정. */
function rankingValueForZ(row: PlayerRow, c: CategoryConfig): number | null {
  const v = num(row.stats[c.id] as unknown)
  if (v != null && Number.isFinite(v)) return v
  if (RANK_COUNTING_DEFAULT_ZERO.has(c.id)) return 0
  return null
}

function sumN(a: number | null | undefined, b: number | null | undefined): number {
  return (Number.isFinite(a ?? NaN) ? (a as number) : 0) + (Number.isFinite(b ?? NaN) ? (b as number) : 0)
}

function ipWeightedAvg(
  va: number | null | undefined,
  ipa: number | null | undefined,
  vb: number | null | undefined,
  ipb: number | null | undefined,
): number | null {
  const wa = Number.isFinite(ipa ?? NaN) && (ipa as number) > 0 ? (ipa as number) : 0
  const wb = Number.isFinite(ipb ?? NaN) && (ipb as number) > 0 ? (ipb as number) : 0
  const w = wa + wb
  if (!(w > 0)) return va != null && Number.isFinite(va) ? va : vb != null && Number.isFinite(vb) ? vb : null
  const a = Number.isFinite(va ?? NaN) ? (va as number) : 0
  const b = Number.isFinite(vb ?? NaN) ? (vb as number) : 0
  if (va == null && vb == null) return null
  return (a * wa + b * wb) / w
}

function floatIpToMlbOutsString(ip: number): string {
  const outs = Math.round(ip * 3)
  const inn = Math.floor(outs / 3)
  const r = outs % 3
  return `${inn}.${r}`
}

function mergeTwoPlayerStats(a: PlayerRow['stats'], b: PlayerRow['stats']): PlayerRow['stats'] {
  const K = sumN(a.K, b.K)
  const SV = sumN(a.SV, b.SV)
  const HLD = sumN(a.HLD, b.HLD)
  const SVH = SV + HLD
  const W = sumN(a.W, b.W)
  const L = sumN(a.L, b.L)
  const BB = sumN(a.BB, b.BB)
  const HR = sumN(a.HR, b.HR)
  const GIDP = sumN(a.GIDP, b.GIDP)
  const H = sumN(a.H, b.H)
  const ER = sumN(a.ER, b.ER)
  const RAPP = sumN(a.RAPP, b.RAPP)
  const QS = sumN(a.QS, b.QS)
  const IP = sumN(a.IP, b.IP)
  const ERA = IP > 0 ? (ER / IP) * 9 : null
  const WHIP = IP > 0 ? (BB + H) / IP : null
  const K9 = IP > 0 ? (K / IP) * 9 : null
  const BB9 = IP > 0 ? (BB / IP) * 9 : null
  return {
    ...a,
    K,
    SV,
    HLD,
    SVH,
    NSVH: null,
    W,
    L,
    BB,
    HR,
    GIDP,
    H,
    ER,
    RAPP,
    QS,
    IP,
    ERA,
    WHIP,
    K9,
    BB9,
    WHIFF: ipWeightedAvg(a.WHIFF, a.IP, b.WHIFF, b.IP),
    XERA: ipWeightedAvg(a.XERA, a.IP, b.XERA, b.IP),
    XFIP: ipWeightedAvg(a.XFIP, a.IP, b.XFIP, b.IP),
    FIP: ipWeightedAvg(a.FIP, a.IP, b.FIP, b.IP),
    WPA: sumN(a.WPA, b.WPA),
    LOBP: ipWeightedAvg(a.LOBP, a.IP, b.LOBP, b.IP),
    BABIP: null,
    HRFB: ipWeightedAvg(a.HRFB, a.IP, b.HRFB, b.IP),
  }
}

function mergeRawSplitsForMergedRow(splits: MlbPitchingSplit[], mergedIp: number): MlbPitchingSplit {
  const first = splits[0]!
  let gs = 0
  let gp = 0
  for (const s of splits) {
    gs += num(getStat(s, 'gamesStarted')) ?? 0
    gp += num(getStat(s, 'gamesPitched')) ?? num(getStat(s, 'gamesPlayed')) ?? 0
  }
  return {
    ...first,
    stat: {
      ...(first.stat as Record<string, unknown>),
      gamesStarted: gs,
      gamesPitched: gp,
      gamesPlayed: gp,
      inningsPitched: floatIpToMlbOutsString(mergedIp),
    },
  }
}

function mergePlayerRowGroup(rows: PlayerRow[]): PlayerRow {
  if (rows.length === 1) return rows[0]!
  let stats = rows[0]!.stats
  for (let i = 1; i < rows.length; i++) {
    stats = mergeTwoPlayerStats(stats, rows[i]!.stats)
  }
  const ip = stats.IP ?? 0
  let bs = 0
  for (const r of rows) {
    bs += num(getStat(r.raw, 'blownSaves')) ?? 0
  }
  stats.SVH = (stats.SV ?? 0) + (stats.HLD ?? 0)
  stats.NSVH = stats.SVH - bs
  const raw = mergeRawSplitsForMergedRow(
    rows.map((r) => r.raw),
    ip,
  )
  const base = rows[0]!
  return {
    ...base,
    stats,
    raw,
    oopsyGs: base.oopsyGs ?? rows.find((r) => r.oopsyGs != null)?.oopsyGs,
    oopsyProjection: base.oopsyProjection ?? rows.find((r) => r.oopsyProjection != null)?.oopsyProjection,
  }
}

/**
 * 동일 시즌·동일 playerId 스플릿이 여러 줄(트레이드 등)이면 카운팅·IP를 합산해 한 줄로 만듭니다.
 * 랭킹·z가 팀별 분할과 시즌 합계 불일치로 깨지는 것을 막습니다.
 */
export function aggregatePlayerRowsByPlayerId(rows: PlayerRow[]): PlayerRow[] {
  const byId = new Map<number, PlayerRow[]>()
  for (const r of rows) {
    const arr = byId.get(r.playerId) ?? []
    arr.push(r)
    byId.set(r.playerId, arr)
  }
  const out: PlayerRow[] = []
  for (const [, arr] of byId) {
    if (arr.length === 1) out.push(arr[0]!)
    else out.push(mergePlayerRowGroup(arr))
  }
  return out
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
    // API/스텁에 saves·holds 키가 없으면 null → 랭킹·z에서 제외되므로 0으로 통일
    const svN = sv ?? 0
    const hldN = hld ?? 0
    const svh = svN + hldN
    const gamesStarted = num(getStat(s, 'gamesStarted'))
    const gamesPitched = num(getStat(s, 'gamesPitched')) ?? num(getStat(s, 'gamesPlayed')) ?? null
    const ip = inningsToFloat(getStat(s, 'inningsPitched'))
    const earnedRuns = num(getStat(s, 'earnedRuns'))
    const stats: PlayerRow['stats'] = {
      K: num(getStat(s, 'strikeOuts')),
      SV: svN,
      HLD: hldN,
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

export function computeRp(rows: PlayerRow[], cfg: RpConfig, cats: CategoryConfig[]) {
  /** 체크된 카테고리 전부(가중치 0 포함): z-score·기여(contrib)·RP 합. */
  const activeCats = cats.filter((c) => c.enabled)
  const { included, excluded } = relieverFilter(rows, cfg)

  const means: Partial<Record<CategoryId, number>> = {}
  const stdevs: Partial<Record<CategoryId, number>> = {}

  for (const c of activeCats) {
    const vals = included
      .map((r) => rankingValueForZ(r, c))
      .filter((v): v is number => v != null && Number.isFinite(v))
    const mu = mean(vals)
    const sd = stdev(vals, mu)
    means[c.id] = mu
    stdevs[c.id] = sd
  }

  const zByCat: Partial<Record<CategoryId, (number | null)[]>> = {}
  for (const c of activeCats) {
    const mu = means[c.id]
    const sd = stdevs[c.id]
    const col: (number | null)[] = Array(included.length).fill(null)
    if (mu == null || sd == null || sd === 0) {
      zByCat[c.id] = col
      continue
    }
    included.forEach((row, idx) => {
      const v = rankingValueForZ(row, c)
      if (v == null || !Number.isFinite(v)) return
      const adj = c.direction === 'lower' ? -v : v
      const adjMu = c.direction === 'lower' ? -mu : mu
      col[idx] = (adj - adjMu) / sd
    })
    zByCat[c.id] = col
  }

  const rpRows: PlayerRpRow[] = included.map((r, rowIdx) => {
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
      const zi = zByCat[c.id]?.[rowIdx]
      if (zi == null) continue

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

