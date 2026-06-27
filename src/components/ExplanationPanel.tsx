'use client';
import { explainSegment, explainStroke } from '@/engine';
import type { SongAnalysis, Segment, BrushStroke } from '@/engine';

export type Selection =
  | { kind: 'segment'; segment: Segment }
  | { kind: 'stroke'; stroke: BrushStroke }
  | null;

export function ExplanationPanel({ song, selection }: { song: SongAnalysis; selection: Selection }) {
  if (!selection) {
    return <p className="text-sm text-neutral-500">그림이나 구간을 클릭하면 해설이 나타납니다.</p>;
  }
  if (selection.kind === 'segment') {
    return (
      <div>
        <h3 className="mb-2 font-bold">AI 시각 해설</h3>
        <p className="text-sm leading-relaxed text-neutral-700">{explainSegment(song, selection.segment)}</p>
      </div>
    );
  }
  const { texture, brush } = explainStroke(song, selection.stroke);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1 font-bold">색감·질감 설명</h3>
        <p className="text-sm leading-relaxed text-neutral-700">{texture}</p>
      </div>
      <div>
        <h3 className="mb-1 font-bold">붓 움직임 설명</h3>
        <p className="text-sm leading-relaxed text-neutral-700">{brush}</p>
      </div>
    </div>
  );
}
