import { decodeAudioData, DecodedAudio } from '@/engine';

export async function decodeFile(file: File): Promise<DecodedAudio> {
  const buf = await file.arrayBuffer();
  return decodeAudioData(buf);
}
