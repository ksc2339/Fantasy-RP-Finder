export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export type MlbPitchingSplit = {
  season: string
  player: { id: number; fullName: string }
  team?: { id: number; name: string }
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
  | 'IP'
  | 'ERA'
  | 'WHIP'
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
  team: string
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

