'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { loadPainting, loadAudio } from '@/lib/store';
import type { StoredPainting } from '@/lib/types';
import { segmentAtTime } from '@/engine';
import type { Layer, BrushStroke } from '@/engine';
import { PaintingCanvas } from '@/components/PaintingCanvas';
import { PlaybackControls } from '@/components/PlaybackControls';
import { SegmentChips } from '@/components/SegmentChips';
import { LayerToggle } from '@/components/LayerToggle';
import { ExplanationPanel } from '@/components/ExplanationPanel';
import type { Selection } from '@/components/ExplanationPanel';

export default function ViewerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [painting, setPainting] = useState<StoredPainting | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [layer, setLayer] = useState<Layer>('all');
  const [selection, setSelection] = useState<Selection>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const p = loadPainting(id);
    if (!p) { router.replace('/'); return; }
    setPainting(p);
    loadAudio(id).then((blob) => { if (blob) setAudioUrl(URL.createObjectURL(blob)); });
  }, [id, router]);

  // audio element 시간 동기화
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onEnd = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    return () => { el.removeEventListener('timeupdate', onTime); el.removeEventListener('ended', onEnd); };
  }, [audioUrl]);

  if (!painting) return <p className="text-sm text-neutral-500">불러오는 중…</p>;

  const segments = painting.song.segments;
  const activeIndex = segments.length ? segmentAtTime(segments, currentTime).index : 0;

  function toggle() {
    const el = audioRef.current; if (!el) return;
    if (playing) { el.pause(); setPlaying(false); } else { el.play(); setPlaying(true); }
  }
  function seek(t: number) {
    const el = audioRef.current; if (el) el.currentTime = t;
    setCurrentTime(t);
  }
  function selectSegment(i: number) {
    const seg = segments.find((s) => s.index === i);
    if (seg) { setSelection({ kind: 'segment', segment: seg }); seek(seg.t0); }
  }
  function pickStroke(s: BrushStroke) { setSelection({ kind: 'stroke', stroke: s }); }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <h1 className="text-xl font-bold">연속 회화 뷰어</h1>
        <PaintingCanvas
          strokes={painting.strokes} comp={painting.comp} layer={layer}
          currentTime={currentTime} onPick={pickStroke}
        />
        <LayerToggle layer={layer} onChange={setLayer} />
        <SegmentChips segments={segments} activeIndex={activeIndex} onSelect={selectSegment} />
        {audioUrl ? (
          <>
            <audio ref={audioRef} src={audioUrl} preload="auto" />
            <PlaybackControls
              playing={playing} currentTime={currentTime} duration={painting.song.meta.duration}
              onToggle={toggle} onSeek={seek}
            />
          </>
        ) : (
          <p className="text-sm text-neutral-500">오디오를 불러올 수 없습니다. 다시 업로드하면 재생됩니다.</p>
        )}
      </div>
      <aside className="rounded-lg border border-neutral-200 p-4">
        <ExplanationPanel song={painting.song} selection={selection} />
      </aside>
    </div>
  );
}
