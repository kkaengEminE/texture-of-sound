'use client';
import type { Segment } from '@/engine';

export function SegmentChips({
  segments, activeIndex, onSelect,
}: { segments: Segment[]; activeIndex: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {segments.map((s) => (
        <button
          key={s.index}
          onClick={() => onSelect(s.index)}
          className={`rounded-full px-3 py-1 text-sm ${s.index === activeIndex ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'}`}
        >
          {s.summary}
        </button>
      ))}
    </div>
  );
}
