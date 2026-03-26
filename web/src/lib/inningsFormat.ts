/**
 * IP는 내부적으로 실수 이닝(⅓=0.333…, ⅔=0.666…)으로 저장됩니다.
 * 화면·CSV에서는 MLB 관례인 정수.0 / 정수.1 / 정수.2(아웃 0·1·2)로 표시합니다.
 */
export function formatInningsPitched(ip: number | null | undefined): string {
  if (ip == null || !Number.isFinite(ip) || ip < 0) return '—'
  const outs = Math.round(ip * 3)
  const inn = Math.floor(outs / 3)
  const r = outs % 3
  return `${inn}.${r}`
}
