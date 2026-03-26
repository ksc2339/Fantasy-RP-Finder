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
  minIP: number
  maxStarts: number
  minGames: number
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
}

export type PlayerRpRow = PlayerRow & {
  rp: number
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

