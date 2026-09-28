import { supabase } from './supabase'
import type { GymSet, SportType, WorkoutDraft, WorkoutRecord } from './types'

/**
 * 训练记录的数据库操作。
 *
 * 数据库那张 workouts 表是「宽表」：四种运动的专属字段都放在同一张表里，
 * 用不到的就留空。好处是查列表只要一次查询；
 * 代价是这里要做一层「宽表 ↔ 界面形状」的转换。
 * 健身的「每一组」放在另一张 gym_sets 表里，靠 workout_id 关联。
 *
 * 另外注意：足球和篮球共用几个列 ——
 *   content（训练内容）、intensity（强度）、position（位置）、
 *   opponent（对手）、score（比分）、assists（助攻）
 * 靠 sport 这一列来区分到底是哪种，所以不会混。
 */

export const WORKOUT_COLUMNS = [
  'id',
  'user_id',
  'date',
  'sport',
  'duration',
  'feel',
  'rpe',
  'note',
  // 跑步
  'distance',
  'pace',
  'run_kind',
  'heart_rate',
  'route',
  'shoes',
  // 足球 / 篮球共用
  'content',
  'intensity',
  'position',
  'opponent',
  'score',
  'assists',
  // 足球专属
  'goals',
  // 健身
  'part',
  // 篮球专属
  'points',
  'rebounds',
  'steals',
  'blocks',
  'three_made',
  'free_throws_made',
].join(',')

export type WorkoutRow = {
  id: string
  user_id: string
  date: string
  sport: SportType
  duration: number | null
  feel: number | null
  rpe: number | null
  note: string | null
  distance: number | null
  pace: string | null
  run_kind: string | null
  heart_rate: number | null
  route: string | null
  shoes: string | null
  content: string | null
  intensity: string | null
  position: string | null
  opponent: string | null
  score: string | null
  assists: number | null
  goals: number | null
  part: string | null
  points: number | null
  rebounds: number | null
  steals: number | null
  blocks: number | null
  three_made: number | null
  free_throws_made: number | null
}

type GymSetRow = {
  workout_id: string
  exercise: string
  set_no: number
  reps: number
  weight: number
}

function client() {
  if (!supabase) throw new Error('还没配置数据库（.env.local 里缺密钥）')
  return supabase
}

