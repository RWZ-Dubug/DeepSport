import { ArrowLeft, Check, Loader2, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { todayISO } from '../lib/date'
import { SPORT_LABEL } from '../lib/sport'
import { isSupabaseConfigured } from '../lib/supabase'
import type { SportType, WorkoutDraft, WorkoutRecord } from '../lib/types'
import { SPORT_ORDER } from '../lib/types'
import { computePace, deleteRecord, explainWorkoutError, fetchRecord, saveRecord } from '../lib/workout'

const RUN_KINDS = ['轻松跑', '间歇跑', '长距离', '比赛', '恢复跑']

const FOOTBALL_CONTENTS = ['传球', '射门', '盘带', '体能', '战术', '对抗']
const FOOTBALL_INTENSITY = ['轻松', '中等', '比赛强度']
const FOOTBALL_POSITIONS = ['前锋', '中场', '后卫', '门将']

const BASKETBALL_CONTENTS = ['投篮', '运球', '突破', '战术', '体能', '对抗']
const BASKETBALL_POSITIONS = ['控球后卫', '得分后卫', '小前锋', '大前锋', '中锋']

const GYM_PARTS = ['胸', '背', '腿', '肩', '手臂', '核心', '全身']

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

function emptyDraft(sport: SportType, date: string): WorkoutDraft {
  return {
    date,
    sport,
    duration: '',
    feel: '',
    rpe: '',
    note: '',
    run: { distance: '', kind: '轻松跑', heartRate: '', route: '', shoes: '' },
    football: {
      content: '对抗',
      intensity: '中等',
      position: '中场',
      opponent: '',
      score: '',
      goals: '',
      assists: '',
    },
    basketball: {
      content: '对抗',
      intensity: '中等',
      position: '得分后卫',
      opponent: '',
      score: '',
      points: '',
      rebounds: '',
      assists: '',
      steals: '',
      blocks: '',
      threeMade: '',
      freeThrowsMade: '',
    },
    gym: { part: '胸', exercises: [{ name: '', sets: [{ reps: '', weight: '' }] }] },
  }
}

/** 数据库记录 → 表单内容（编辑时用） */
function recordToDraft(record: WorkoutRecord): WorkoutDraft {
  const draft = emptyDraft(record.sport, record.date)
  draft.duration = record.duration === null ? '' : String(record.duration)
  draft.feel = record.feel === null ? '' : String(record.feel)
  draft.rpe = record.rpe === null ? '' : String(record.rpe)
  draft.note = record.note ?? ''

  if (record.run) {
    draft.run = {
      distance: record.run.distance ? String(record.run.distance) : '',
      kind: record.run.kind || '轻松跑',
      heartRate: record.run.heartRate === undefined ? '' : String(record.run.heartRate),
      route: record.run.route ?? '',
      shoes: record.run.shoes ?? '',
    }
  }

  if (record.football) {
    draft.football = {
      content: record.football.content || '对抗',
      intensity: record.football.intensity || '中等',
      position: record.football.position || '中场',
      opponent: record.football.opponent ?? '',
      score: record.football.score ?? '',
      goals: record.football.goals === undefined ? '' : String(record.football.goals),
      assists: record.football.assists === undefined ? '' : String(record.football.assists),
    }
  }

  if (record.basketball) {
    const b = record.basketball
    const show = (v: number | undefined) => (v === undefined ? '' : String(v))
    draft.basketball = {
      content: b.content || '对抗',
      intensity: b.intensity || '中等',
      position: b.position || '得分后卫',
      opponent: b.opponent ?? '',
      score: b.score ?? '',
      points: show(b.points),
      rebounds: show(b.rebounds),
      assists: show(b.assists),
      steals: show(b.steals),
      blocks: show(b.blocks),
      threeMade: show(b.threeMade),
      freeThrowsMade: show(b.freeThrowsMade),
    }
  }

  if (record.gym) {
    const order: string[] = []
    const grouped = new Map<string, { reps: string; weight: string }[]>()
    for (const set of record.gym.sets) {
      if (!grouped.has(set.exercise)) {
        order.push(set.exercise)
        grouped.set(set.exercise, [])
      }
      grouped.get(set.exercise)?.push({ reps: String(set.reps), weight: String(set.weight) })
    }

    draft.gym = {
      part: record.gym.part || '胸',
      exercises:
        order.length > 0
          ? order.map((name) => ({ name, sets: grouped.get(name) ?? [{ reps: '', weight: '' }] }))
          : [{ name: '', sets: [{ reps: '', weight: '' }] }],
    }
  }

  return draft
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  )
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '0'}
        className={inputCls}
      />
    </Field>
  )
}

