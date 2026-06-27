import './globals.css';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';

export const metadata = { title: 'texture-of-sound', description: '음악을 회화로 번역' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white text-neutral-900">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
