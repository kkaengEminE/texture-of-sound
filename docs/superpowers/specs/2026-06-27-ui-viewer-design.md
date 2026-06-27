# UI / 뷰어 (플랜 2) — 설계 문서

> 프로젝트명: **texture-of-sound**
> 문서 작성일: 2026-06-27
> 범위: 전체 플랫폼의 **두 번째 서브프로젝트 = 엔진 위에 얹는 핵심 경로 UI**
> 선행: 플랜 1(엔진 코어) 완료 — `src/engine/` 순수 함수 파이프라인, 67 테스트 통과.

---

## 0. 이 문서의 위치

플랜 1에서 결정론적 번역 엔진(`analyzeToPainting`)을 완성했다. 이 문서는 그
엔진을 사용자가 실제로 쓰는 **핵심 경로 UI**를 정의한다:

> 곡 업로드 → (decode + Web Worker 분석) → 연속 회화 뷰어(캔버스 + 재생 동기화
> + 구간 칩 + 악기 레이어 토글 + AI 시각 해설).

인증·갤러리·대시보드·커뮤니티·유료화는 후속 서브프로젝트로 분리한다(YAGNI).

---

## 1. 확정된 핵심 결정 (브레인스토밍 결과)

| # | 결정 | 이유 |
|---|------|------|
| 1 | **핵심 경로 3화면만** (업로드 → 분석 → 뷰어) | 엔진을 눈으로 검증. 인증/갤러리 제외 |
| 2 | **분석은 Web Worker** | decode+Meyda가 무거워 메인 스레드 블로킹 방지, 진행률 표시 |
| 3 | **Next App Router 라우트 분리** (`/`, `/analyze`, `/viewer/[id]`) | URL 공유·새로고침 안정, 와이어프레임 사이드바 구조와 부합 |
| 4 | **Tailwind + localStorage 캐시** | 미니멀 흑백 와이어프레임 빠른 구현 + 재분석 회피 |
| 5 | **오디오 blob은 IndexedDB 캐시** | 재생 동기화가 핵심 → 새로고침·재방문에도 재생 복원 |
| 6 | **화풍 1개 (oilStyle)** | 엔진과 동일. StyleAdapter 교체 여지만 유지 |

### 분석 실행의 현실적 구조 (중요)

`OfflineAudioContext` 디코드는 브라우저 메인 스레드 API다. 따라서:

1. **메인 스레드**: `decodeAudioData(arrayBuffer)` → `DecodedAudio`(PCM Float32).
2. **워커로 transfer**: `DecodedAudio`의 `channels`/`mono`(Float32Array)를
   transferable로 워커에 넘긴다(복사 비용 0).
3. **워커**: `analyzeToPainting(audio)` 실행, 단계별 진행률을 `postMessage`로
   보고, 최종 결과(`song/comp/strokes/seed`)를 반환.

워커 결과는 모두 JSON 직렬화 가능한 평범한 객체/배열이므로 구조적 복제로 전달된다.

---

## 2. 아키텍처

```
src/
  engine/                       # (완료) 순수 엔진 — import만, 수정 없음
  app/
    layout.tsx                  # 사이드바 셸 + Tailwind 전역
    page.tsx                    # "/"   업로드 화면
    analyze/page.tsx            # "/analyze"  분석 진행
    viewer/[id]/page.tsx        # "/viewer/[id]"  연속 회화 뷰어
    globals.css                 # Tailwind 디렉티브
  components/
    Sidebar.tsx                 # 와이어프레임 좌측 네비(일부 비활성)
    UploadDropzone.tsx          # 드롭/선택 + 형식·용량 안내
    AnalyzeProgress.tsx         # 워커 진행률 단계 표시
    PaintingCanvas.tsx          # 정적 그림 + 재생 하이라이트 오버레이 + 클릭
    PlaybackControls.tsx        # <audio> 재생/일시정지/탐색 + 진행바
    SegmentChips.tsx            # 구간 칩 + 진행 상태
    LayerToggle.tsx             # 전체/베이스/중음/고음
    ExplanationPanel.tsx        # explainSegment / explainStroke
  workers/
    analyze.worker.ts           # PCM → analyzeToPainting → 결과
  lib/
    decode.ts                   # 메인 스레드 decode 래퍼 (engine decodeAudioData 호출)
    analyze-client.ts           # 워커 생성·메시지 프로토콜 클라이언트
    store.ts                    # localStorage(분석결과) + IndexedDB(오디오 blob)
    canvas-geometry.ts          # 표시좌표 ↔ 내부좌표(1600×900) 역변환
    types.ts                    # UI 레이어 전용 타입(StoredPainting, ProgressMsg 등)
```

