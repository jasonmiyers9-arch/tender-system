'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-[--color-text-muted]">
      Loading admin dashboard...
    </div>
  );
}
