# Bullpen RP (Fantasy Baseball)

GitHub Pages에서 **링크만 열면 동작**하는 정적 웹앱입니다. 브라우저에서 **MLB Stats API**를 직접 호출해 불펜 투수(릴리버) 시즌 스탯을 가져오고, **사용자 정의 카테고리/가중치 기반 RP(z-score)**를 계산해 랭킹을 보여줍니다.

## 특징

- **정적 배포**: 서버/DB 없이 GitHub Pages로 배포
- **레포 용량 최소화**: 대용량 데이터 파일/빌드 산출물 커밋 금지
- **불펜 전용**: Max Starts / Min IP / Min Games로 릴리버 풀 구성
- **RP 계산**: 카테고리별 z-score → 가중치 합산
- **내보내기**: 결과 CSV 다운로드

## 실행(로컬)

Node.js가 필요합니다.

```bash
cd web
npm install
npm run dev
```

## 빌드

```bash
cd web
npm run build
npm run preview
```

## 배포(GitHub Pages)

- `main` 브랜치에 푸시하면 GitHub Actions가 `web/`을 빌드해서 Pages에 배포합니다.
- Vite 설정은 `base: './'`로 되어 있어 프로젝트 Pages 경로에서도 자산 경로가 깨지지 않게 구성되어 있습니다.

## RP 계산 개요

- **불펜 필터(기본)**: `gamesStarted <= maxStarts`, `IP >= minIP`, `gamesPitched >= minGames`
- **z-score**: \( z = (x - \mu) / \sigma \)
- **낮을수록 좋은 지표(ERA/WHIP/BB9)**는 부호를 반전해 “높을수록 좋게” 통일한 뒤 z-score를 계산합니다.

## 데이터 출처 / 한계

- **Data source**: MLB Stats API (클라이언트에서 직접 호출)
- Yahoo Fantasy / FanGraphs는 인증/제약 이슈로 MVP에 포함하지 않았습니다(추후 옵션 확장 가능).

## 브라우저 캐시(하루 1회)

- **MLB 시즌 스탯**: 같은 시즌 데이터는 `localStorage`에 두되, **America/Los_Angeles 날짜(서행일) 기준으로 매일 00:00**이 넘어가면 갱신합니다.
- **Savant (Whiff%, xERA, xFIP)**: CI 빌드 시 `data/savant_pitcher_{year}.json`에 넣고, 클라이언트는 시즌당 하루 1회(역시 `America/Los_Angeles` 날짜 기준)만 맵을 `localStorage`에 캐시. Savant 리더보드 한도로 **시즌당 약 800명**만 포함 → 출장 적은 릴리버는 `—`일 수 있음. 배포 후 갱신이 안 보이면 Settings의 **Clear browser cache & reload**.
- **설정(시즌·필터·가중치)**: 바꿀 때마다 저장(용량 매우 작음).

## 레포 용량 정책(100MB 미만)

- `web/node_modules`, `web/dist`는 `.gitignore`로 제외되어 커밋되지 않습니다.
- 선수/스탯 스냅샷 JSON 같은 **대용량 데이터 파일을 레포에 넣지 않습니다**.

