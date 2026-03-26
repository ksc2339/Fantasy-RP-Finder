import type { CategoryId, OopsyPitcherFields, OopsyPitcherPayload } from './types'
import { MIN_SUPPORTED_SEASON } from './seasonPolicy'

export type { OopsyPitcherFields, OopsyPitcherPayload }

const LS_PREFIX = 'bullpen-rp:oopsyPitcher:v2'

function pickN(o: OopsyPitcherFields | undefined, ...keys: (keyof OopsyPitcherFields | string)[]): number | undefined {
  if (!o) return undefined
  for (const k of keys) {
    const v = (o as Record<string, unknown>)[k as string]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return undefined
}

/** 랭킹·드로어 `row.stats`에 OOPSY를 합칩니다(연도 성적과 동일 객체). */
export function mergeOopsyIntoStats(
  stats: Record<CategoryId, number | null>,
  o: OopsyPitcherFields | undefined,
): Record<CategoryId, number | null> {
  if (!o) return stats
  const next = { ...stats }

  const IP = pickN(o, 'IP')
  if (IP != null) next.IP = IP

  const ERA = pickN(o, 'ERA')
  if (ERA != null) next.ERA = ERA

  const WHIP = pickN(o, 'WHIP')
  if (WHIP != null) next.WHIP = WHIP

  const SO = pickN(o, 'SO')
  if (SO != null) next.K = SO

  const BB = pickN(o, 'BB')
  if (BB != null) next.BB = BB

  const HR = pickN(o, 'HR')
  if (HR != null) next.HR = HR

  const W = pickN(o, 'W')
  if (W != null) next.W = W

  const L = pickN(o, 'L')
  if (L != null) next.L = L

  const SV = pickN(o, 'SV')
  if (SV != null) next.SV = SV
  const HLD = pickN(o, 'HLD')
  if (HLD != null) next.HLD = HLD
  const sv2 = next.SV ?? 0
  const hld2 = next.HLD ?? 0
  const svh = sv2 + hld2
  if (SV != null || HLD != null || svh > 0) {
    next.SVH = svh
    const bs = pickN(o, 'BS')
    next.NSVH = svh - (bs ?? 0)
  }

  const H = pickN(o, 'H')
  if (H != null) next.H = H

  const ER = pickN(o, 'ER')
  if (ER != null) next.ER = ER

  const BABIP = pickN(o, 'BABIP')
  if (BABIP != null) next.BABIP = BABIP

  const lob = pickN(o, 'lobPct')
  if (lob != null) next.LOBP = lob

  const QS = pickN(o, 'QS')
  if (QS != null) next.QS = QS

  const GIDP = pickN(o, 'GIDP')
  if (GIDP != null) next.GIDP = GIDP

  const k9 = pickN(o, 'k9', 'K9')
  if (k9 != null) next.K9 = k9

  const bb9 = pickN(o, 'bb9', 'BB9')
  if (bb9 != null) next.BB9 = bb9

  const FIP = pickN(o, 'FIP')
  const xFIP = pickN(o, 'xFIP')
  if (xFIP != null) next.XFIP = xFIP
  if (FIP != null) next.FIP = FIP
  else if (xFIP != null) next.FIP = xFIP
  if (next.XFIP == null && FIP != null) next.XFIP = FIP

  const G = pickN(o, 'G')
  const GS = pickN(o, 'GS')
  if (G != null && GS != null) {
    const rap = G - GS
    if (rap >= 0 && Number.isFinite(rap)) next.RAPP = rap
  }

  return next
}

function dayStampLA(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function key(season: number) {
  return `${LS_PREFIX}:${season}`
}

export async function getOopsyPitcherMap(
  season: number,
  signal?: AbortSignal,
): Promise<{ byPlayerId: Record<string, OopsyPitcherFields>; fetchedAt: string | null; ok: boolean; error?: string }> {
  if (season < MIN_SUPPORTED_SEASON) {
    return { byPlayerId: {}, fetchedAt: null, ok: false, error: `OOPSY는 ${MIN_SUPPORTED_SEASON}시즌 이상만 제공합니다.` }
  }

  const todayLA = dayStampLA()
  const k = key(season)
  const cached = localStorage.getItem(k)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { cachedDay?: string; payload?: OopsyPitcherPayload }
      if (parsed?.cachedDay === todayLA && parsed.payload?.byPlayerId) {
        return { byPlayerId: parsed.payload.byPlayerId, fetchedAt: parsed.payload.fetchedAt, ok: true }
      }
    } catch {
      // ignore
    }
  }

  const fileUrl = `./data/oopsy_pitcher_${season}.json`
  const fallback = { byPlayerId: {}, fetchedAt: null, ok: false, error: 'missing file' } as const
  try {
    const res = await fetch(fileUrl, { signal, cache: 'no-store' })
    if (!res.ok) return fallback
    const payload = (await res.json()) as OopsyPitcherPayload
    if (!payload?.byPlayerId) return fallback
    try {
      localStorage.setItem(k, JSON.stringify({ cachedDay: todayLA, payload }))
    } catch {
      // quota ignore
    }
    return { byPlayerId: payload.byPlayerId, fetchedAt: payload.fetchedAt, ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fetch failed'
    return { byPlayerId: {}, fetchedAt: null, ok: false, error: msg }
  }
}
