import { useMemo } from 'preact/hooks'
import type { CategoryConfig, CategoryId, RpConfig } from '../lib/types'
import {
  CATEGORY_PRESETS,
  DEFAULT_CATEGORIES,
  DEFAULT_RP_CONFIG,
  FANTASY_LEAGUE_CATEGORY_ORDER,
  MIN_SUPPORTED_SEASON,
  PROJECTION_SEASON,
  applyCategoryPreset,
} from '../lib/rp'
import { clearDataCaches } from '../lib/savantPitcherData'
import styles from './SettingsPanel.module.css'

type Props = {
  cfg: RpConfig
  setCfg: (next: RpConfig) => void
  categories: CategoryConfig[]
  setCategories: (next: CategoryConfig[]) => void
  status: 'idle' | 'loading' | 'ready' | 'error'
  lastUpdated: string | null
}

export function SettingsPanel({
  cfg,
  setCfg,
  categories,
  setCategories,
  status,
  lastUpdated,
}: Props) {
  const fantasyIdSet = useMemo(() => new Set<CategoryId>(FANTASY_LEAGUE_CATEGORY_ORDER), [])

  const seasonSelectItems = useMemo(() => {
    const y = new Date().getFullYear()
    const max = Math.max(y, cfg.season, PROJECTION_SEASON)
    const out: { value: string; label: string }[] = []
    for (let s = MIN_SUPPORTED_SEASON; s <= max; s++) {
      if (s === PROJECTION_SEASON) {
        out.push({ value: String(s), label: String(s) })
        out.push({ value: `${s}-proj`, label: `${s} (Proj)` })
      } else {
        out.push({ value: String(s), label: String(s) })
      }
    }
    return out
  }, [cfg.season])

  const seasonSelectValue =
    cfg.season === PROJECTION_SEASON && cfg.useProjection
      ? `${PROJECTION_SEASON}-proj`
      : String(cfg.season)

  const { fantasyCats, detailCats } = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]))
    const fantasy = FANTASY_LEAGUE_CATEGORY_ORDER.map((id) => byId.get(id)).filter(
      (c): c is CategoryConfig => c != null,
    )
    const detail = DEFAULT_CATEGORIES.map((c) => c.id)
      .filter((id) => !fantasyIdSet.has(id))
      .map((id) => byId.get(id))
      .filter((c): c is CategoryConfig => c != null)
    return { fantasyCats: fantasy, detailCats: detail }
  }, [categories, fantasyIdSet])

  function renderCatRow(c: CategoryConfig) {
    return (
      <div class={styles.catRow} key={c.id}>
        <label class={styles.catCheck}>
          <input
            type="checkbox"
            checked={c.enabled}
            onChange={(e) => {
              const enabled = (e.currentTarget as HTMLInputElement).checked
              setCategories(categories.map((x) => (x.id === c.id ? { ...x, enabled } : x)))
            }}
          />
          <span class={styles.catLabel}>{c.label}</span>
        </label>

        <input
          class={styles.weight}
          type="number"
          step={0.05}
          value={c.weight}
          onInput={(e) => {
            const weight = (e.currentTarget as HTMLInputElement).valueAsNumber
            setCategories(categories.map((x) => (x.id === c.id ? { ...x, weight } : x)))
          }}
          disabled={!c.enabled}
          aria-label={`${c.label} weight`}
        />
      </div>
    )
  }

  return (
    <div class={styles.card}>
      <div class={styles.headerRow}>
        <div class={styles.title}>Settings</div>
        <button
          class={styles.reset}
          type="button"
          onClick={() => {
            setCfg(DEFAULT_RP_CONFIG)
            setCategories(DEFAULT_CATEGORIES)
          }}
        >
          Reset
        </button>
      </div>

      <div class={styles.grid}>
        <label class={styles.field}>
          <div class={styles.label}>Season</div>
          <select
            class={`${styles.input} ${styles.seasonSelect}`}
            value={seasonSelectValue}
            onChange={(e) => {
              const v = (e.currentTarget as HTMLSelectElement).value
              if (v.endsWith('-proj')) {
                const season = Number(v.replace(/-proj$/, ''))
                setCfg({ ...cfg, season, useProjection: true })
              } else {
                setCfg({ ...cfg, season: Number(v), useProjection: false })
              }
            }}
            aria-label="Season"
          >
            {seasonSelectItems.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label class={styles.field}>
          <div class={styles.label}>Min IP</div>
          <input
            class={styles.input}
            type="number"
            min={0}
            step={1}
            value={cfg.minIP}
            onInput={(e) => setCfg({ ...cfg, minIP: (e.currentTarget as HTMLInputElement).valueAsNumber })}
          />
        </label>

        <label class={styles.field}>
          <div class={styles.label}>Max Starts</div>
          <input
            class={styles.input}
            type="number"
            min={0}
            step={1}
            value={cfg.maxStarts}
            onInput={(e) => setCfg({ ...cfg, maxStarts: (e.currentTarget as HTMLInputElement).valueAsNumber })}
          />
        </label>

        <label class={styles.field}>
          <div class={styles.label}>Min Games</div>
          <input
            class={styles.input}
            type="number"
            min={0}
            step={1}
            value={cfg.minGames}
            onInput={(e) => setCfg({ ...cfg, minGames: (e.currentTarget as HTMLInputElement).valueAsNumber })}
          />
        </label>
      </div>

      <div class={styles.hr} />

      <div class={styles.presetRow}>
        <div class={styles.presetLabel}>리그 설정</div>
        <div class={styles.presetBtns}>
          {CATEGORY_PRESETS.map((p) => {
            const enabledIds = new Set(categories.filter((c) => c.enabled).map((c) => c.id))
            const isActive =
              p.enabledIds.length === enabledIds.size && p.enabledIds.every((id) => enabledIds.has(id))
            return (
              <button
                type="button"
                class={styles.presetBtn}
                data-active={isActive ? 'true' : 'false'}
                key={p.id}
                onClick={() =>
                  setCategories(
                    applyCategoryPreset(
                      categories,
                      new Set(p.enabledIds),
                      p.enabledWeights != null || p.enabledWeight != null
                        ? { enabledWeights: p.enabledWeights, enabledWeight: p.enabledWeight }
                        : undefined,
                    ),
                  )
                }
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      <div class={styles.subTitle}>스탯 카테고리 선택</div>

      <div class={styles.catSection}>
        <div class={styles.catSectionTitle}>판타지 리그 반영 지표</div>
        <div class={styles.cats}>{fantasyCats.map(renderCatRow)}</div>
      </div>

      <div class={styles.catSection}>
        <div class={styles.catSectionTitle}>세부 지표</div>
        <div class={styles.cats}>{detailCats.map(renderCatRow)}</div>
      </div>

      <div class={styles.hr} />

      <div class={styles.meta}>
        <div class={styles.badge} data-status={status}>
          {status === 'loading' ? 'Loading…' : status === 'ready' ? 'Ready' : status === 'error' ? 'Error' : 'Idle'}
        </div>
        <div class={styles.updated}>
          {lastUpdated ? `Fetched: ${new Date(lastUpdated).toLocaleString()}` : 'Not fetched yet'}
        </div>
      </div>
      <button
        type="button"
        class={styles.cacheClear}
        onClick={() => {
          clearDataCaches()
          window.location.reload()
        }}
      >
        스탯 다시 불러오기
      </button>
      <div class={styles.cacheHint}>
        Savant·FanGraphs 등 브라우저에 캐시된 스탯이 오래됐을 때 사용하세요. 캐시를 비운 뒤 페이지가 새로고침됩니다.
      </div>
    </div>
  )
}

