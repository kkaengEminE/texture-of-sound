import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UploadDropzone } from '@/components/UploadDropzone';

describe('UploadDropzone', () => {
  it('파일 선택 시 onFile 호출', () => {
    const onFile = vi.fn();
    render(<UploadDropzone onFile={onFile} />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2])], 'song.mp3', { type: 'audio/mpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });
  it('지원 형식 안내 문구 표시', () => {
    render(<UploadDropzone onFile={() => {}} />);
    expect(screen.getByText(/MP3|WAV|FLAC/i)).toBeInTheDocument();
  });
});
