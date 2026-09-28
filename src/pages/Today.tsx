import { CalendarCheck, Check, CircleDot, Dumbbell, Flame, Footprints, Loader2, Plus, Ruler, Trophy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { addDays, formatDateWithWeekday, thisMonday, todayISO, weekdayOf } from '../lib/date'
import { explainPlanError, fetchWeek } from '../lib/plan'
import { SPORT_LABEL } from '../lib/sport'
import { isSupabaseConfigured } from '../lib/supabase'
import type { PlanItem, SportType, WorkoutRecord } from '../lib/types'
import { SPORT_ORDER } from '../lib/types'
import { explainWorkoutError, fetchRecords } from '../lib/workout'

const SPORT_ICON: Record<SportType, ReactNode> = {
  run: <Footprints size={18} />,
  football: <Trophy size={18} />,
  basketball: <CircleDot size={18} />,
  gym: <Dumbbell size={18} />,
}

/** 连续打卡天数：从今天（或昨天）往回数，连着有记录的天数 */
function computeStreak(records: WorkoutRecord[]): number {
  const days = new Set(records.map((r) => r.date))
  let cursor = todayISO()
  // 今天还没练不算「断了」，从昨天开始算
  if (!days.has(cursor)) cursor = addDays(cursor, -1)

  let streak = 0
  while (days.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

function Stat({ icon, label, value, unit }: { icon: ReactNode; label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1 text-[11px] text-slate-500">
        <span className="text-blue-500">{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="tnum text-2xl font-semibold tracking-tight text-slate-900">{value}</span>
        <span className="text-xs text-slate-400">{unit}</span>
      </div>
    </div>
  )
}

export default function Today() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [plan, setPlan] = useState<PlanItem[]>([])
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = todayISO()
  const todayWeekday = weekdayOf(today)

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [weekPlan, allRecords] = await Promise.all([fetchWeek(user.id, thisMonday()), fetchRecords(user.id)])
      setPlan(weekPlan)
      setRecords(allRecords)
    } catch (e) {
      const fromPlan = explainPlanError(e)
      setError(fromPlan === String(e) ? explainWorkoutError(e) : fromPlan)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const todayItem = plan.find((item) => item.weekday === todayWeekday)

  // 今天计划里的这一项，是不是已经记过了？
  const doneToday = todayItem
    ? records.some((r) => r.date === today && r.sport === todayItem.sport)
    : false

  const weekStart = thisMonday()
  const weekEnd = addDays(weekStart, 6)
  const weekRecords = records.filter((r) => r.date >= weekStart && r.date <= weekEnd)
  const runKm = weekRecords
    .filter((r) => r.sport === 'run')
    .reduce((sum, r) => sum + (r.run?.distance ?? 0), 0)
  const streak = computeStreak(records)

  function goLog(sport: SportType) {
    navigate(`/log?sport=${sport}&date=${today}`)
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
        还没配置数据库，先看看界面吧。
        <br />
        把 <code className="rounded bg-amber-100 px-1">.env.local</code> 里的两行密钥填上就能真用了。
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-3">
        <Stat
          icon={<Ruler size={13} />}
          label="本周跑量"
          value={runKm > 0 ? runKm.toFixed(1) : '0'}
          unit="km"
        />
        <Stat icon={<Flame size={13} />} label="本周训练" value={String(weekRecords.length)} unit="次" />
        <Stat icon={<CalendarCheck size={13} />} label="连续打卡" value={String(streak)} unit="天" />
      </section>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">{error}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">今天的安排</h2>
          <span className="text-xs text-slate-400">{formatDateWithWeekday(today)}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-400">
            <Loader2 size={15} className="animate-spin" />
            读取中…
          </div>
        ) : todayItem ? (
          <div className="p-4">
            <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-blue-600 shadow-sm">
                {SPORT_ICON[todayItem.sport]}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">
                  {SPORT_LABEL[todayItem.sport]} · {todayItem.target}
                </div>
                {todayItem.memo ? <div className="truncate text-xs text-slate-500">{todayItem.memo}</div> : null}
              </div>
              {doneToday ? (
                <span className="ml-auto flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
                  <Check size={15} />
                  已完成
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => goLog(todayItem.sport)}
                  className="ml-auto shrink-0 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  完成
                </button>
              )}
            </div>

            <p className="mt-3 text-center text-xs text-slate-400">
              {doneToday ? (
                <>
                  今天这一项已经记过了 ·{' '}
                  <button
                    type="button"
                    onClick={() => goLog(todayItem.sport)}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    再记一笔
                  </button>
                </>
              ) : (
                '点「完成」会跳出填写表格'
              )}
            </p>
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-400">今天没有安排</p>
            <button
              type="button"
              onClick={() => navigate('/plan')}
              className="mt-2 text-xs font-medium text-blue-600 hover:underline"
            >
              去计划页排一下 →
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">随手记一笔</h2>
        <div className="grid grid-cols-2 gap-3">
          {SPORT_ORDER.map((sport) => (
            <button
              key={sport}
              type="button"
              onClick={() => goLog(sport)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white py-4 text-slate-600 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/50 hover:text-blue-600"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-50">{SPORT_ICON[sport]}</span>
              <span className="text-sm font-medium">{SPORT_LABEL[sport]}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">忘了提前排计划？直接在这里补记，效果一样</p>
      </section>

      {records.length === 0 && !loading ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
          <Plus size={20} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">还没有任何记录</p>
          <p className="mt-1 text-xs text-slate-400">点上面任意一项，记下你的第一笔训练</p>
        </section>
      ) : null}
    </div>
  )
}
