'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.register({ companyName, email, password });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar sua conta.');
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
            Experimente grátis por 7 dias — sem cartão de crédito
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h1 className="text-lg font-semibold">Crie sua conta</h1>

          <Field label="Nome da empresa">
            <input
              required
              minLength={2}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
              placeholder="Acme Soluções"
            />
          </Field>

          <Field label="E-mail">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="voce@empresa.com"
            />
          </Field>

          <Field label="Senha">
            <input
              required
              minLength={12}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="Mínimo de 12 caracteres"
            />
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'Criando conta…' : 'Começar agora'}
          </button>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Já tem conta?{' '}
            <Link href="/login" className="text-opfy-violet hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-opfy-violet focus:ring-1 focus:ring-opfy-violet dark:border-slate-700';

const buttonClass =
  'w-full rounded-lg bg-opfy-violet px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-opfy-violetDark disabled:opacity-60';
