/** Roster Resource row type → 짧은 한글 설명 */
export function fmtRrResourceType(t: string): string {
  if (t === 'mlb-sp' || t === 'mlb-bp') return 'MLB'
  if (t.startsWith('il-')) return 'IL'
  if (t.startsWith('off-')) return 'Minors/대기'
  return t
}

/** FanGraphs RR: `off-sp` / `off-bp` / `off-rp` … 마이너·40인 밖 등(뎁스 표에서 제외할 때 사용) */
export function isRrMinorsOrWaiting(rrType: string | null | undefined): boolean {
  const t = String(rrType ?? '').toLowerCase()
  return t.startsWith('off-')
}

/** 보직(rrRole)이 선발 스팟(SP, SP1, …) */
export function isRrRoleStartingPitcher(rrRole: string | null | undefined): boolean {
  const r = String(rrRole ?? '').trim()
  return /^SP\d*$/i.test(r)
}

/** IL 행인데 포지션이 SP(선발) — 뎁스에서 RP만 볼 때 제외 */
export function isRrIlWithPositionSp(rrType: string | null | undefined, position1: string | null): boolean {
  const t = String(rrType ?? '').toLowerCase()
  const pos = String(position1 ?? '').trim().toUpperCase()
  return t.startsWith('il-') && pos === 'SP'
}

export function isDepthChartExcludedSpStarter(p: {
  rrRole: string
  rrType: string
  position1: string | null
}): boolean {
  return isRrRoleStartingPitcher(p.rrRole) || isRrIlWithPositionSp(p.rrType, p.position1)
}
