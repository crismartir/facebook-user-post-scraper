'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type TenantOverview } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<TenantOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setOverview)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        throw err;
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await api.logout().catch(() => undefined);
    router.replace('/login');
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Carregando…</p>
      </main>
    );
  }

  if (!overview) {
    return null;
  }

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-opfy-violet">O</span>PFY
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {overview.tenant.name}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Sair
        </button>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Bem-vindo(a) ao OPFY Board</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          O Dashboard Executivo (Saúde da Empresa, KPIs, Recomendações) chega na Fase 1 do
          roadmap. Por enquanto, sua conta e sua empresa já estão configuradas.
        </p>
      </section>
    </main>
  );
}
