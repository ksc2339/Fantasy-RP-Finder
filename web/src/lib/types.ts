export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export type MlbPitchingSplit = {
  season: string
  player: { id: number; fullName: string }
  team?: { id: number; name: string; abbreviation?: string }
  stat: Record<string, string | number | null | undefined>
}

export type SeasonPitchingResponse = {
  fetchedAt: string
  splits: MlbPitchingSplit[]
}

export type CategoryId =
  | 'K'
  | 'SV'
  | 'HLD'
  | 'SVH'
  | 'NSVH'
  | 'W'
  | 'L'
  | 'IP'
  | 'ERA'
  | 'WHIP'
  | 'BB'
  | 'HR'
  | 'GIDP'
  | 'WHIFF'
  | 'XERA'
  | 'XFIP'
  | 'FIP'
  | 'WPA'
  | 'LOBP'
  | 'BABIP'
  | 'HRFB'
  | 'RAPP'
  | 'QS'
  | 'H'
  | 'ER'
  | 'K9'
  | 'BB9'

export type CategoryConfig = {
  id: CategoryId
  label: string
  weight: number
  direction: 'higher' | 'lower'
  enabled: boolean
}

export type RpConfig = {
  season: number
  /** `PROJECTION_SEASON`일 때만 true — OOPSY 프로젝션 기준 랭킹. */
  useProjection: boolean
  minIP: number
  maxStarts: number
  minGames: number
}

/** FanGraphs OOPSY 스크랩 원본(필드는 페이지에 따라 희소). camelCase + 구 JSON의 K9 등 호환. */
export type OopsyPitcherFields = {
  IP?: number | null
  GS?: number | null
  W?: number | null
  L?: number | null
  G?: number | null
  SV?: number | null
  HLD?: number | null
  BS?: number | null
  TBF?: number | null
  H?: number | null
  R?: number | null
  ER?: number | null
  HR?: number | null
  SO?: number | null
  BB?: number | null
  HBP?: number | null
  IBB?: number | null
  ERA?: number | null
  WHIP?: number | null
  BABIP?: number | null
  K9?: number | null
  k9?: number | null
  BB9?: number | null
  bb9?: number | null
  HR9?: number | null
  hr9?: number | null
  FIP?: number | null
  xFIP?: number | null
  WAR?: number | null
  ra9War?: number | null
  QS?: number | null
  GIDP?: number | null
  lobPct?: number | null
  kPct?: number | null
  bbPct?: number | null
  gbPct?: number | null
  kbbPct?: number | null
  avg?: number | null
  FPTS?: number | null
  fptsIp?: number | null
  SPTS?: number | null
  sptsIp?: number | null
  ADP?: number | null
  kbb?: number | null
}

export type OopsyPitcherPayload = {
  season: number
  fetchedAt: string
  byPlayerId: Record<string, OopsyPitcherFields>
  source?: string
}

export type PlayerRow = {
  playerId: number
  name: string
  /** MLB 시즌 스플릿 팀(약어 등) — 랭킹·CSV에 사용 */
  team: string
  /** FanGraphs Roster Resource 기준 현재 팀 표시용(없으면 null) */
  teamCurrent: string | null
  age: number | null
  pitchHand: string | null
  /** FanGraphs Roster Resource depth chart slot (e.g. CL, SP3, MID). */
  rrRole: string | null
  /** Roster Resource row type: mlb-sp, mlb-bp, il-sp, off-sp, … */
  rrType: string | null
  rrPosition1: string | null
  stats: Record<CategoryId, number | null>
  raw: MlbPitchingSplit
  /** OOPSY 프로젝션 선발 등판 수(Proj 필터용). */
  oopsyGs?: number | null
  /** 프로젝션 전체 스냅샷(드로어·추가 지표). */
  oopsyProjection?: OopsyPitcherFields | null
}

export type PlayerRpRow = PlayerRow & {
  rp: number
  /** 풀 대비 z-score (높을수록 해당 카테고리에서 유리). */
  z: Record<CategoryId, number | null>
  contrib: Record<CategoryId, number | null>
}

export type RpMeta = {
  includedCount: number
  excludedCount: number
  categoryMeans: Partial<Record<CategoryId, number>>
  categoryStdevs: Partial<Record<CategoryId, number>>
  cfg: RpConfig
  cats: CategoryConfig[]
}

