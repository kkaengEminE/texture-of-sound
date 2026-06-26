# 음악-회화 번역 엔진 MVP — 설계 문서

> 프로젝트명: **texture-of-sound**
> 문서 작성일: 2026-06-26
> 범위: 전체 플랫폼의 **첫 서브프로젝트 = 핵심 번역 엔진 수직 슬라이스**

---

## 0. 이 문서의 위치

전체 프롬프트는 사실상 독립적인 서브시스템 6~7개(음악분석 · Visual Language
Engine · Composition/Brush · Renderer · 재생동기화/해설 · 갤러리 · 인증/유료화)로
구성된다. 단일 스펙으로 만들 수 없는 규모이므로 **각 서브시스템이 별도의
스펙 → 플랜 → 구현 사이클**을 가진다.

이 문서는 그중 **프로젝트의 심장이자 가장 큰 불확실성**인 번역 엔진을 얇게
수직으로 관통하는 첫 서브프로젝트를 정의한다:

> 곡 1개 업로드 → 분석 → Visual Language → Composition Map → Brush Path →
> 캔버스 한 장의 회화 → 재생 위치 동기화 → 클릭 시 AI 시각 해설.

---

## 1. 확정된 핵심 결정 (브레인스토밍 결과)

| # | 결정 | 이유 |
|---|------|------|
| 1 | **절차적(procedural) 렌더링** (확산모델 아님) | 같은 곡 → 100% 동일 재현. "생성"이 아니라 "번역" 철학·특허 포인트에 부합 |
| 2 | **핵심 엔진 수직 슬라이스**만 (인증/갤러리/유료화 제외) | 가장 위험한 심장부터 검증 |
| 3 | **단일 TypeScript 스택** (Next.js + Web Audio/Meyda) | 반복 속도 최고, 파이프라인 전체를 하나의 순수함수 체인으로 |
| 4 | **화풍 1개**(oil)로 시작, render adapter로 교체 가능 | "화풍만 바뀌고 구도·붓이동은 동일" 철학을 인터페이스로 보장 |
| 5 | **Composition Map / Brush Path = 순수 결정론 알고리즘** (LLM 미사용) | LLM은 비결정론적 → 재현성 파괴. 구도·붓은 규칙으로 계산 |
| 6 | **AI 시각 해설 = 규칙 기반 한국어 템플릿** | 결정론·무비용·무네트워크. LLM은 후속 서브프로젝트에서 교체 |
| 7 | **가벼운 악기 레이어 포함** (Demucs 없이 주파수 대역 분리) | 저음=베이스 / 중음 / 고음=심벌·하이햇 수준의 의사 레이어. 데모에서 레이어 UI 시연 |

### 핵심 철학과 그 기술적 귀결

- "시간 → 공간" = 곡의 시간축을 캔버스의 공간 배치로 매핑.
- "같은 곡이면 거의 동일한 결과" = **결정론**. 따라서 파이프라인 전 단계가
  순수 함수여야 하고, 의사난수조차 분석값에서 유도한 시드로 재현 가능해야 한다.
- "AI는 창작이 아니라 번역" = 그림을 만드는 주체는 **Visual Language Engine
  (규칙)** 이고, AI(LLM)는 *설명*에만 관여한다(이번 MVP에선 규칙 템플릿).

---

## 2. 아키텍처 — 순수 함수 파이프라인

```
File(mp3/wav/flac)
  └─ audio/decode ─────────▶ PCM (Float32, 44.1kHz 고정, mono+stereo)
       └─ analysis/features ─▶ FrameFeatures[] (프레임 단위 시계열)
            └─ analysis/structure ─▶ Segment[] (구간 분할 + 역할)
                 └─ analysis/song ──▶ SongAnalysis (전역+시계열+구간+밴드)
                      └─ vle/visual-language ─▶ VisualLanguage (정규화된 시각 파라미터)
                           └─ vle/composition ─▶ CompositionMap (공간 배치)
                                └─ vle/brush-path ─▶ BrushPath[] (스트로크)
                                     └─ render/canvas ─▶ 회화(Canvas)
  playback/sync : time ↔ 활성 스트로크/구간 하이라이트
  explain/template : (x,y)|time → 분석값·붓결정 → 한국어 해설
```

**모든 화살표는 순수 함수.** 같은 입력 → byte 단위로 같은 출력.

### 결정론 보장 장치

1. **고정 파라미터**: 샘플레이트 44100, 분석 window 2048, hop 512 등 상수 고정.
2. **시드 유도**: `seed = hash(SongAnalysis 직렬화)`. 붓의 미세한 흔들림 등
   "자연스러움"을 위한 난수는 `mulberry32(seed)` PRNG로만 생성 → 재현 가능.
