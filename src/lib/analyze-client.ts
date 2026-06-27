import type { DecodedAudio } from '@/engine';
import type { ProgressMsg, PipelineResult } from './pipeline';
import type { WorkerIn, WorkerOut } from '@/workers/analyze.worker';

// 라우트 간 PCM 핸드오프 (모듈 메모리)
let pending: DecodedAudio | null = null;
export function setPendingAudio(a: DecodedAudio): void { pending = a; }
export function takePendingAudio(): DecodedAudio | null {
  const a = pending; pending = null; return a;
}

export function analyzeInWorker(
  audio: DecodedAudio,
  onProgress: (m: ProgressMsg) => void
): Promise<PipelineResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('@/workers/analyze.worker.ts', import.meta.url));
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m.msg);
      else if (m.type === 'done') { resolve(m.result); worker.terminate(); }
      else { reject(new Error(m.message)); worker.terminate(); }
    };
    worker.onerror = (e) => { reject(new Error(e.message)); worker.terminate(); };
    // PCM 버퍼 transfer (복사 없음)
    const transfer = [audio.mono.buffer, ...audio.channels.map((c) => c.buffer)];
    const msg: WorkerIn = { audio };
    worker.postMessage(msg, transfer);
  });
}
