import { Dumbbell, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { isSupabaseConfigured } from '../lib/supabase'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

export default function Login() {
  const { ready, user, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isRegister = mode === 'register'

  // 兜底：只要「已登录」这个状态一到，就立刻进首页。
  //
  // 为什么需要这个？Supabase 登录成功是通过 onAuthStateChange 异步通知的，
  // 而注册/登录返回后我们马上 navigate('/')，此时 React 状态可能还没更新，
  // RequireAuth 会把用户当成「未登录」又弹回登录页 —— 表现就是「点了注册没反应」。
  // 这个 effect 保证状态一到就补上，同时也能把已登录却停在登录页的人送走。
  useEffect(() => {
    if (ready && user) {
      navigate('/', { replace: true })
    }
  }, [ready, user, navigate])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('邮箱和密码都要填')
      return
    }
    if (isRegister && !nickname.trim()) {
      setError('还没填昵称')
      return
    }

    setBusy(true)

    if (isRegister) {
      const { error: message, needsConfirm } = await signUp(email.trim(), password, nickname.trim())
      setBusy(false)
      if (message) {
        setError(message)
        return
      }
      if (needsConfirm) {
        setError(
          '账号建好了，但 Supabase 还要求先去邮箱点确认链接。去 Authentication → Sign In / Providers → Email，把「Confirm email」关掉，就能直接登录了',
        )
        setMode('login')
        return
      }
      navigate('/', { replace: true })
      return
    }

    const message = await signIn(email.trim(), password)
    setBusy(false)
    if (message) {
      setError(message)
      return
    }
    navigate('/', { replace: true })
  }

  function switchMode(next: 'login' | 'register') {
    setMode(next)
    setError(null)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <Dumbbell size={24} strokeWidth={2.5} />
          </span>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">DeepSport</h1>
          <p className="mt-1 text-sm text-slate-500">足球 · 跑步 · 健身，一起练</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex rounded-lg bg-slate-100 p-0.5">
            {(['login', 'register'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  mode === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {key === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            {isRegister ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">昵称</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="别人在动态里看到的名字"
                  className={inputClass}
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">邮箱</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">密码</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className={inputClass}
              />
            </label>

            {error ? (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? '请稍等…' : isRegister ? '注册并进入' : '登录'}
            </button>
          </form>

          {!isSupabaseConfigured ? (
            <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200">
              <div className="flex items-start gap-2">
                <TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />
                <div className="text-[11px] leading-relaxed text-amber-800">
                  还没填数据库密钥，所以现在注册登录是不通的。
                  <br />
                  填好 <code className="rounded bg-amber-100 px-1">.env.local</code> 里的两行就能用了。
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-2.5 w-full rounded-lg border border-amber-300 bg-white py-2 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-50"
              >
                先不管，看看界面 →
              </button>
            </div>
          ) : null}
        </div>

        {isSupabaseConfigured ? (
          <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
            注册后直接就能用，不用去邮箱点验证链接
          </p>
        ) : null}
      </div>
    </div>
  )
}
