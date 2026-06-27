'use client';
import { useRef } from 'react';

export function UploadDropzone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handle = (files: FileList | null) => {
    if (files && files[0]) onFile(files[0]);
  };
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 p-16 text-center"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
    >
      <p className="mb-2 text-lg">음악 파일을 끌어다 놓거나 선택하세요</p>
      <p className="mb-6 text-sm text-neutral-500">지원 형식: MP3, WAV, FLAC</p>
      <button
        type="button"
        className="rounded-lg bg-neutral-900 px-5 py-2 text-white"
        onClick={() => inputRef.current?.click()}
      >
        파일 선택
      </button>
      <input
        ref={inputRef}
        data-testid="file-input"
        type="file"
        accept="audio/*,.mp3,.wav,.flac"
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
    </div>
  );
}
