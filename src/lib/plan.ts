import { supabase } from './supabase'
import type { PlanItem, SportType } from './types'

/**
 * 周计划的数据库操作。
 *
 * 数据库里列名是下划线风格（week_start），
 * 前端代码用驼峰（weekStart），所以这里做一层转换。
 * 这样以后改数据库列名，只要改这一处。
 */

type PlanRow = {
  id: string
  user_id: string
  week_start: string
  weekday: number
  sport: SportType
  target: string
  memo: string | null
}

const COLUMNS = 'id,user_id,week_start,weekday,sport,target,memo'

function client() {
  if (!supabase) throw new Error('还没配置数据库（.env.local 里缺密钥）')
  return supabase
}

function toItem(row: PlanRow): PlanItem {
  return {
    id: row.id,
    userId: row.user_id,
    weekStart: row.week_start,
    weekday: row.weekday,
    sport: row.sport,
    target: row.target,
    memo: row.memo ?? undefined,
  }
}

/** 读取某人某一周的全部安排 */
export async function fetchWeek(userId: string, weekStart: string): Promise<PlanItem[]> {
  const { data, error } = await client()
    .from('plan_items')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .order('weekday', { ascending: true })

  if (error) throw error
  return ((data ?? []) as PlanRow[]).map(toItem)
}

/** 新增一条安排 */
export async function createPlanItem(input: {
  userId: string
  weekStart: string
  weekday: number
  sport: SportType
  target: string
  memo?: string
}): Promise<PlanItem> {
  const { data, error } = await client()
    .from('plan_items')
    .insert({
      user_id: input.userId,
      week_start: input.weekStart,
      weekday: input.weekday,
      sport: input.sport,
      target: input.target.trim(),
      memo: input.memo?.trim() || null,
    })
    .select(COLUMNS)
    .single()

  if (error) throw error
  return toItem(data as PlanRow)
}

/** 修改一条安排 */
export async function updatePlanItem(
  id: string,
  patch: { sport?: SportType; target?: string; memo?: string },
): Promise<void> {
  const body: Record<string, unknown> = {}
  if (patch.sport !== undefined) body.sport = patch.sport
  if (patch.target !== undefined) body.target = patch.target.trim()
  if (patch.memo !== undefined) body.memo = patch.memo.trim() || null

  const { error } = await client().from('plan_items').update(body).eq('id', id)
  if (error) throw error
}

/** 删掉一条安排 */
export async function deletePlanItem(id: string): Promise<void> {
  const { error } = await client().from('plan_items').delete().eq('id', id)
  if (error) throw error
}

/** 清空某一周的全部安排，返回删了几条 */
export async function clearWeek(userId: string, weekStart: string): Promise<void> {
  const { error } = await client()
    .from('plan_items')
    .delete()
    .eq('user_id', userId)
    .eq('week_start', weekStart)

  if (error) throw error
}

/**
 * 把 fromWeek 整周复制到 toWeek。
 * replace = true 时先清空目标周（默认行为，语义最直白：就是「照抄上周」）。
 */
export async function copyWeek(
  userId: string,
  fromWeek: string,
  toWeek: string,
  replace = true,
): Promise<number> {
  if (fromWeek === toWeek) throw new Error('不能把一周复制到它自己')

  const source = await fetchWeek(userId, fromWeek)
  if (source.length === 0) return 0

  if (replace) {
    await clearWeek(userId, toWeek)
  }

  const rows = source.map((item) => ({
    user_id: userId,
    week_start: toWeek,
    weekday: item.weekday,
    sport: item.sport,
    target: item.target,
    memo: item.memo ?? null,
  }))

  const { error } = await client().from('plan_items').insert(rows)
  if (error) throw error
  return rows.length
}

/** 把数据库的英文报错翻成人话 */
export function explainPlanError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (/duplicate key|unique constraint/i.test(message))
    return '这一天已经排过安排了。同一天只能排一条，先删掉原来那条再试'
  if (/week_start/i.test(message) && /column|schema/i.test(message))
    return '数据库还缺 week_start 这个列。去 Supabase 的 SQL Editor 跑一下 supabase/migrations/001-week-start.sql'
  if (/permission denied|row-level security|policy/i.test(message))
    return '没有权限写这条数据。确认你是登录状态，而且这条记录的 user_id 是你自己'
  if (/failed to fetch|network|fetch failed/i.test(message))
    return '连不上数据库，检查一下网络'

  return message
}
