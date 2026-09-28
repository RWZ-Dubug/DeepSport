import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext } from './auth-context'
import type { AuthValue } from './auth-context'
import { isSupabaseConfigured, supabase } from './supabase'

/** 把 Supabase 的英文报错翻译成「人话 + 该去点哪里」，不然初学者只能干瞪眼 */
function translate(message: string): string {
  if (/invalid login credentials/i.test(message)) return '邮箱或密码不对，再检查一下'

  if (/email_provider_disabled|email signups are disabled/i.test(message))
    return 'Supabase 后台把「邮箱登录」整个关掉了。去 Authentication → Sign In / Providers → Email，把 Enable Email provider 打开再试'

  if (/email not confirmed/i.test(message))
    return '这个邮箱还没验证。去 Authentication → Sign In / Providers 页面，把 Confirm email 关掉就好了'

  if (/user already registered/i.test(message)) return '这个邮箱已经注册过了，切到「登录」标签试试'

  if (/password should be at least/i.test(message)) return '密码太短了，至少要 6 位'

  if (/unable to validate email|invalid email/i.test(message)) return '邮箱格式不对，检查一下有没有写错'

  if (/rate limit|too many requests/i.test(message)) return '试得太频繁了，等一分钟再试'

  if (/signups not allowed/i.test(message))
    return 'Supabase 后台把「允许注册」关掉了，去 Authentication → Sign In / Providers 里打开'

  if (/failed to fetch|network|fetch failed/i.test(message))
    return '连不上数据库。检查一下网络，或者 .env.local 里的地址/密钥填错了'

  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // 没配数据库时直接就算「准备好了」，走预览模式
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!supabase) return

    let alive = true

    // 兜底：万一网络卡住，getSession() 可能很久都不返回，
    // 那样界面会永远停在「正在连接…」。8 秒后无论如何先放行。
    const timer = window.setTimeout(() => {
      if (alive) setReady(true)
    }, 8000)

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return
        setSession(data.session)
        setReady(true)
      })
      .catch(() => {
        if (alive) setReady(true)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => {
      alive = false
      window.clearTimeout(timer)
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(() => {
    const user = session?.user ?? null
    const metaName = user?.user_metadata?.nickname

    return {
      ready,
      user,
      session,
      nickname: (typeof metaName === 'string' && metaName) || user?.email?.split('@')[0] || '我',

      signIn: async (email, password) => {
        if (!supabase) return '还没配置数据库'
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? translate(error.message) : null
      },

      signUp: async (email, password, nickname) => {
        if (!supabase) return { error: '还没配置数据库', needsConfirm: false }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname } },
        })

        if (error) return { error: translate(error.message), needsConfirm: false }

        // 注册成功却没给登录凭证 = 后台要求先验证邮箱
        const needsConfirm = Boolean(data.user) && !data.session
        return { error: null, needsConfirm }
      },

      signOut: async () => {
        if (!supabase) return
        await supabase.auth.signOut()
      },
    }
  }, [ready, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
