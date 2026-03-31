import { useEffect, useMemo, useState } from 'preact/hooks'
import type { PlayerRow, PlayerRpRow, RpConfig } from '../lib/types'
import { PROJECTION_SEASON } from '../lib/rp'
import styles from './TargetPlanner.module.css'

type Props = {
  rows: PlayerRow[]
  relieverRows: PlayerRpRow[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  cfg: RpConfig
  setCfg: (next: RpConfig) => void
}

type StatKey = 'SV' | 'SVH'

function toNum(v: number | null | undefined): number {
  return v != null && Number.isFinite(v) ? v : 0
}

function sumStat(rows: PlayerRow[], key: StatKey): number {
  return rows.reduce((acc, r) => acc + toNum(r.stats[key]), 0)
}

function sortByCloserValue(rows: PlayerRow[]): PlayerRow[] {
  return [...rows].sort((a, b) => {
    const svhDiff = toNum(b.stats.SVH) - toNum(a.stats.SVH)
    if (svhDiff !== 0) return svhDiff
    const svDiff = toNum(b.stats.SV) - toNum(a.stats.SV)
    if (svDiff !== 0) return svDiff
    return a.name.localeCompare(b.name)
  })
}

function snakeDistribute(pool: PlayerRow[], leagueSize: number): { sv: number; svh: number }[] {
  const teams = Array.from({ length: leagueSize }, () => ({ sv: 0, svh: 0 }))
  for (let i = 0; i < pool.length; i++) {
    const round = Math.floor(i / leagueSize)
    const pos = i % leagueSize
    const teamIdx = round % 2 === 0 ? pos : leagueSize - 1 - pos
    teams[teamIdx].sv += toNum(pool[i]?.stats.SV)
    teams[teamIdx].svh += toNum(pool[i]?.stats.SVH)
  }
  return teams
}

function calcBenchmarks(
  allRows: PlayerRow[],
  relieverRows: PlayerRow[],
  leagueSize: 12 | 16 | 20,
  rpSlots: number,
  pSlots: number,
) {
  const rpPool = sortByCloserValue(relieverRows).slice(0, leagueSize * rpSlots)
  const pPool = sortByCloserValue(allRows).slice(0, leagueSize * pSlots)
  const rpTeams = snakeDistribute(rpPool, leagueSize)
  const pTeams = snakeDistribute(pPool, leagueSize)
  const teams = rpTeams.map((t, idx) => ({
    sv: t.sv + pTeams[idx]!.sv,
    svh: t.svh + pTeams[idx]!.svh,
  }))

  const svSorted = teams.map((t) => t.sv).sort((a, b) => b - a)
  const svhSorted = teams.map((t) => t.svh).sort((a, b) => b - a)
  const avgSv = svSorted.reduce((a, b) => a + b, 0) / Math.max(1, svSorted.length)
  const avgSvh = svhSorted.reduce((a, b) => a + b, 0) / Math.max(1, svhSorted.length)
  const topThirdRank = Math.max(1, Math.ceil(leagueSize / 3))

  return {
    avgSv,
    avgSvh,
    targetSv: svSorted[topThirdRank - 1] ?? 0,
    targetSvh: svhSorted[topThirdRank - 1] ?? 0,
  }
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : '0.0'
}

function formatSlotStats(r: PlayerRow | undefined): string {
  if (!r) return 'SV 0 / SV+H 0'
  return `SV ${Math.round(toNum(r.stats.SV))} / SV+H ${Math.round(toNum(r.stats.SVH))}`
}

function buildLabel(r: PlayerRow): string {
  const sv = Math.round(toNum(r.stats.SV))
  const svh = Math.round(toNum(r.stats.SVH))
  return `${r.name} (${r.team || '—'}) · SV ${sv} / SV+H ${svh} [${r.playerId}]`
}

export function TargetPlanner({ rows, relieverRows, status, cfg, setCfg }: Props) {
  const [leagueSize, setLeagueSize] = useState<12 | 16 | 20>(12)
  const [rpSlots, setRpSlots] = useState<number>(5)
  const [pSlots, setPSlots] = useState<number>(3)
  const [rpQueries, setRpQueries] = useState<string[]>(Array.from({ length: 5 }, () => ''))
  const [pQueries, setPQueries] = useState<string[]>(Array.from({ length: 3 }, () => ''))

  useEffect(() => {
    setRpQueries((prev) => [...prev.slice(0, rpSlots), ...Array(Math.max(0, rpSlots - prev.length)).fill('')])
  }, [rpSlots])

  useEffect(() => {
    setPQueries((prev) => [...prev.slice(0, pSlots), ...Array(Math.max(0, pSlots - prev.length)).fill('')])
  }, [pSlots])

  const relievers = useMemo<PlayerRow[]>(() => relieverRows, [relieverRows])
  const allPitchers = useMemo<PlayerRow[]>(() => rows, [rows])

  const relieverById = useMemo(() => new Map(relievers.map((r) => [String(r.playerId), r])), [relievers])
  const allById = useMemo(() => new Map(allPitchers.map((r) => [String(r.playerId), r])), [allPitchers])
  const relieverLabelToId = useMemo(
    () => new Map(relievers.map((r) => [buildLabel(r), String(r.playerId)])),
    [relievers],
  )
  const pitcherLabelToId = useMemo(
    () => new Map(allPitchers.map((r) => [buildLabel(r), String(r.playerId)])),
    [allPitchers],
  )

  const rpPickIds = useMemo(
    () => rpQueries.map((q) => relieverLabelToId.get(q) ?? ''),
    [rpQueries, relieverLabelToId],
  )
  const pPickIds = useMemo(
    () => pQueries.map((q) => pitcherLabelToId.get(q) ?? ''),
    [pQueries, pitcherLabelToId],
  )
  const selectedIds = useMemo(() => new Set([...rpPickIds, ...pPickIds].filter(Boolean)), [rpPickIds, pPickIds])
  const selectedRp = useMemo(
    () => rpPickIds.map((id) => relieverById.get(id)).filter((x): x is PlayerRow => x != null),
    [rpPickIds, relieverById],
  )
  const selectedP = useMemo(
    () => pPickIds.map((id) => allById.get(id)).filter((x): x is PlayerRow => x != null),
    [pPickIds, allById],
  )
  const selectedAll = useMemo(() => {
    const out = new Map<number, PlayerRow>()
    selectedRp.forEach((r) => out.set(r.playerId, r))
    selectedP.forEach((r) => out.set(r.playerId, r))
    return [...out.values()]
  }, [selectedRp, selectedP])

  const mySv = useMemo(() => sumStat(selectedAll, 'SV'), [selectedAll])
  const mySvh = useMemo(() => sumStat(selectedAll, 'SVH'), [selectedAll])

  const bm = useMemo(
    () => calcBenchmarks(allPitchers, relievers, leagueSize, rpSlots, pSlots),
    [allPitchers, relievers, leagueSize, rpSlots, pSlots],
  )
  const seasonItems = useMemo(() => {
    const y = new Date().getFullYear()
    const max = Math.max(y, cfg.season, PROJECTION_SEASON)
    const out: { value: string; label: string }[] = []
    for (let s = 2025; s <= max; s++) {
      if (s === PROJECTION_SEASON) out.push({ value: `${s}-proj`, label: `${s} (Proj)` })
      out.push({ value: String(s), label: String(s) })
    }
    return out
  }, [cfg.season])
  const seasonSelectValue =
    cfg.season === PROJECTION_SEASON && cfg.useProjection ? `${PROJECTION_SEASON}-proj` : String(cfg.season)

  if (status === 'loading' && rows.length === 0) {
    return <div class={styles.card}>Loading…</div>
  }

  return (
    <div class={styles.wrap}>
      <div class={styles.card}>
        <div class={styles.title}>SV / SV+H 목표치 체크</div>
        <div class={styles.sub}>
          이전 시즌/예상 성적 기반으로, 입력한 선수 조합이 리그 상위권 컷에 도달하는지 계산합니다.
        </div>

        <div class={styles.row}>
          <label class={styles.label}>
            년도
            <select
              class={styles.select}
              value={seasonSelectValue}
              onChange={(e) => {
                const raw = e.currentTarget.value
                if (raw === `${PROJECTION_SEASON}-proj`) {
                  setCfg({ ...cfg, season: PROJECTION_SEASON, useProjection: true })
                  return
                }
                const season = Number(raw)
                setCfg({ ...cfg, season, useProjection: false })
              }}
            >
              {seasonItems.map((s) => (
                <option value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          <label class={styles.label}>
            리그 규모
            <select
              class={styles.select}
              value={leagueSize}
              onChange={(e) => setLeagueSize(Number(e.currentTarget.value) as 12 | 16 | 20)}
            >
              <option value={12}>12인</option>
              <option value={16}>16인</option>
              <option value={20}>20인</option>
            </select>
          </label>

          <label class={styles.label}>
            RP 슬롯 (최대 5)
            <input
              class={styles.num}
              type="number"
              min={0}
              max={5}
              value={rpSlots}
              onInput={(e) => setRpSlots(Math.max(0, Math.min(5, (e.currentTarget as HTMLInputElement).valueAsNumber || 0)))}
            />
          </label>

          <label class={styles.label}>
            P 슬롯 (최대 3)
            <input
              class={styles.num}
              type="number"
              min={0}
              max={3}
              value={pSlots}
              onInput={(e) => setPSlots(Math.max(0, Math.min(3, (e.currentTarget as HTMLInputElement).valueAsNumber || 0)))}
            />
          </label>
        </div>
      </div>

      <div class={styles.grid}>
        <div class={styles.card}>
          <div class={styles.secTitle}>내 팀 RP 선택</div>
          {rpQueries.map((q, idx) => (
            <div key={`rp-slot-${idx}`} class={styles.slotRow}>
              <div class={styles.slotTitle}>RP{idx + 1}</div>
              <div class={styles.slotBody}>
                <input
                  class={styles.select}
                  list={`rp-list-${idx}`}
                  value={q}
                  placeholder={`RP ${idx + 1} 선수 검색`}
                  onInput={(e) => {
                    const next = [...rpQueries]
                    next[idx] = (e.currentTarget as HTMLInputElement).value
                    setRpQueries(next)
                  }}
                />
                <div class={styles.slotStat}>
                  {formatSlotStats(rpPickIds[idx] ? relieverById.get(rpPickIds[idx]!) : undefined)}
                </div>
              </div>
            </div>
          ))}
          {rpQueries.map((_, idx) => (
            <datalist id={`rp-list-${idx}`} key={`rp-dl-${idx}`}>
              {relievers.map((r) => {
                const pid = String(r.playerId)
                const usedElsewhere = selectedIds.has(pid) && pid !== rpPickIds[idx]
                if (usedElsewhere) return null
                return <option key={`rp-opt-${idx}-${pid}`} value={buildLabel(r)} />
              })}
            </datalist>
          ))}
        </div>

        <div class={styles.card}>
          <div class={styles.secTitle}>내 팀 P 선택</div>
          {pQueries.map((q, idx) => (
            <div key={`p-slot-${idx}`} class={styles.slotRow}>
              <div class={styles.slotTitle}>P{idx + 1}</div>
              <div class={styles.slotBody}>
                <input
                  class={styles.select}
                  list={`p-list-${idx}`}
                  value={q}
                  placeholder={`P ${idx + 1} 선수 검색`}
                  onInput={(e) => {
                    const next = [...pQueries]
                    next[idx] = (e.currentTarget as HTMLInputElement).value
                    setPQueries(next)
                  }}
                />
                <div class={styles.slotStat}>
                  {formatSlotStats(pPickIds[idx] ? allById.get(pPickIds[idx]!) : undefined)}
                </div>
              </div>
            </div>
          ))}
          {pQueries.map((_, idx) => (
            <datalist id={`p-list-${idx}`} key={`p-dl-${idx}`}>
              {allPitchers.map((r) => {
                const pid = String(r.playerId)
                const usedElsewhere = selectedIds.has(pid) && pid !== pPickIds[idx]
                if (usedElsewhere) return null
                return <option key={`p-opt-${idx}-${pid}`} value={buildLabel(r)} />
              })}
            </datalist>
          ))}
        </div>
      </div>

      <div class={styles.card}>
        <div class={styles.secTitle}>결과</div>
        <div class={styles.statRows}>
          <div class={styles.statRow}>
            <div class={styles.metric}>
              <div class={styles.k}>내 팀 SV</div>
              <div class={styles.v}>{fmt(mySv)}</div>
            </div>
            <div class={styles.metric}>
              <div class={styles.k}>상위권 컷 (SV)</div>
              <div class={styles.v}>{fmt(bm.targetSv)}</div>
            </div>
            <div class={styles.metric}>
              <div class={styles.k}>평균 팀 컷 (SV)</div>
              <div class={styles.v}>{fmt(bm.avgSv)}</div>
            </div>
          </div>
          <div class={styles.statRow}>
            <div class={styles.metric}>
              <div class={styles.k}>내 팀 SV+H</div>
              <div class={styles.v}>{fmt(mySvh)}</div>
            </div>
            <div class={styles.metric}>
              <div class={styles.k}>상위권 컷 (SV+H)</div>
              <div class={styles.v}>{fmt(bm.targetSvh)}</div>
            </div>
            <div class={styles.metric}>
              <div class={styles.k}>평균 팀 컷 (SV+H)</div>
              <div class={styles.v}>{fmt(bm.avgSvh)}</div>
            </div>
          </div>
        </div>
        <div class={styles.note}>
          참고: 상위권 컷은 리그 상위 1/3 기준, 평균 팀 컷은 리그 평균 기준입니다. 컷은 현재 데이터에서
          RP/P 슬롯 수만큼 선수를 뽑는다고 가정한 추정치입니다. 내 팀 달성 여부는 SV {mySv >= bm.targetSv ? '도달' : '미달'},
          SV+H {mySvh >= bm.targetSvh ? '도달' : '미달'} 입니다.
        </div>
      </div>
    </div>
  )
}
