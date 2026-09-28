import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import Layout from './components/Layout'
import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/auth-context'
import { isSupabaseConfigured } from './lib/supabase'
import Feed from './pages/Feed'
import Login from './pages/Login'
import LogWorkout from './pages/LogWorkout'
import Plan from './pages/Plan'
import Records from './pages/Records'
import Today from './pages/Today'

/**
 * 登录守门人：
 * - 还没配数据库（预览模式）→ 直接放行，方便先看界面
 * - 配好了但没登录 → 赶回登录页
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth()

  if (!ready) {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-400">正在连接数据库…</div>
  }
  if (isSupabaseConfigured && !user) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Today />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/records" element={<Records />} />
          <Route path="/log" element={<LogWorkout />} />
          <Route path="/feed" element={<Feed />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
