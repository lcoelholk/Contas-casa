import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { db } from '../lib/supabase.ts'
import { mensagemErroLogin, useAuth } from '../lib/auth.tsx'
import { Carregando } from '../components/ui.tsx'

export default function Login() {
  const { sessao, carregando } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = (location.state as { de?: string } | null)?.de ?? '/'

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (carregando) return <Carregando />
  if (sessao) return <Navigate to={destino} replace />

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { error } = await db().auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    if (error) {
      setErro(mensagemErroLogin(error.message))
      return
    }
    navigate(destino, { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-marca-600 text-2xl text-white shadow-sm">
          🏠
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Contas da Casa</h1>
        <p className="mt-1 text-stone-600">Entre com o seu e-mail e senha.</p>
      </div>

      <form onSubmit={entrar} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">E-mail</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl border border-stone-300 bg-superficie px-3 text-base outline-none focus:border-marca-600 focus:ring-2 focus:ring-marca-100"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">Senha</span>
          <div className="relative">
            <input
              type={mostrarSenha ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="h-12 w-full rounded-xl border border-stone-300 bg-superficie px-3 pr-20 text-base outline-none focus:border-marca-600 focus:ring-2 focus:ring-marca-100"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-marca-700"
            >
              {mostrarSenha ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </label>

        {erro && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando || !email || !senha}
          className="mt-2 h-12 rounded-xl bg-marca-600 font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-stone-500">
        Esqueceu a senha? Ela pode ser trocada no painel do Supabase, em Authentication → Users.
      </p>
    </main>
  )
}
