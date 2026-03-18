export function mlbHeadshotUrl(playerId: number, size: 67 | 120 | 360 = 120) {
  // Silo headshot format with built-in generic fallback (no repo assets needed).
  // Based on patterns used by community tooling (e.g. mlbplotR).
  //
  // Example:
  // https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png/r_max/w_120,q_auto:best/v1/people/660271/headshot/silo/current
  const s = size
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png/r_max/w_${s},q_auto:best/v1/people/${playerId}/headshot/silo/current`
}

