import { BrushStroke, Segment, SongAnalysis } from '../types';

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const LAYER_KR: Record<BrushStroke['layer'], string> = {
  all: '전체', bass: '저음(베이스)', mid: '중음', high: '고음(심벌·하이햇)',
};

export function explainSegment(song: SongAnalysis, segment: Segment): string {
  const t = `${mmss(segment.t0)}~${mmss(segment.t1)}`;
  const energyWord = segment.energy > 0.66 ? '강한 에너지' : segment.energy > 0.33 ? '중간 정도의 흐름' : '잔잔한 기운';
  return `${t} — "${segment.summary}" 구간입니다. 이 곡(${song.meta.key}, ${song.meta.bpm} BPM)에서 ` +
    `${energyWord}을(를) 가진 부분으로, 화면의 해당 영역에 그 분위기가 공간으로 번역되었습니다.`;
}

export function explainStroke(
  song: SongAnalysis,
  stroke: BrushStroke
): { texture: string; brush: string } {
  const time = mmss(stroke.t0);
  const layer = LAYER_KR[stroke.layer];
  const hueName = hueToName(stroke.color.h);

  const texture =
    `${time} · ${layer} — 명도 ${(stroke.color.l * 100) | 0}%의 ${hueName} 계열로, ` +
    (stroke.blur > 6 ? '잔향이 많아 번지듯 부드럽게' : '윤곽이 또렷하게') + ' 표현되었습니다.';

  const pressureWord = stroke.pressure > 0.66 ? '강한 Attack으로 거친 붓이' :
    stroke.pressure > 0.33 ? '중간 압력의 붓이' : '약한 압력의 붓이';
  const speedWord = stroke.speed > 0.6 ? '빠르게' : stroke.speed > 0.3 ? '차분하게' : '천천히';
  const brush =
    `이 구간은 ${pressureWord} ${speedWord} 지나가는 질감으로 그려졌습니다. ` +
    `붓 두께 ${Math.round(stroke.width)}px, 길이 약 ${Math.round(stroke.length)}px.`;

  return { texture, brush };
}

function hueToName(h: number): string {
  if (h < 30 || h >= 330) return '붉은';
  if (h < 70) return '노란';
  if (h < 160) return '초록';
  if (h < 200) return '청록';
  if (h < 260) return '파란';
  return '보라';
}
