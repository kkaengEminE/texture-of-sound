import { ANALYSIS, DecodedAudio } from '../types';
import { downmix } from '../util/dsp';

// 브라우저 전용: OfflineAudioContext로 디코드 + 44100Hz 리샘플.
// 순수 부분(downmix)은 dsp.ts에서 단위 테스트됨.
export async function decodeAudioData(input: ArrayBuffer): Promise<DecodedAudio> {
  const Ctx: typeof OfflineAudioContext =
    (globalThis as any).OfflineAudioContext || (globalThis as any).webkitOfflineAudioContext;
  if (!Ctx) throw new Error('OfflineAudioContext를 사용할 수 없습니다(브라우저 전용).');

  // 임시 컨텍스트로 디코드
  const tmp = new Ctx(1, 1, ANALYSIS.sampleRate);
  const decoded = await tmp.decodeAudioData(input.slice(0));

  // 44100Hz로 리샘플
  const frames = Math.ceil(decoded.duration * ANALYSIS.sampleRate);
  const off = new Ctx(decoded.numberOfChannels, frames, ANALYSIS.sampleRate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();

  const channels: Float32Array[] = [];
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    channels.push(rendered.getChannelData(c).slice());
  }
  const mono = downmix(channels);
  return {
    sampleRate: ANALYSIS.sampleRate,
    length: mono.length,
    duration: mono.length / ANALYSIS.sampleRate,
    channels,
    mono,
  };
}
