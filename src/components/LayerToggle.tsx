'use client';
import type { Layer } from '@/engine';

const LAYERS: { key: Layer; label: string }[] = [
  { key: 'all', label: '전체' }, { key: 'bass', label: '베이스' },
  { key: 'mid', label: '중음' }, { key: 'high', label: '고음' },
];

export function LayerToggle({ layer, onChange }: { layer: Layer; onChange: (l: Layer) => void }) {
  return (
    <div className="flex gap-2">
      {LAYERS.map((l) => (
        <button
          key={l.key}
          onClick={() => onChange(l.key)}
          className={`rounded-full px-3 py-1 text-sm ${layer === l.key ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
