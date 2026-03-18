export function mlbHeadshotUrl(playerId: number, size: 67 | 120 | 360 = 120) {
  // Common MLB headshot endpoint used across many projects.
  // Example: https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_100/v1/people/660271/headshot/120/current
  const s = size
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_${s},q_100/v1/people/${playerId}/headshot/${s}/current`
}