export default function LogWorkout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const editId = params.get('id') ?? undefined
  const sportParam = params.get('sport')
  const initialSport: SportType = SPORT_ORDER.includes(sportParam as SportType)
    ? (sportParam as SportType)
    : 'run'
  const initialDate = params.get('date') ?? todayISO()

  const [draft, setDraft] = useState<WorkoutDraft>(() => emptyDraft(initialSport, initialDate))
  const [loading, setLoading] = useState(Boolean(editId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editId) return

    let alive = true
    setLoading(true)
    fetchRecord(editId)
      .then((record) => {
        if (!alive) return
        if (!record) {
          setError('找不到这条记录，可能已经被删掉了')
          return
        }
        setDraft(recordToDraft(record))
      })
      .catch((e: unknown) => {
        if (alive) setError(explainWorkoutError(e))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [editId])

  const isGym = draft.sport === 'gym'

  // 配速实时算出来给用户看（保存时数据层也会算一遍，保证一致）
  const distanceNum = Number(draft.run.distance)
  const durationNum = Number(draft.duration)
  const pacePreview =
    draft.sport === 'run' && distanceNum > 0 && durationNum > 0 ? computePace(distanceNum, durationNum) : ''

  function patchBasketball(key: keyof WorkoutDraft['basketball'], value: string) {
    setDraft((d) => ({ ...d, basketball: { ...d.basketball, [key]: value } }))
  }

  function patchFootball(key: keyof WorkoutDraft['football'], value: string) {
    setDraft((d) => ({ ...d, football: { ...d.football, [key]: value } }))
  }

  async function handleSave() {
    if (!user) return
    if (!draft.date) {
      setError('还没选日期')
      return
    }
    if (draft.sport === 'run' && !draft.run.distance.trim()) {
      setError('跑步要填距离')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await saveRecord(user.id, draft, editId)
      navigate('/records', { replace: true })
    } catch (e) {
      setError(explainWorkoutError(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editId) return
    if (!window.confirm('删掉这条记录？删了就找不回来了')) return

    setSaving(true)
    setError(null)
    try {
      await deleteRecord(editId)
      navigate('/records', { replace: true })
    } catch (e) {
      setError(explainWorkoutError(e))
    } finally {
      setSaving(false)
    }
  }

  /* ---------- 健身：动作与组的增删改 ---------- */

  function addExercise() {
    setDraft((d) => ({
      ...d,
      gym: { ...d.gym, exercises: [...d.gym.exercises, { name: '', sets: [{ reps: '', weight: '' }] }] },
    }))
  }

  function removeExercise(index: number) {
    setDraft((d) => ({
      ...d,
      gym: { ...d.gym, exercises: d.gym.exercises.filter((_, i) => i !== index) },
    }))
  }

  function setExerciseName(index: number, name: string) {
    setDraft((d) => ({
      ...d,
      gym: { ...d.gym, exercises: d.gym.exercises.map((ex, i) => (i === index ? { ...ex, name } : ex)) },
    }))
  }

  function addSet(index: number) {
    setDraft((d) => ({
      ...d,
      gym: {
        ...d.gym,
        exercises: d.gym.exercises.map((ex, i) =>
          i === index ? { ...ex, sets: [...ex.sets, { reps: '', weight: '' }] } : ex,
        ),
      },
    }))
  }

  function removeSet(index: number, setIndex: number) {
    setDraft((d) => ({
      ...d,
      gym: {
        ...d.gym,
        exercises: d.gym.exercises.map((ex, i) => {
          if (i !== index) return ex
          const sets = ex.sets.filter((_, si) => si !== setIndex)
          return { ...ex, sets: sets.length > 0 ? sets : [{ reps: '', weight: '' }] }
        }),
      },
    }))
  }

  function setSetValue(index: number, setIndex: number, key: 'reps' | 'weight', value: string) {
    setDraft((d) => ({
      ...d,
      gym: {
        ...d.gym,
        exercises: d.gym.exercises.map((ex, i) =>
          i === index ? { ...ex, sets: ex.sets.map((s, si) => (si === setIndex ? { ...s, [key]: value } : s)) } : ex,
        ),
      },
    }))
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
        还没配置数据库，记录功能暂时用不了。
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" />
        读取记录中…
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      {/* 顶栏 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100"
        >
          <ArrowLeft size={16} />
          返回
        </button>
        <h1 className="text-base font-semibold tracking-tight text-slate-900">
          {editId ? '修改记录' : '记一笔训练'}
        </h1>
        {editId ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            <Trash2 size={15} />
            删除
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 ring-1 ring-red-200">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      ) : null}

      {/* 运动类型 + 日期 */}
      <Section title="练的什么">
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {SPORT_ORDER.map((sport) => (
            <button
              key={sport}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, sport }))}
              className={`rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                draft.sport === sport
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
              }`}
            >
              {SPORT_LABEL[sport]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="日期">
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="时长（分钟）">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={draft.duration}
              onChange={(e) => setDraft((d) => ({ ...d, duration: e.target.value }))}
              placeholder={draft.sport === 'gym' ? '60' : draft.sport === 'run' ? '28' : '90'}
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* 跑步 */}
      {draft.sport === 'run' ? (
        <Section title="跑步数据">
          <div className="grid grid-cols-2 gap-3">
            <Field label="距离（公里）">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={draft.run.distance}
                onChange={(e) => setDraft((d) => ({ ...d, run: { ...d.run, distance: e.target.value } }))}
                placeholder="5.02"
                className={inputCls}
              />
            </Field>
            <Field label="配速" hint="自动算出来的，不用填">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {pacePreview || <span className="text-slate-400">填了距离和时长就有了</span>}
              </div>
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="跑步类型">
              <select
                value={draft.run.kind}
                onChange={(e) => setDraft((d) => ({ ...d, run: { ...d.run, kind: e.target.value } }))}
                className={inputCls}
              >
                {RUN_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="平均心率" hint="没有设备就留空">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={draft.run.heartRate}
                onChange={(e) => setDraft((d) => ({ ...d, run: { ...d.run, heartRate: e.target.value } }))}
                placeholder="152"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="路线 / 地点">
              <input
                type="text"
                value={draft.run.route}
                onChange={(e) => setDraft((d) => ({ ...d, run: { ...d.run, route: e.target.value } }))}
                placeholder="操场"
                className={inputCls}
              />
            </Field>
            <Field label="跑鞋">
              <input
                type="text"
                value={draft.run.shoes}
                onChange={(e) => setDraft((d) => ({ ...d, run: { ...d.run, shoes: e.target.value } }))}
                placeholder="飞马 40"
                className={inputCls}
              />
            </Field>
          </div>
        </Section>
      ) : null}

      {/* 足球 */}
      {draft.sport === 'football' ? (
        <>
          <Section title="训练内容">
            <Field label="练的是什么">
              <select
                value={draft.football.content}
                onChange={(e) => patchFootball('content', e.target.value)}
                className={inputCls}
              >
                {FOOTBALL_CONTENTS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="强度">
                <select
                  value={draft.football.intensity}
                  onChange={(e) => patchFootball('intensity', e.target.value)}
                  className={inputCls}
                >
                  {FOOTBALL_INTENSITY.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="场上位置">
                <select
                  value={draft.football.position}
                  onChange={(e) => patchFootball('position', e.target.value)}
                  className={inputCls}
                >
                  {FOOTBALL_POSITIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section title="比赛信息（不比赛就留空）">
            <div className="grid grid-cols-2 gap-3">
              <Field label="对手">
                <input
                  type="text"
                  value={draft.football.opponent}
                  onChange={(e) => patchFootball('opponent', e.target.value)}
                  placeholder="老张队"
                  className={inputCls}
                />
              </Field>
              <Field label="比分">
                <input
                  type="text"
                  value={draft.football.score}
                  onChange={(e) => patchFootball('score', e.target.value)}
                  placeholder="3 : 2 胜"
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <NumberField label="进球" value={draft.football.goals} onChange={(v) => patchFootball('goals', v)} />
              <NumberField
                label="助攻"
                value={draft.football.assists}
                onChange={(v) => patchFootball('assists', v)}
              />
            </div>
          </Section>
        </>
      ) : null}

      {/* 篮球 */}
      {draft.sport === 'basketball' ? (
        <>
          <Section title="训练内容">
            <Field label="练的是什么">
              <select
                value={draft.basketball.content}
                onChange={(e) => patchBasketball('content', e.target.value)}
                className={inputCls}
              >
                {BASKETBALL_CONTENTS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="强度">
                <select
                  value={draft.basketball.intensity}
                  onChange={(e) => patchBasketball('intensity', e.target.value)}
                  className={inputCls}
                >
                  {FOOTBALL_INTENSITY.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="场上位置">
                <select
                  value={draft.basketball.position}
                  onChange={(e) => patchBasketball('position', e.target.value)}
                  className={inputCls}
                >
                  {BASKETBALL_POSITIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section title="比赛信息（不比赛就留空）">
            <div className="grid grid-cols-2 gap-3">
              <Field label="对手">
                <input
                  type="text"
                  value={draft.basketball.opponent}
                  onChange={(e) => patchBasketball('opponent', e.target.value)}
                  placeholder="隔壁队"
                  className={inputCls}
                />
              </Field>
              <Field label="比分">
                <input
                  type="text"
                  value={draft.basketball.score}
                  onChange={(e) => patchBasketball('score', e.target.value)}
                  placeholder="78 : 71 胜"
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          <Section title="个人数据（没打比赛就留空）">
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="得分" value={draft.basketball.points} onChange={(v) => patchBasketball('points', v)} />
              <NumberField
                label="篮板"
                value={draft.basketball.rebounds}
                onChange={(v) => patchBasketball('rebounds', v)}
              />
              <NumberField
                label="助攻"
                value={draft.basketball.assists}
                onChange={(v) => patchBasketball('assists', v)}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <NumberField label="抢断" value={draft.basketball.steals} onChange={(v) => patchBasketball('steals', v)} />
              <NumberField label="盖帽" value={draft.basketball.blocks} onChange={(v) => patchBasketball('blocks', v)} />
              <NumberField
                label="三分命中"
                value={draft.basketball.threeMade}
                onChange={(v) => patchBasketball('threeMade', v)}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <NumberField
                label="罚球命中"
                value={draft.basketball.freeThrowsMade}
                onChange={(v) => patchBasketball('freeThrowsMade', v)}
              />
            </div>
          </Section>
        </>
      ) : null}

      {/* 健身 */}
      {draft.sport === 'gym' ? (
        <Section title="练了哪些动作">
          <Field label="训练部位">
            <select
              value={draft.gym.part}
              onChange={(e) => setDraft((d) => ({ ...d, gym: { ...d.gym, part: e.target.value } }))}
              className={inputCls}
            >
              {GYM_PARTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <div className="mt-4 space-y-3">
            {draft.gym.exercises.map((exercise, index) => (
              <div key={index} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={exercise.name}
                    onChange={(e) => setExerciseName(index, e.target.value)}
                    placeholder="动作名，比如「卧推」"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  {draft.gym.exercises.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeExercise(index)}
                      className="shrink-0 rounded-lg p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                      aria-label="删掉这个动作"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400">
                    <span className="w-10">组</span>
                    <span className="flex-1">次数</span>
                    <span className="flex-1">重量（kg）</span>
                    <span className="w-7" />
                  </div>

                  {exercise.sets.map((set, setIndex) => (
                    <div key={setIndex} className="flex items-center gap-2">
                      <span className="w-10 text-center text-xs font-medium text-slate-500">{setIndex + 1}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={set.reps}
                        onChange={(e) => setSetValue(index, setIndex, 'reps', e.target.value)}
                        placeholder="8"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        value={set.weight}
                        onChange={(e) => setSetValue(index, setIndex, 'weight', e.target.value)}
                        placeholder="60"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                      <button
                        type="button"
                        onClick={() => removeSet(index, setIndex)}
                        className="w-7 shrink-0 rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                        aria-label="删掉这一组"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => addSet(index)}
                  className="mt-2 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                >
                  <Plus size={13} />
                  再加一组
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addExercise}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-600"
          >
            <Plus size={15} />
            加一个动作
          </button>
        </Section>
      ) : null}

      {/* 感受 / 强度 */}
      <Section title={isGym ? '今天累不累（RPE）' : '今天感觉怎么样'}>
        {isGym ? (
          <Field label="RPE 主观强度，1 最轻松、10 已经到极限" hint="比如 8 分 = 还能再做 2 次就到位了">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="10"
              value={draft.rpe}
              onChange={(e) => setDraft((d) => ({ ...d, rpe: e.target.value }))}
              placeholder="8"
              className={inputCls}
            />
          </Field>
        ) : (
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">主观感受（1 很轻松 - 5 快累死了）</span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, feel: d.feel === String(value) ? '' : String(value) }))}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    draft.feel === String(value)
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* 备注 */}
      <Section title="备注">
        <textarea
          value={draft.note}
          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          rows={3}
          placeholder={
            draft.sport === 'gym'
              ? '哪个动作状态好、哪里不舒服、下次加重还是减重…'
              : draft.sport === 'run'
                ? '天气、跟谁跑的、今天状态…'
                : '哪个环节最差、教练说了什么、手感如何…'
          }
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </Section>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        {saving ? '保存中…' : editId ? '保存修改' : '保存这一笔'}
      </button>
    </div>
  )
}
