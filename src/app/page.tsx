'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { UploadDropzone } from '@/components/UploadDropzone';
import { decodeFile } from '@/lib/decode';
import { setPendingAudio } from '@/lib/analyze-client';

declare global {
  interface Window { __tosPendingBlob?: File }
}

export default function Home() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setError(null); setBusy(true);
    try {
      const audio = await decodeFile(file);
      setPendingAudio(audio);
      sessionStorage.setItem('tos:pending-title', file.name);
      // 재생용 원본 blob을 임시 보관 (analyze에서 seed 확정 후 IndexedDB 저장)
      window.__tosPendingBlob = file;
      router.push('/analyze');
    } catch (e) {
      setError(e instanceof Error ? e.message : '디코드 실패');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">음악-회화 번역</h1>
      <UploadDropzone onFile={onFile} />
      {busy && <p className="mt-4 text-sm text-neutral-500">디코딩 중…</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
