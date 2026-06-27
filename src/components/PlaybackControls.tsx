'use client';

function mmss(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PlaybackControls({
  playing, currentTime, duration, onToggle, onSeek,
}: {
  playing: boolean; currentTime: number; duration: number;
  onToggle: () => void; onSeek: (t: number) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <button onClick={onToggle} className="rounded-lg bg-neutral-900 px-4 py-2 text-white">
        {playing ? '일시정지' : '재생'}
      </button>
      <span className="text-sm tabular-nums text-neutral-500">{mmss(currentTime)}</span>
      <input
        type="range" min={0} max={duration || 0} step={0.01} value={currentTime}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="flex-1"
        aria-label="재생 위치"
      />
      <span className="text-sm tabular-nums text-neutral-500">{mmss(duration)}</span>
    </div>
  );
}
