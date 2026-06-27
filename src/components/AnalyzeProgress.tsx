const LABELS: Record<string, string> = {
  analyze: '음악 분석 중',
  visual: '시각 언어 변환 중',
  compose: '구도 설계 중',
  brush: '붓 경로 생성 중',
  done: '완료',
};

export function AnalyzeProgress({ stage, percent }: { stage: string; percent: number }) {
  return (
    <div className="mx-auto max-w-xl">
      <p className="mb-2 text-sm text-neutral-600">{LABELS[stage] ?? stage}</p>
      <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full bg-neutral-900 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-right text-sm text-neutral-500">{percent}%</p>
    </div>
  );
}