/** "5.02" → 5.02；"" → null；"abc" → null */
function num(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/** " abc " → "abc"；空字符串 → null（数据库里统一用 null 表示「没填」） */
function text(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** 由距离和时长算配速，例如 5 公里 / 28 分钟 → 5'36" */
export function computePace(distanceKm: number, durationMin: number): string {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(durationMin) || distanceKm <= 0 || durationMin <= 0) return ''
  const secondsPerKm = (durationMin * 60) / distanceKm
  let minutes = Math.floor(secondsPerKm / 60)
  let seconds = Math.round(secondsPerKm % 60)
  if (seconds === 60) {
    minutes += 1
    seconds = 0
  }
  return `${minutes}'${String(seconds).padStart(2, '0')}"`
}

export function rowToRecord(row: WorkoutRow, sets: GymSet[]): WorkoutRecord {
  const record: WorkoutRecord = {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    sport: row.sport,
    duration: row.duration,
    feel: row.feel,
    rpe: row.rpe,
    note: row.note ?? undefined,
  }

  if (row.sport === 'run') {
    record.run = {
      distance: row.distance ?? 0,
      pace: row.pace ?? '',
      kind: row.run_kind ?? '',
      heartRate: row.heart_rate ?? undefined,
      route: row.route ?? undefined,
      shoes: row.shoes ?? undefined,
    }
  }

  if (row.sport === 'football') {
    record.football = {
      content: row.content ?? '',
      intensity: row.intensity ?? '',
      position: row.position ?? '',
      opponent: row.opponent ?? undefined,
      score: row.score ?? undefined,
      goals: row.goals ?? undefined,
      assists: row.assists ?? undefined,
    }
  }

  if (row.sport === 'basketball') {
    record.basketball = {
      content: row.content ?? '',
      intensity: row.intensity ?? '',
      position: row.position ?? '',
      opponent: row.opponent ?? undefined,
      score: row.score ?? undefined,
      points: row.points ?? undefined,
      rebounds: row.rebounds ?? undefined,
      assists: row.assists ?? undefined,
      steals: row.steals ?? undefined,
      blocks: row.blocks ?? undefined,
      threeMade: row.three_made ?? undefined,
      freeThrowsMade: row.free_throws_made ?? undefined,
    }
  }

  if (row.sport === 'gym') {
    record.gym = { part: row.part ?? '', sets }
  }

  return record
}

function groupSets(rows: GymSetRow[]): Map<string, GymSet[]> {
  const map = new Map<string, GymSet[]>()
  for (const row of rows) {
    const list = map.get(row.workout_id) ?? []
    list.push({ exercise: row.exercise, setNo: row.set_no, reps: row.reps, weight: row.weight })
    map.set(row.workout_id, list)
  }
  return map
}

const GYM_SET_COLUMNS = 'workout_id,exercise,set_no,reps,weight'

/**
 * 我的全部记录，按日期从新到旧。
 *
 * 说明：下面几处 `as unknown as ...` 是故意的。
 * 项目没有用 Supabase 官方的「数据库类型生成」工具，而列名是运行时拼出来的，
 * TypeScript 推导不出结果形状，会退化成一个报错类型。用 unknown 中转是标准做法。
 */
export async function fetchRecords(userId: string, limit = 100): Promise<WorkoutRecord[]> {
  const { data, error } = await client()
    .from('workouts')
    .select(WORKOUT_COLUMNS)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = (data ?? []) as unknown as WorkoutRow[]
  const ids = rows.map((r) => r.id)
  let setsByWorkout = new Map<string, GymSet[]>()

  if (ids.length > 0) {
    const { data: setData, error: setError } = await client()
      .from('gym_sets')
      .select(GYM_SET_COLUMNS)
      .in('workout_id', ids)
      .order('set_no', { ascending: true })
      .order('exercise', { ascending: true })

    if (setError) throw setError
    setsByWorkout = groupSets((setData ?? []) as unknown as GymSetRow[])
  }

  return rows.map((row) => rowToRecord(row, setsByWorkout.get(row.id) ?? []))
}

/** 读一条记录（编辑时用） */
export async function fetchRecord(id: string): Promise<WorkoutRecord | null> {
  const { data, error } = await client().from('workouts').select(WORKOUT_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null

  const row = data as unknown as WorkoutRow
  let sets: GymSet[] = []

  if (row.sport === 'gym') {
    const { data: setData, error: setError } = await client()
      .from('gym_sets')
      .select(GYM_SET_COLUMNS)
      .eq('workout_id', row.id)
      .order('set_no', { ascending: true })
      .order('exercise', { ascending: true })

    if (setError) throw setError
    sets = ((setData ?? []) as unknown as GymSetRow[]).map((s) => ({
      exercise: s.exercise,
      setNo: s.set_no,
      reps: s.reps,
      weight: s.weight,
    }))
  }

  return rowToRecord(row, sets)
}

/** 把表单内容组装成数据库那一行的样子 */
function draftToRow(userId: string, draft: WorkoutDraft) {
  const run = draft.sport === 'run' ? draft.run : null
  const football = draft.sport === 'football' ? draft.football : null
  const basketball = draft.sport === 'basketball' ? draft.basketball : null
  const gym = draft.sport === 'gym' ? draft.gym : null

  const duration = num(draft.duration)
  const distance = run ? num(run.distance) : null

  // 配速自动算，不让用户手填（手填容易填错、格式还不统一）
  const pace = run && distance && duration ? computePace(distance, duration) : null

  // 足球和篮球共用的几列：哪个有值就用哪个
  const shared = football ?? basketball

  return {
    user_id: userId,
    date: draft.date,
    sport: draft.sport,
    duration,
    feel: gym ? null : num(draft.feel),
    rpe: gym ? num(draft.rpe) : null,
    note: text(draft.note),

    // 跑步
    distance: run ? distance : null,
    pace,
    run_kind: run ? text(run.kind) : null,
    heart_rate: run ? num(run.heartRate) : null,
    route: run ? text(run.route) : null,
    shoes: run ? text(run.shoes) : null,

    // 足球 / 篮球共用
    content: text(shared?.content ?? ''),
    intensity: text(shared?.intensity ?? ''),
    position: text(shared?.position ?? ''),
    opponent: text(shared?.opponent ?? ''),
    score: text(shared?.score ?? ''),

    // 足球专属
    goals: football ? num(football.goals) : null,

    // 助攻：两个项目共用这一列
    assists: football ? num(football.assists) : basketball ? num(basketball.assists) : null,

    // 健身
    part: gym ? text(gym.part) : null,

    // 篮球专属
    points: basketball ? num(basketball.points) : null,
    rebounds: basketball ? num(basketball.rebounds) : null,
    steals: basketball ? num(basketball.steals) : null,
    blocks: basketball ? num(basketball.blocks) : null,
    three_made: basketball ? num(basketball.threeMade) : null,
    free_throws_made: basketball ? num(basketball.freeThrowsMade) : null,
  }
}

/** 把表单里的「动作 + 若干组」拍平成一行一组 */
function flattenSets(workoutId: string, draft: WorkoutDraft) {
  const rows: { workout_id: string; exercise: string; set_no: number; reps: number; weight: number }[] = []

  for (const exercise of draft.gym.exercises) {
    const name = exercise.name.trim()
    if (!name) continue

    let setNo = 0
    for (const set of exercise.sets) {
      const reps = num(set.reps)
      const weight = num(set.weight)
      if (reps === null || weight === null) continue
      setNo += 1
      rows.push({ workout_id: workoutId, exercise: name, set_no: setNo, reps, weight })
    }
  }

  return rows
}

/**
 * 新增或修改一条记录，返回记录 id。
 * 传了 existingId 就是修改，否则是新增。
 */
export async function saveRecord(userId: string, draft: WorkoutDraft, existingId?: string): Promise<string> {
  const row = draftToRow(userId, draft)
  let workoutId = existingId

  if (existingId) {
    const { error } = await client().from('workouts').update(row).eq('id', existingId)
    if (error) throw error
  } else {
    const { data, error } = await client().from('workouts').insert(row).select('id').single()
    if (error) throw error
    workoutId = (data as unknown as { id: string }).id
  }

  if (!workoutId) throw new Error('保存失败：没拿到记录 id')

  // 健身的组：先全删再全插。
  // 比「算出哪些改了哪些新增了」简单得多，而且这个数据量极小，不会有效能问题。
  await client().from('gym_sets').delete().eq('workout_id', workoutId)

  if (draft.sport === 'gym') {
    const setRows = flattenSets(workoutId, draft)
    if (setRows.length > 0) {
      const { error } = await client().from('gym_sets').insert(setRows)
      if (error) throw error
    }
  }

  return workoutId
}

/** 删掉一条记录（它的健身组会被数据库自动一起删掉） */
export async function deleteRecord(id: string): Promise<void> {
  const { error } = await client().from('workouts').delete().eq('id', id)
  if (error) throw error
}

/** 把数据库的英文报错翻成人话 */
export function explainWorkoutError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (/invalid input syntax|out of range|numeric field overflow/i.test(message))
    return '有数字填得不对。检查一下距离、次数、重量，不要填汉字或小数点多于两位'
  if (/violates check constraint/i.test(message)) {
    if (/sport/i.test(message))
      return '数据库还不认识「篮球」这个运动。去 Supabase 的 SQL Editor 跑一下 supabase/migrations/002-basketball.sql'
    return '有字段超出了允许范围（比如感受要 1-5 分、强度要 1-10 分）'
  }
  if (/column .* does not exist/i.test(message) && /points|rebounds|steals|blocks|three_made|free_throws/i.test(message))
    return '数据库还缺篮球的数据列。去 Supabase 的 SQL Editor 跑一下 supabase/migrations/002-basketball.sql'
  if (/permission denied|row-level security|policy/i.test(message))
    return '没有权限写这条数据。确认你是登录状态'
  if (/invalid date|date\/time field value out of range/i.test(message)) return '日期格式不对'
  if (/failed to fetch|network|fetch failed/i.test(message)) return '连不上数据库，检查一下网络'

  return message
}