3. **부동소수점 통제**: 누적 연산 순서 고정, 플랫폼 의존 함수 회피.
4. **회귀 방지**: 골든 스냅샷 테스트(아래 §6).

---

## 3. 모듈 경계와 인터페이스

각 모듈은 **하나의 명확한 책임 / 잘 정의된 입출력 / 독립 테스트 가능**.

### 3.1 `audio/decode`
- 입력: `File | ArrayBuffer`
- 출력: `DecodedAudio { sampleRate: 44100, length, channelData: Float32Array[], duration }`
- 구현: `OfflineAudioContext`로 디코드·리샘플. 지원: mp3/wav/flac(브라우저 코덱 의존).
- 에러: 디코드 실패, 0길이, 지원 불가 포맷 → 타입화된 에러.

### 3.2 `analysis/features`
- 입력: `DecodedAudio`
- 출력: `FrameFeatures[]` — 프레임당:
  - `rms` / `loudness`(다이내믹), `spectralCentroid`(brightness),
    `spectralFlux`(변화/attack 후보), `zcr`,
    `bandEnergy { bass, mid, high }`(대역 에너지 → 악기 레이어 근거),
    `chroma[12]`(→ key/harmony), `onset`(불리언/강도)
- 구현: OfflineAudioContext 프레임 슬라이싱 + Meyda(또는 직접 DSP). 결정론적.

### 3.3 `analysis/structure`
- 입력: `FrameFeatures[]`
- 출력: `Segment[] { index, t0, t1, role, energy, summary }`
  - `role`: `intro | build | climax | transition | release | outro` 등
  - 분할: self-similarity / novelty curve의 피크를 결정론적으로 검출
- 와이어프레임의 "서주의 여명 / 긴장과 상승 / 폭풍의 절정 / 고요한 전환 /
  해소와 여운 / 침묵의 마침표"에 대응.

### 3.4 `analysis/song`
- 출력: `SongAnalysis`
  ```
  {
    meta: { duration, sampleRate, bpm, key, frameRate },
    frames: FrameFeatures[],
    segments: Segment[],
    bands: { bass: number[], mid: number[], high: number[] }, // 시계열, 레이어용
    globals: { loudnessRange, brightnessAvg, densityAvg, ... }
  }
  ```
- BPM/key 추정도 결정론적 알고리즘.

