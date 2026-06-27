import { ANALYSIS, DecodedAudio } from '../types';
import { downmix } from '../util/dsp';

// 브라우저 전용: OfflineAudioContext로 디코드 + 44100Hz 리샘플.
// 순수 부분(downmix)은 dsp.ts에서 단위 테스트됨.
//
// [결정론 경계(Determinism Boundary)]
// "같은 음악 파일 → 동일한 그림" 보장은 단일 디코드 환경 내에서만 성립한다.
// OfflineAudioContext의 리샘플링은 브라우저 구현에 따라 다르므로,
// 같은 파일이라도 Chrome vs Firefox vs Safari에서 디코드하면 바이트 단위로
// 다른 PCM이 생성될 수 있다. 엔진의 결정론 보장은 디코드 이후 단계(분석→VLE→합성)에만 적용된다.
//
// TODO(plan-2): 브라우저 통합 테스트에서 Meyda 5.6의 spectralCentroid 단위를
// 검증할 것 (bin 단위 vs Hz 단위). Hz 단위라면 brightness 계산에서
// sampleRate/windowSize를 이미 곱한 값에 다시 곱하지 않도록 주의.
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
