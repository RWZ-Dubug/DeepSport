import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

/**
 * 登录状态的「上下文」定义。
 *
 * 为什么单独放一个文件、而不是和 AuthProvider 写在一起？
 * 因为 React 的热更新（改代码不刷新页面就生效）有个要求：
 * 一个文件里如果既导出组件、又导出普通函数，那个文件的组件热更新会失效。
 * 所以这里只放「上下文 + 钩子」，组件放 auth.tsx。
 */

export type SignUpResult = {
  error: string | null
  /** 注册成功，但后台要求先去邮箱点确认链接（说明 Confirm email 没关掉） */
  needsConfirm: boolean
}

export type AuthValue = {
  /** 是否已经问过 Supabase「我现在登录着吗」 */
  ready: boolean
  user: User | null
  session: Session | null
  /** 显示用的名字 */
  nickname: string
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, nickname: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须放在 <AuthProvider> 里面')
  return ctx
}