### 3.5 `vle/visual-language` — **핵심 자산**
- 입력: `SongAnalysis`
- 출력: `VisualLanguage` — 정규화(0~1)된 시각 파라미터 시계열 + 전역.
- **매핑 규칙표** (곡 전체 맥락으로 정규화 — "잔잔한 곡의 디스토션 ≠ 메탈의
  디스토션"을 정규화로 처리):

  | 음악 요소 | 시각 요소 |
  |-----------|-----------|
  | Attack | 붓 압력 |
  | Sustain | 붓 길이 |
  | Reverb(추정) | 번짐 |
  | Bass | 무게 중심(아래쪽) |
  | Dynamics | 붓 두께 |
  | Tempo | 붓 속도 |
  | Harmony(chroma) | 색의 조화(팔레트) |
  | Brightness | 명도 |
  | Density | 붓 밀도 |

- 규칙표는 데이터(상수 테이블)로 분리 → 추후 튜닝·특허 명세화 용이.

### 3.6 `vle/composition`
- 입력: `VisualLanguage`
- 출력: `CompositionMap { canvas{w,h}, regions: Region[], focalPoint, flow, margins }`
  - `regions`: 구간별 **비균등** 공간 분할(고정 4x4 금지). 에너지/길이 비례.
  - `focalPoint`: 절정 구간 → 무게 중심·시선 집중점.
  - `flow`: 시작점 → 이동 방향 → 절정 → 여백의 경로.

### 3.7 `vle/brush-path`
- 입력: `VisualLanguage + CompositionMap + seed`
- 출력: `BrushPath[]`
  ```
  BrushPath {
    id, segmentIndex, layer: 'all'|'bass'|'mid'|'high',
    points: {x,y}[],            // 경로(제어점)
    pressure, width, length, speed,
    color: {h,s,l}, blur,       // 번짐
    t0, t1                      // 재생 동기화용 시간 범위
  }
  ```
- 붓의 여정(시작/방향/속도/회전/튐/퍼짐/멈춤)을 규칙으로 생성.
- `layer` 태그로 **악기 레이어**(대역 기반) 토글 지원.

### 3.8 `render/canvas`
- 입력: `BrushPath[] + StyleAdapter`
- 출력: Canvas 렌더(한 장의 연속 회화).
- `StyleAdapter` 인터페이스: `oil`(MVP 구현 1개). 추후 수채/먹/픽셀 등 추가.
  → "화풍만 교체, 구도·붓이동 동일" 보장.
- 결정론: 동일 입력 → 동일 픽셀(픽셀 해시 테스트).

### 3.9 `playback/sync`
- 입력: 재생 `currentTime`, `BrushPath[]`, `Segment[]`
- 출력: 현재 활성 구간/스트로크 집합 → 캔버스 하이라이트.

### 3.10 `explain/template`
- 입력: 클릭 좌표(x,y) 또는 time → 해당 스트로크/구간/분석값
- 출력: 한국어 해설 문자열(규칙 템플릿). 예:
  > "2:31 — 이 구간은 강한 Attack과 짧은 Sustain으로 인해, 거친 붓이 빠르게
  > 지나가는 질감으로 표현되었습니다."

---

## 4. UI (와이어프레임 기준 최소 화면)

1. **업로드 화면** — 파일 선택/드롭, 지원 형식 안내.
2. **분석 진행 화면** — 단계별 진행률.
3. **연속 회화 뷰어** (핵심) — img-temp `11연속회화.jpg` 기준:
   - 메인 캔버스(전체 회화, 현재 위치 강조)
   - 재생 컨트롤(재생/일시정지/처음으로/다음, 진행바)
   - 구간 칩(1구간~N구간) + 구간 상세 패널
   - **악기 레이어 토글**(전체/베이스/중음/고음)
   - **AI 시각 해설 패널**(img-temp `12시각해설.jpg`): 색감·질감 설명 / 붓 움직임 설명

사이드바·검색·갤러리 메뉴는 **시각적 자리만**(비활성/다음 서브프로젝트).

---

## 5. 명시적 제외 (다음 서브프로젝트들)

- 인증·회원가입·로그인
- DB / S3 / 영구 저장 (MVP는 메모리 + localStorage 임시)
- 갤러리 · 좋아요 · 댓글 · 공유 · 광고
- **Demucs 기반 정밀 악기 분리** (MVP는 대역 기반 의사 레이어만)
- 다중 화풍 (인터페이스만 열어둠)
- 유료화 · API 상품

데이터 모델에 확장 여지(`layer` 태그, `StyleAdapter` 인터페이스)만 남기고
구현은 하지 않는다 (YAGNI).

---

## 6. 테스트 전략

- **TDD**: 모듈별 인터페이스·실패 테스트부터.
- **골든 스냅샷**: 샘플 곡(짧은 합성/공개 음원) → `SongAnalysis`·`BrushPath[]`
  JSON 스냅샷 고정 → 재현성 회귀 방지.
- **결정론 검증**: 동일 입력 2회 실행 → 출력 deep-equal. 렌더는 픽셀 해시 일치.
- **엣지 케이스**: 무음 곡, 매우 짧은 곡(<5s), 디코드 실패, 극단적 다이내믹.
- 도구: Vitest. (렌더 픽셀 테스트는 node-canvas 또는 헤드리스.)

---

## 7. 기술 스택

- **Next.js (App Router) + TypeScript**
- 분석: **Web Audio API (OfflineAudioContext)** + **Meyda** (+ 필요 시 직접 DSP)
- 렌더: **Canvas2D** (MVP). 추후 WebGL/PixiJS 여지.
- 상태: 가벼운 로컬 상태(zustand 또는 props). 저장은 메모리/localStorage(임시).
- 테스트: **Vitest**

---

## 8. 디렉터리 (제안)

```
src/
  engine/
    audio/decode.ts
    analysis/{features,structure,song}.ts
    vle/{visual-language,composition,brush-path}.ts
    render/{canvas,style-oil}.ts
    explain/template.ts
    types.ts                 // SongAnalysis, VisualLanguage, BrushPath ...
  app/                       // Next.js 화면 (upload, analyzing, viewer)
  components/                // 뷰어 UI 컴포넌트
  store/                     // 가벼운 상태
docs/superpowers/specs/      // 본 설계 문서
img-temp/                    // 참고용 와이어프레임 (변경 금지)
```

---

## 9. 성공 기준 (이 서브프로젝트)

1. 임의의 곡을 업로드하면 한 장의 연속 회화가 생성된다.
2. 같은 곡을 두 번 넣으면 **동일한** 그림이 나온다(결정론 테스트 통과).
3. 재생 시 현재 위치가 그림 위에서 강조된다.
4. 그림/구간 클릭 시 분석 근거 기반 한국어 해설이 나온다.
5. 악기 레이어(전체/베이스/중음/고음)를 토글하면 해당 대역 스트로크만 보인다.
6. 화풍은 `StyleAdapter` 교체만으로 바꿀 수 있는 구조다(MVP는 oil 1개).
