'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.login({ email, password });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-opfy-violet">O</span>PFY
          </span>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Seu Conselho Executivo Inteligente
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h1 className="text-lg font-semibold">Entrar</h1>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              E-mail
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="voce@empresa.com"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Senha
            </span>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="Sua senha"
            />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Ainda não tem conta?{' '}
            <Link href="/register" className="text-opfy-violet hover:underline">
              Experimente grátis
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-opfy-violet focus:ring-1 focus:ring-opfy-violet dark:border-slate-700';

const buttonClass =
  'w-full rounded-lg bg-opfy-violet px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-opfy-violetDark disabled:opacity-60';
