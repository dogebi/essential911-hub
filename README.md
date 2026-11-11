# essential911-hub

`@essential911`(북유모) 유튜브 채널의 영상을 **카테고리·태그로 찾아보는 허브**입니다.
[Solostack Hub](https://solostack-hub.solostack-ai.workers.dev/)를 REA로 분석한 뒤, 같은 정보 구조와
화면 설계를 **React + Rust(axum) + PostgreSQL** 스택으로 다시 구현했습니다.

- 라이브(정적 스냅샷): <https://dogebi.github.io/essential911-hub/>
- 저장소: <https://github.com/dogebi/essential911-hub>
- 검증: Playwright E2E 21/21 통과 (API 모드 16 + 정적 모드 5)

```
┌───────────────────────────┐        ┌────────────────────────────┐        ┌──────────────────┐
│ React 18 + Vite + TS      │  HTTP  │ Rust axum API              │  SQL   │ PostgreSQL 16    │
│ (react-router, react-query)│ ─────▶ │ /api/home, /api/videos …   │ ─────▶ │ videos/categories│
└───────────────────────────┘        └────────────────────────────┘        └──────────────────┘
        │
        └─ 정적 배포(GitHub Pages)에서는 같은 번들이 public/data/*.json 스냅샷을 읽어 백엔드 없이 동작
```

## 구성

| 경로 | 내용 |
| --- | --- |
| `backend/` | Rust + axum + sqlx API. 스키마·시드는 바이너리에 내장(`include_str!`)되어 첫 실행 시 자동 적용 |
| `frontend/` | React 18 + TypeScript + Vite. 라우트: `/` `/videos` `/tags` `/c/:slug` `/t/:slug` `/v/:id` |
| `data/seed.json` | 유튜브 채널에서 수집한 영상·카테고리·태그 스냅샷(백엔드 시드 + 정적 빌드의 원본) |
| `data/aimotion.json` | aimotion 웹 데모 라이브러리(166편·12분류·태그) 카탈로그. `frontend/public/data/` 사본을 SPA가 읽는다 |
| `e2e/` | Playwright E2E — API 모드(실서버) + 정적 모드(GitHub Pages) 두 프로젝트 |
| `scripts/` | 채널 수집 → 시드 생성 → 스냅샷 → 정적 서버 실행 |
| `deploy/` | GitHub Pages 워크플로, Dockerfile, render.yaml (백엔드 호스팅용) |

## 빠른 실행 (로컬 풀스택)

```bash
# 1) PostgreSQL (root 없이 프로젝트 전용 클러스터, 포트 5434)
bash scripts/pg_cluster.sh

# 2) API + 프론트 빌드
export CARGO_TARGET_DIR=~/cargo-target/essential911-hub
cd backend && cargo run --release          # http://127.0.0.1:8099 (API + dist 정적 서빙)
cd frontend && npm run dev                 # http://127.0.0.1:5173 (API 프록시 → 8099)
```

기본 접속 정보는 `postgres://hub@127.0.0.1:5434/essential911_hub` 이고 `backend/.env`로 덮어쓸 수 있습니다:

```env
DATABASE_URL=postgres://hub@127.0.0.1:5434/essential911_hub
PORT=8099
STATIC_DIR=../frontend/dist
```

첫 기동 시 `data/seed.json`을 자동 주입합니다. 다시 주입하려면 `POST /api/reseed`.

## 데모 라이브러리 (aimotion)

`/demos` 는 [cokacmotion](https://dogebi.github.io/cokacmotion/) 의 웹 그래픽 데모 **166편**을
**12개 분류 + 태그 44개**로 찾아보는 섹션입니다. 카드를 누르면 허브 안의 `/demo/:id` 화면에서
데모가 **iframe으로 바로 재생**되고(새 탭으로 나가지 않음), 분류·태그는 URL로 남습니다:
`/demos`, `/demos/:group`, `/demo/:id`, `/demos?tag=shader`, `/demos?q=오로라`.
상세 화면에는 기법 요약·배울 점·같은 분류의 다른 데모가 함께 나오고, 전체 화면/새 탭/구현 노트 링크가 있습니다.

데모 카탈로그는 영상 API와 분리된 **정적 자산**(`frontend/public/data/aimotion.json`)이라
백엔드 없이도 동작합니다. 원본 `index.json`에서 다시 만들려면:

```bash
python3 scripts/build_aimotion.py                 # 기본: /mnt/d/dev/cokacmotion/skills/aimotion/index.json
COKACMOTION_INDEX=/path/index.json SITE_BASE=https://<org>.github.io/cokacmotion python3 scripts/build_aimotion.py
```

분류는 원본 스킬의 12개 그룹을 그대로 쓰고, 태그는 각 데모의 `libraries`(three.js, GSAP, d3 …)와
`tech` 문구에 대한 규칙표로 붙입니다. 규칙에 걸리지 않는 데모는 분류 자체를 태그로 달아 미분류가 없습니다.

## API

| 엔드포인트 | 설명 |
| --- | --- |
| `GET /api/health` | `{status, db}` |
| `GET /api/stats` | 영상 수·쇼츠/롱폼 수·카테고리/태그 수·총 조회수 |
| `GET /api/home` | 히어로 총계, `popular`(조회수 상위 8), `rows`(카테고리별 10편), `tags` |
| `GET /api/videos` | `limit`(≤60) `offset` `kind=all\|short\|long` `sort=latest\|weekly\|popular` `q` `category` `tag` |
| `GET /api/videos/:id` | `video` + `related`(같은 카테고리) + `graph_related`(태그 겹침순) |
| `GET /api/categories` | `[{slug,name,description,video_count}]` |
| `GET /api/tags` | `[{slug,name,video_count}]` |
| `POST /api/reseed` | `data/seed.json` 재적용(멱등) |

응답 형태는 분석한 원본 사이트의 JSON과 동일하게 맞췄습니다(`items/total`, `video/related/graph_related`,
`popular/rows/tags`). `weekly_views`는 7일 증가분을 두 번 이상 관측해야 계산되므로 시드에서는 `null`이고,
화면은 `조회 N회`로 대체 표시합니다.

## 데이터 수집 (다른 채널로 바꾸려면)

```bash
yt-dlp --proxy socks5h://127.0.0.1:1098 --flat-playlist -J "https://www.youtube.com/@<handle>/shorts" > /tmp/flat.json
# 영상별 상세 메타데이터를 NDJSON으로 수집한 뒤
python3 scripts/build_seed.py /tmp/ess/videos.ndjson   # → data/seed.json
```

분류는 키워드 규칙(`scripts/build_seed.py` 상단)으로 붙습니다. 현재 채널 기준:

| 카테고리 | 편수 | 근거 |
| --- | --- | --- |
| 날짜 클립 | 13 | 제목이 날짜로만 기록된 컷 |
| 그림 퀴즈 | 8 | 틀린 그림 / 못 맞추는 이미지 시리즈 |
| 웹앱 데모 | 2 | netlify 앱 링크를 붙인 클립 |
| 사운드·기타 | 2 | 음식·음악 단발 소재 |

## 테스트

```bash
# 1) 풀스택 기동 (8099)
cd backend && cargo run --release
# 2) 정적 번들 + 정적 서버 (8098)
cd frontend && npm run build:static && python3 ../scripts/serve_static.py
# 3) E2E
cd e2e && npm install && npx playwright install chromium && npx playwright test
```

- `api-mode.spec.ts` — API 계약 7건 + UI 8건(홈/목록/필터/정렬/검색/카테고리/태그/상세/404/내비)
- `static-mode.spec.ts` — API 호출 0건 보장, 스냅샷 4종 200, 오프라인 목록·상세·딥링크

## 배포

- **프론트엔드(GitHub Pages)** — `.github/workflows/pages.yml`이 `BASE_PATH=/<repo>/`,
  `VITE_DATA_MODE=static`으로 빌드해 Pages에 게시. SPA 딥링크는 `404.html`(index 복사본)로 처리.
- **백엔드** — `deploy/Dockerfile` + `deploy/render.yaml`(무료 플랜, `$PORT` 사용, 관리형 PostgreSQL).
  GitHub Pages는 정적 호스팅이라 Rust 서버와 PostgreSQL은 올릴 수 없습니다 → Pages는 스냅샷 모드,
  실서버는 Render/Cloud Run 같은 컨테이너 호스팅이 정답입니다.

## 출처와 라이선스

- 영상 메타데이터·썸네일: YouTube 공개 데이터 (`@essential911`). 저작권은 원저작자에게 있습니다.
- 화면 설계는 Solostack Hub 공개 페이지를 참고해 재구현했습니다. 브랜드명·로고·문구는 이 프로젝트의 것입니다.

## 배포 상태

| 대상 | URL | 방식 |
| --- | --- | --- |
| 프론트엔드 | <https://dogebi.github.io/essential911-hub/> | GitHub Actions → Pages (`BASE_PATH=/essential911-hub/`, `build:static`) |
| 딥링크 | `/v/<id>`, `/c/<slug>`, `/t/<slug>` | Pages `404.html`(index 복사본) → React Router |
| 백엔드 | 로컬 `127.0.0.1:8099` (PostgreSQL 5434) | `deploy/Dockerfile` / `deploy/render.yaml` 로 이전 가능 |

GitHub Pages는 정적 호스팅이므로 Rust API와 PostgreSQL은 그곳에서 돌지 않습니다. 배포본은 `frontend/public/data/*.json`
스냅샷만 읽고 `/api` 호출은 0건입니다(E2E `static-mode`가 이를 강제 검증). 실서버 API를 붙이려면 빌드 시
`VITE_API_BASE`를 지정하면 같은 번들이 그쪽을 호출합니다.