### 데이터 흐름 (한 곡)

```
[업로드 page]
  File → arrayBuffer → lib/decode.decode() → DecodedAudio
  → lib/analyze-client.analyze(audio, onProgress)  ──transfer──▶ [worker]
                                                       analyzeToPainting(audio)
                                                       postMessage(progress…)
  ◀── { song, comp, strokes, seed } ─────────────────────────────┘
  → store.savePainting(seed, {song,comp,strokes,seed,meta})  (localStorage)
  → store.saveAudio(seed, blob)                              (IndexedDB)
  → router.push(`/viewer/${seed}`)

[viewer page]
  id(seed) → store.loadPainting(id) + store.loadAudio(id)
  → PaintingCanvas(renderPainting) + PlaybackControls(audio) + 패널들
```

**라우트 간 decode 결과 전달 (확정)**: PCM은 크고 URL/localStorage로 못 넘기므로,
**클라이언트 메모리 모듈 변수**(`lib/analyze-client.ts` 내 모듈 스코프 핸드오프
객체, 또는 가벼운 Zustand 스토어)에 담아 전달한다. 흐름:

1. `/` 업로드 화면: File → `decode()` → `DecodedAudio`를 메모리 핸드오프에 저장
   → `router.push('/analyze')`.
2. `/analyze`: 핸드오프에서 `DecodedAudio`를 꺼내 워커 분석 구동, 진행률 표시.
   핸드오프가 비어 있으면(직접 URL 진입·새로고침) `/`로 리다이렉트.
3. 완료 시 결과 저장 후 `router.replace('/viewer/<seed>')`.

이 방식은 라우트 분리를 유지하면서 큰 PCM의 직렬화/복사를 피한다.

---

## 3. 컴포넌트 책임 (각각 단일 책임 + 명확한 props)

| 컴포넌트 | 입력(props) | 책임 |
|----------|-------------|------|
| `UploadDropzone` | `onFile(file)` | 드롭/선택, 형식(mp3/wav/flac)·용량 검증, 에러 표시 |
| `AnalyzeProgress` | `stage, percent` | 단계별 진행률 바·라벨 |
| `PaintingCanvas` | `painting, layer, currentTime, onPick(stroke)` | `renderPainting`으로 정적 그림 그리고, 오버레이에 `activeStrokesAt(currentTime)` 하이라이트, 클릭→역변환→`strokeNearPoint`→`onPick` |
| `PlaybackControls` | `audioUrl, duration, currentTime, onSeek, onToggle` | `<audio>` 제어 + 진행바 |
| `SegmentChips` | `segments, activeIndex, onSelect(i)` | 구간 칩, 현재 구간 강조, 클릭 시 탐색 |
| `LayerToggle` | `layer, onChange(layer)` | 전체/베이스/중음/고음 |
| `ExplanationPanel` | `song, selected(segment|stroke)` | `explainSegment`/`explainStroke` 결과 표시(색감·질감 / 붓 움직임) |
| `Sidebar` | — | 와이어프레임 네비(홈·업로드·갤러리 등; 미구현 항목은 비활성) |

뷰어 페이지가 상태(현재 시간, 선택 구간/스트로크, layer)를 들고 자식에 내려준다.

---

## 4. 렌더링·결정론

- 캔버스 내부 해상도는 **1600×900 고정**(엔진이 그 좌표로 strokes 생성). 표시
  크기는 CSS로 반응형(`max-width:100%`, 종횡비 유지).
