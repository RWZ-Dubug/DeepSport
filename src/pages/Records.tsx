import { Loader2, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { formatDateWithWeekday } from '../lib/date'
import { SPORT_BADGE, SPORT_LABEL, groupGymSets } from '../lib/sport'
import { isSupabaseConfigured } from '../lib/supabase'
import type { SportType, WorkoutRecord } from '../lib/types'
import { SPORT_ORDER } from '../lib/types'
import { deleteRecord, explainWorkoutError, fetchRecords } from '../lib/workout'

type Filter = 'all' | SportType

/**
 * 筛选按钮从 SPORT_ORDER 自动生成，不要手写。
 * 之前手写成「全部/跑步/足球/健身」，加了篮球之后忘了同步，筛选里就少了篮球。
 * 这样写以后再加运动项目就不会漏。
 *
 * ⚠️ 踩过的坑（给以后的自己看）：
 * 这个文件曾经在同一条消息里被连续改了两次（先加下面这段代码、再加 SPORT_ORDER 的 import），
 * 两次改动落在同一秒，Vite 的文件监听只收到一次通知，于是**缓存了中间状态**：
 * 「用了 SPORT_ORDER 但没有 import 它」。结果浏览器一加载就 ReferenceError，整页白屏，
 * 而 tsc 和服务器都显示正常 —— 极难排查。
 * 教训：改同一个文件时，两次修改之间留出一点间隔，或者改完重启一下 dev server。
 */
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  ...SPORT_ORDER.map((sport) => ({ key: sport as Filter, label: SPORT_LABEL[sport] })),
]

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
      {children}
    </span>
  )
}

function RecordDetail({ record }: { record: WorkoutRecord }) {
  if (record.run) {
    const r = record.run
    return (
      <div className="flex flex-wrap gap-1.5">
        <Chip>
          <span className="tnum font-semibold text-slate-900">{r.distance}</span> 公里
        </Chip>
        {r.pace ? (
          <Chip>
            配速 <span className="tnum font-semibold text-slate-900">{r.pace}</span>
          </Chip>
        ) : null}
        {r.kind ? <Chip>{r.kind}</Chip> : null}
        {record.feel ? <Chip>感受 {record.feel}/5</Chip> : null}
        {r.heartRate ? (
          <Chip>
            心率 <span className="tnum">{r.heartRate}</span>
          </Chip>
        ) : null}
        {r.route ? <Chip>{r.route}</Chip> : null}
        {r.shoes ? <Chip>{r.shoes}</Chip> : null}
      </div>
    )
  }

  if (record.football) {
    const f = record.football
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {f.content ? <Chip>{f.content}</Chip> : null}
          {f.intensity ? <Chip>{f.intensity}</Chip> : null}
          {f.position ? <Chip>{f.position}</Chip> : null}
          {record.feel ? <Chip>感受 {record.feel}/5</Chip> : null}
          {f.goals ? <Chip>进球 {f.goals}</Chip> : null}
          {f.assists ? <Chip>助攻 {f.assists}</Chip> : null}
        </div>
        {f.opponent ? (
          <div className="text-xs text-slate-500">
            对手 {f.opponent}
            {f.score ? (
              <>
                {' · '}
                <span className="tnum font-medium text-slate-700">{f.score}</span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  if (record.basketball) {
    const b = record.basketball
    const stats: { label: string; value: number | undefined }[] = [
      { label: '得分', value: b.points },
      { label: '篮板', value: b.rebounds },
      { label: '助攻', value: b.assists },
      { label: '抢断', value: b.steals },
      { label: '盖帽', value: b.blocks },
      { label: '三分', value: b.threeMade },
      { label: '罚球', value: b.freeThrowsMade },
    ]
    const shown = stats.filter((s) => s.value !== undefined)

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {b.content ? <Chip>{b.content}</Chip> : null}
          {b.intensity ? <Chip>{b.intensity}</Chip> : null}
          {b.position ? <Chip>{b.position}</Chip> : null}
          {record.feel ? <Chip>感受 {record.feel}/5</Chip> : null}
        </div>

        {shown.length > 0 ? (
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {shown.map((s) => (
              <div key={s.label} className="rounded-lg bg-orange-50 px-1 py-1.5 text-center ring-1 ring-orange-200">
                <div className="tnum text-base font-semibold text-orange-700">{s.value}</div>
                <div className="text-[10px] text-orange-600/80">{s.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {b.opponent ? (
          <div className="text-xs text-slate-500">
            对手 {b.opponent}
            {b.score ? (
              <>
                {' · '}
                <span className="tnum font-medium text-slate-700">{b.score}</span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  if (record.gym) {
    const g = record.gym
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {g.part ? <Chip>{g.part}</Chip> : null}
          {record.rpe ? <Chip>RPE {record.rpe}/10</Chip> : null}
        </div>
        {g.sets.length > 0 ? (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-lg ring-1 ring-slate-200">
            {groupGymSets(g.sets).map(({ exercise, group }) => (
              <div key={exercise} className="flex items-center gap-3 bg-white px-3 py-2">
                <span className="w-28 shrink-0 truncate text-xs font-medium text-slate-700">{exercise}</span>
                <div className="flex flex-wrap gap-1">
                  {group.map((s) => (
                    <span key={s.setNo} className="tnum rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">
                      {s.weight}kg × {s.reps}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return null
}

export default function Records() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setRecords(await fetchRecords(user.id))
    } catch (e) {
      setError(explainWorkoutError(e))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete(record: WorkoutRecord) {
    const label = `${formatDateWithWeekday(record.date)} 的${SPORT_LABEL[record.sport]}记录`
    if (!window.confirm(`删掉 ${label}？删了就找不回来了`)) return

    setBusyId(record.id)
    setError(null)
    try {
      await deleteRecord(record.id)
      await load()
    } catch (e) {
      setError(explainWorkoutError(e))
    } finally {
      setBusyId(null)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
        还没配置数据库，记录功能暂时用不了。
      </div>
    )
  }

  const list = filter === 'all' ? records : records.filter((r) => r.sport === filter)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">训练记录</h1>
        <span className="text-xs text-slate-400">{loading ? '读取中…' : `共 ${records.length} 条`}</span>
        <button
          type="button"
          onClick={() => navigate('/log')}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus size={15} />
          记一笔
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 ring-1 ring-red-200">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          读取中…
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <p className="text-sm text-slate-500">{records.length === 0 ? '还没有任何记录' : '这个项目还没有记录'}</p>
          {records.length === 0 ? (
            <button
              type="button"
              onClick={() => navigate('/log')}
              className="mt-2 text-xs font-medium text-blue-600 hover:underline"
            >
              记下第一笔训练 →
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((record) => (
            <article key={record.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2.5 flex items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${SPORT_BADGE[record.sport]}`}>
                  {SPORT_LABEL[record.sport]}
                </span>
                <span className="text-xs text-slate-500">{formatDateWithWeekday(record.date)}</span>
                {record.duration ? (
                  <span className="tnum text-xs text-slate-400">· {record.duration} 分钟</span>
                ) : null}
                <div className="ml-auto flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => navigate(`/log?id=${record.id}`)}
                    className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label="编辑"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(record)}
                    disabled={busyId === record.id}
                    className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    aria-label="删除"
                  >
                    {busyId === record.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>

              <RecordDetail record={record} />

              {record.note ? (
                <p className="mt-2.5 border-t border-slate-100 pt-2.5 text-xs leading-relaxed text-slate-500">
                  {record.note}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
