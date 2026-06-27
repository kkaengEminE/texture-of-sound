'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnalyzeProgress } from '@/components/AnalyzeProgress';
import { takePendingAudio, analyzeInWorker } from '@/lib/analyze-client';
import { savePainting } from '@/lib/store';
import { saveAudio } from '@/lib/store';

export default function AnalyzePage() {
  const router = useRouter();
  const [stage, setStage] = useState('analyze');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const audio = takePendingAudio();
    if (!audio) { router.replace('/'); return; }
    const title = sessionStorage.getItem('tos:pending-title') ?? 'untitled';
    const blob: File | undefined = (window as any).__tosPendingBlob;

    analyzeInWorker(audio, (m) => { setStage(m.stage); setPercent(m.percent); })
      .then(async (result) => {
        savePainting({
          seed: result.seed, song: result.song, comp: result.comp, strokes: result.strokes,
          meta: { title, duration: result.song.meta.duration, createdAt: Date.now() },
        });
        if (blob) {
          try { await saveAudio(result.seed, blob); }
          catch { /* audio is optional; viewer degrades gracefully */ }
        }
        router.replace(`/viewer?id=${result.seed}`);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '분석 실패'));
  }, [router]);

  return (
    <div className="mt-16">
      <h1 className="mb-8 text-center text-xl font-bold">AI가 음악을 분석하고 있습니다</h1>
      <AnalyzeProgress stage={stage} percent={percent} />
      {error && <p className="mt-6 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