- **두 레이어**: (a) 정적 그림 캔버스 — painting/layer 변경 시에만 `renderPainting`
  재실행. (b) 오버레이 캔버스 — `requestAnimationFrame`으로 `activeStrokesAt`
  결과만 가볍게 강조(현재 위치 표시). 매 프레임 전체 재렌더 금지.
- **클릭 처리**: 표시 좌표 → `canvas-geometry`로 내부 1600×900 좌표 역변환 →
  `strokeNearPoint(strokes, x, y)` → `explainStroke`.
- **레이어 토글**: `renderPainting(ctx, strokes, comp, { layer })` 재호출.
- 화풍은 `oilStyle` 1개(엔진 기본).

---

## 5. 저장 전략

- **분석 결과**(`StoredPainting = { seed, song, comp, strokes, meta }`, JSON):
  `localStorage` 키 `tos:painting:<seed>`. 재방문·새로고침 시 재분석 없이 복원.
- **오디오 blob**: `IndexedDB`(object store `audio`, 키 `<seed>`). 재생 동기화
  복원용. `store.saveAudio/loadAudio`가 래핑.
- 용량/정리: MVP는 단순 저장만(LRU·쿼터 관리는 후속). 로드 실패 시 "재업로드"
  안내로 폴백.

---

## 6. 테스트 전략

- **lib 순수 로직**: `canvas-geometry`(좌표 역변환), `store`(직렬화/역직렬화)
  → Vitest 유닛 테스트.
- **워커 메시지 계약**: 입력(`DecodedAudio`)→출력(`{song,comp,strokes,seed}`)
  형태와 진행률 메시지 순서 → 유닛 테스트(워커 로직을 순수 함수로 분리해 테스트).
- **컴포넌트**: 핵심 상호작용(@testing-library/react) — 업로드 콜백, layer 토글,
  구간 선택이 올바른 핸들러를 부르는지. canvas 렌더 자체는 jsdom 한계로 스모크.
- **엔진**: 이미 67 테스트로 검증됨 — UI는 "엔진을 올바르게 호출·표시"에 집중.
- 기존 Vitest 설정 재사용. 컴포넌트 테스트용 `environment: jsdom` 추가(파일별
  주석 또는 별도 프로젝트 설정).

---

## 7. 명시적 제외 (후속 서브프로젝트)

- 인증·회원가입·로그인 · 대시보드 · 최근 작품 목록
- 갤러리(개인/공개) · 좋아요·댓글·공유 · 광고 · 작품 상세/탐색
- 다중 화풍 선택 UI (엔진은 StyleAdapter로 준비됨)
- 서버·DB·S3 업로드 (MVP는 전부 클라이언트: localStorage + IndexedDB)
- 저장 쿼터/LRU 관리

---

## 8. 기술 스택

- **Next.js (App Router) + TypeScript** (기존 리포에 추가)
- **Tailwind CSS**
- **Web Worker** (분석), **IndexedDB**(오디오), **localStorage**(분석결과)
- **Canvas2D**(엔진 `renderPainting`)
- **Vitest + @testing-library/react**(jsdom)

---

## 9. 성공 기준 (이 서브프로젝트)

1. 곡을 업로드하면 분석 진행률이 보이고, 끝나면 `/viewer/[id]`에 한 장의 연속
   회화가 그려진다.
2. 재생하면 현재 위치가 그림 위에서 강조되고, 구간 칩이 현재 구간을 따라간다.
3. 그림/구간 클릭 시 해당 분석 근거 한국어 해설(색감·질감 / 붓 움직임)이 나온다.
4. 악기 레이어(전체/베이스/중음/고음) 토글 시 해당 대역 스트로크만 보인다.
5. 새로고침·재방문 시 재분석 없이 그림·해설·재생이 복원된다(localStorage+IndexedDB).
6. 같은 곡을 다시 업로드하면 같은 `seed`·같은 그림이 나온다(엔진 결정론 그대로).
