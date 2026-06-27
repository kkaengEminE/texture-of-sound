import Link from 'next/link';

export function Sidebar() {
  return (
    <aside className="w-48 border-r border-neutral-200 p-6 text-sm">
      <div className="mb-4 font-bold">texture-of-sound</div>
      <nav className="space-y-2">
        <Link href="/" className="block text-neutral-700 hover:text-neutral-900">홈 · 업로드</Link>
        <span className="block text-neutral-300">갤러리 (준비 중)</span>
      </nav>
    </aside>
  );
}
