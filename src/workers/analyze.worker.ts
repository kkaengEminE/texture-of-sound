/// <reference lib="webworker" />
import { runPipeline } from '@/lib/pipeline';
import type { DecodedAudio } from '@/engine';
import type { ProgressMsg, PipelineResult } from '@/lib/pipeline';

export type WorkerIn = { audio: DecodedAudio };
export type WorkerOut =
  | { type: 'progress'; msg: ProgressMsg }
  | { type: 'done'; result: PipelineResult }
  | { type: 'error'; message: string };

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  try {
    const result = runPipeline(e.data.audio, (msg) =>
      (self as unknown as Worker).postMessage({ type: 'progress', msg } as WorkerOut)
    );
    (self as unknown as Worker).postMessage({ type: 'done', result } as WorkerOut);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'error', message: err instanceof Error ? err.message : String(err),
    } as WorkerOut);
  }
};
