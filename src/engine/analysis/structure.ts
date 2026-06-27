import { FrameFeatures, Segment, SegmentRole } from '../types';
import { normalizeArray, clamp01 } from '../util/dsp';

// 프레임 특징을 정규화 벡터로 만들어 인접 윈도우 평균 간 차이로 novelty 산출
export function noveltyCurve(frames: FrameFeatures[]): number[] {
  const n = frames.length;
  if (n === 0) return [];
  const rms = normalizeArray(frames.map((f) => f.rms));
  const bright = normalizeArray(frames.map((f) => f.brightness));
  const bass = normalizeArray(frames.map((f) => f.band.bass));
  const high = normalizeArray(frames.map((f) => f.band.high));
  const flux = normalizeArray(frames.map((f) => f.flux));

  const W = 8; // 윈도우 반경
  const raw: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const a = avgVec(i - W, i, [rms, bright, bass, high]);
    const b = avgVec(i, i + W, [rms, bright, bass, high]);
    let d = 0;
    for (let k = 0; k < a.length; k++) d += (a[k] - b[k]) ** 2;
    raw[i] = Math.sqrt(d) + flux[i] * 0.5;
  }
  return normalizeArray(raw);

  function avgVec(from: number, to: number, series: number[][]): number[] {
    const lo = Math.max(0, from), hi = Math.min(n, to);
    return series.map((s) => {
      let sum = 0, cnt = 0;
      for (let i = lo; i < hi; i++) { sum += s[i]; cnt++; }
      return cnt ? sum / cnt : 0;
    });
  }
}

export function segmentSong(
  frames: FrameFeatures[],
  frameRate: number,
  duration: number
): Segment[] {
  const n = frames.length;
  if (n === 0) {
    return [{ index: 0, t0: 0, t1: duration, role: 'intro', energy: 0, summary: ROLE_LABEL.intro }];
  }
  const novelty = noveltyCurve(frames);

  // 피크 후보: 국소 최대 + 임계값. 최소 간격으로 과분할 방지.
  const minGap = Math.max(1, Math.floor(n / 10));
  const candidates: { i: number; v: number }[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (novelty[i] >= novelty[i - 1] && novelty[i] >= novelty[i + 1] && novelty[i] > 0.3) {
      candidates.push({ i, v: novelty[i] });
    }
  }
  candidates.sort((a, b) => b.v - a.v || a.i - b.i);

  // 목표 경계 수: 3~6 (→ 구간 4~7)
  const targetBoundaries = Math.min(6, Math.max(3, Math.round(duration / 30)));
  const chosen: number[] = [];
  for (const c of candidates) {
    if (chosen.length >= targetBoundaries) break;
    if (chosen.every((x) => Math.abs(x - c.i) >= minGap)) chosen.push(c.i);
  }
  // 후보가 부족하면 균등 분할로 보충
  if (chosen.length < 3) {
    const k = 4;
    chosen.length = 0;
    for (let b = 1; b < k; b++) chosen.push(Math.floor((n * b) / k));
  }
  chosen.sort((a, b) => a - b);

  // 경계 → 구간(프레임 인덱스 범위)
  const bounds = [0, ...chosen, n];
  const segs: Segment[] = [];
  for (let s = 0; s < bounds.length - 1; s++) {
    const fi0 = bounds[s], fi1 = bounds[s + 1];
    let e = 0;
    for (let i = fi0; i < fi1; i++) e += frames[i].rms + frames[i].band.high * 0.001;
    e = e / Math.max(1, fi1 - fi0);
    segs.push({
      index: s,
      t0: frames[fi0].time,
      t1: s === bounds.length - 2 ? duration : frames[fi1].time,
      role: 'transition', // 아래에서 재지정
      energy: e,
      summary: '',
    });
  }
  // 에너지 정규화
  const en = normalizeArray(segs.map((s) => s.energy));
  segs.forEach((s, i) => (s.energy = en[i]));

  assignRoles(segs);
  return segs;
}

const ROLE_LABEL: Record<SegmentRole, string> = {
  intro: '서주의 여명',
  build: '긴장과 상승',
  climax: '폭풍의 절정',
  transition: '고요한 전환',
  release: '해소와 여운',
  outro: '침묵의 마침표',
};

function assignRoles(segs: Segment[]): void {
  const n = segs.length;
  // climax = 최대 에너지
  let climaxIdx = 0;
  for (let i = 1; i < n; i++) if (segs[i].energy > segs[climaxIdx].energy) climaxIdx = i;

  for (let i = 0; i < n; i++) {
    let role: SegmentRole;
    if (i === 0) role = 'intro';
    else if (i === n - 1) role = 'outro';
    else if (i === climaxIdx) role = 'climax';
    else if (i < climaxIdx) role = 'build';
    else role = segs[i].energy < segs[i - 1].energy ? 'release' : 'transition';
    segs[i].role = role;
    segs[i].summary = ROLE_LABEL[role];
  }
}
