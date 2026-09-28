import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eraser,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/auth-context'
import { addDays, formatWeekRange, relativeWeekLabel, thisMonday, todayISO, weekdayOf } from '../lib/date'
import {
  clearWeek,
  copyWeek,
  createPlanItem,
  deletePlanItem,
  explainPlanError,
  fetchWeek,
  updatePlanItem,
} from '../lib/plan'
import { SPORT_DOT, SPORT_LABEL, WEEKDAYS } from '../lib/sport'
import { isSupabaseConfigured } from '../lib/supabase'
import type { PlanDraft, PlanItem } from '../lib/types'
import { SPORT_ORDER } from '../lib/types'

const SPORTS = SPORT_ORDER

const btnGhost =
  'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50'
const btnPrimary =
  'flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50'
const btnIcon = 'shrink-0 rounded-lg p-1.5 transition-colors disabled:opacity-50'

export default function Plan() {
  const { user } = useAuth()

  const [weekStart, setWeekStart] = useState(thisMonday)
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<PlanDraft>({ sport: 'run', target: '', memo: '' })
  const [saving, setSaving] = useState(false)

  const todayWeekday = weekdayOf(todayISO())
  const weekLabel = relativeWeekLabel(weekStart)
  const isCurrentWeek = weekLabel === '本周'

  const reload = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchWeek(user.id, weekStart))
    } catch (e) {
      setError(explainPlanError(e))
    } finally {
      setLoading(false)
    }
  }, [user, weekStart])

  useEffect(() => {
    void reload()
  }, [reload])

  function startAdd(weekday: number) {
    setEditing(weekday)
    setDraft({ sport: 'run', target: '', memo: '' })
    setError(null)
  }

  function startEdit(item: PlanItem) {
    setEditing(item.weekday)
    setDraft({ sport: item.sport, target: item.target, memo: item.memo ?? '' })
    setError(null)
  }

  async function save(weekday: number) {
    if (!user) return
    if (!draft.target.trim()) {
      setError('「目标」不能空着，比如填「5 公里」或「胸 + 三头」')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const existing = items.find((i) => i.weekday === weekday)
      if (existing) {
        await updatePlanItem(existing.id, draft)
      } else {
        await createPlanItem({ userId: user.id, weekStart, weekday, ...draft })
      }
      setEditing(null)
      await reload()
    } catch (e) {
      setError(explainPlanError(e))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: PlanItem) {
    const name = `${WEEKDAYS[item.weekday - 1]}「${SPORT_LABEL[item.sport]} · ${item.target}」`
    if (!window.confirm(`删掉 ${name} ？`)) return

    setSaving(true)
    setError(null)
    try {
      await deletePlanItem(item.id)
      await reload()
    } catch (e) {
      setError(explainPlanError(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyLastWeek() {
    if (!user) return
    const from = addDays(weekStart, -7)
    const ok = window.confirm(
      `把上周（${formatWeekRange(from)}）的安排照抄到这一周？\n\n` +
        `⚠️ 这一周已有的安排会被覆盖。`,
    )
    if (!ok) return

    setSaving(true)
    setError(null)
    try {
      const count = await copyWeek(user.id, from, weekStart)
      if (count === 0) {
        setError('上周没有安排，没什么可复制的。你可以手动往下面几行里加。')
      }
      await reload()
    } catch (e) {
      setError(explainPlanError(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!user) return
    if (items.length > 0 && !window.confirm(`清空这一周的 ${items.length} 条安排？`)) return

    setSaving(true)
    setError(null)
    try {
      await clearWeek(user.id, weekStart)
      await reload()
    } catch (e) {
      setError(explainPlanError(e))
    } finally {
      setSaving(false)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
        还没配置数据库，计划功能暂时用不了。
        <br />
        把 <code className="rounded bg-amber-100 px-1">.env.local</code> 里的两行密钥填上就好了。
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 顶部：周切换 */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 px-2 py-2">
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className={`${btnIcon} text-slate-400 hover:bg-slate-100 hover:text-slate-600`}
            aria-label="上一周"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <div className="text-sm font-semibold text-slate-900">
              {weekLabel || '这一周'}
              <span className="mx-1.5 font-normal text-slate-300">·</span>
              <span className="font-normal text-slate-500">{formatWeekRange(weekStart)}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {loading ? '读取中…' : items.length > 0 ? `已排 ${items.length} 天` : '这一周还空着'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className={`${btnIcon} text-slate-400 hover:bg-slate-100 hover:text-slate-600`}
            aria-label="下一周"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2.5">
          {!isCurrentWeek ? (
            <button type="button" onClick={() => setWeekStart(thisMonday())} className={btnGhost}>
              回到本周
            </button>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={handleClear} disabled={saving || items.length === 0} className={btnGhost}>
              <Eraser size={15} />
              清空
            </button>
            <button type="button" onClick={handleCopyLastWeek} disabled={saving} className={btnPrimary}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
              复制上周
            </button>
          </div>
        </div>
      </div>

      {/* 报错提示 */}
      {error ? (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 ring-1 ring-red-200">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-red-500" />
          <p className="flex-1 text-xs leading-relaxed text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded p-0.5 text-red-400 hover:bg-red-100"
            aria-label="关闭"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* 七天 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {WEEKDAYS.map((name, index) => {
          const weekday = index + 1
          const item = items.find((i) => i.weekday === weekday)
          const isToday = isCurrentWeek && weekday === todayWeekday
          const isEditing = editing === weekday

          return (
            <div
              key={weekday}
              className={`border-b border-slate-100 last:border-b-0 ${isToday ? 'bg-blue-50/50' : ''}`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-11 shrink-0">
                  <div className={`text-sm font-medium ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>{name}</div>
                  {isToday ? <div className="text-[10px] text-blue-500">今天</div> : null}
                </div>

                {item && !isEditing ? (
                  <>
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${SPORT_DOT[item.sport]}`} />
                      <div className="min-w-0">
                        <div className="truncate text-sm text-slate-900">
                          <span className="font-medium">{SPORT_LABEL[item.sport]}</span>
                          <span className="mx-1.5 text-slate-300">·</span>
                          {item.target}
                        </div>
                        {item.memo ? <div className="truncate text-xs text-slate-500">{item.memo}</div> : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      disabled={saving}
                      className={`${btnIcon} text-slate-300 hover:bg-slate-100 hover:text-slate-600`}
                      aria-label="编辑"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      disabled={saving}
                      className={`${btnIcon} text-slate-300 hover:bg-red-50 hover:text-red-500`}
                      aria-label="删除"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : null}

                {!item && !isEditing ? (
                  <>
                    <div className="flex-1 text-sm text-slate-300">休息 / 空着</div>
                    <button
                      type="button"
                      onClick={() => startAdd(weekday)}
                      disabled={saving}
                      className={`${btnIcon} flex items-center gap-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600`}
                    >
                      <Plus size={15} />
                      <span className="text-xs font-medium">加安排</span>
                    </button>
                  </>
                ) : null}
              </div>

              {/* 行内编辑表单 */}
              {isEditing ? (
                <div className="border-t border-blue-100 bg-blue-50/40 px-4 py-3">
                  <div className="mb-2.5 grid grid-cols-2 gap-1.5">
                    {SPORTS.map((sport) => (
                      <button
                        key={sport}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, sport }))}
                        className={`rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                          draft.sport === sport
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {SPORT_LABEL[sport]}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={draft.target}
                    onChange={(e) => setDraft((d) => ({ ...d, target: e.target.value }))}
                    placeholder={
                      draft.sport === 'run'
                        ? '跑多少，比如「5 公里」'
                        : draft.sport === 'gym'
                          ? '练哪块，比如「胸 + 三头」'
                          : draft.sport === 'basketball'
                            ? '练什么，比如「投篮 + 对抗」'
                            : '练什么，比如「队内对抗」'
                    }
                    className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />

                  <input
                    type="text"
                    value={draft.memo}
                    onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))}
                    placeholder="备注（可留空）：几点、跟谁、什么强度…"
                    className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      disabled={saving}
                      className={`${btnGhost} ml-auto`}
                    >
                      <X size={15} />
                      取消
                    </button>
                    <button type="button" onClick={() => save(weekday)} disabled={saving} className={btnPrimary}>
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      保存
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <p className="text-xs leading-relaxed text-slate-400">
        排好这一周之后，下周点一下右上角的「复制上周」就整周搬过来了，想换一天就直接改。
      </p>
    </div>
  )
}
