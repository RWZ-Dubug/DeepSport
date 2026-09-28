import { CalendarCheck, ClipboardList, Dumbbell, ListChecks, LogOut, UsersRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { isSupabaseConfigured } from '../lib/supabase'

const NAV = [
  { to: '/', label: '今天', icon: CalendarCheck },
  { to: '/plan', label: '计划', icon: ListChecks },
  { to: '/records', label: '记录', icon: ClipboardList },
  { to: '/feed', label: '动态', icon: UsersRound },
]

function navClass(isActive: boolean, mobile: boolean) {
  const base = mobile
    ? 'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors'
    : 'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors'
  return `${base} ${isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`
}

export default function Layout() {
  const { nickname, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-white">
              <Dumbbell size={16} strokeWidth={2.5} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">DeepSport</span>
          </div>

          <nav className="ml-5 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => navClass(isActive, false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <span className="hidden max-w-[8rem] truncate text-sm text-slate-500 sm:inline">{nickname}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>
      </header>

      {!isSupabaseConfigured ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto max-w-3xl px-4 py-1.5 text-[12px] text-amber-800">
            预览模式 —— 还没填数据库密钥，数据都是假的
          </div>
        </div>
      ) : (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto max-w-3xl px-4 py-1.5 text-[12px] text-amber-800">
            账号已接数据库；训练数据还是假的，第 3-4 步换成真的
          </div>
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 pt-5 pb-24 md:pb-10">
        <Outlet />
      </main>

      {/* 手机上用底部标签栏，拇指够得着 */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white md:hidden">
        <div className="mx-auto flex max-w-3xl">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => navClass(isActive, true)}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
