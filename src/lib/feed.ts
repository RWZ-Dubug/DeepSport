import { supabase } from './supabase'
import type { FeedComment, FeedItem } from './types'
import { WORKOUT_COLUMNS, rowToRecord } from './workout'
import type { WorkoutRow } from './workout'

/**
 * 动态流的数据操作。
 *
 * 核心设计：**动态不是一张单独的表**。
 * 它就是「所有人最近的训练记录」，再挂上点赞和评论。
 * 好处：你记完一笔，朋友那边立刻就出现了，不需要「发帖」这个动作。
 *
 * 查一次就能把记录 + 点赞 + 评论全带出来（靠数据库的外键关系），
 * 昵称则需要额外查一次 profiles 表，因为 workouts 没有直接指向 profiles 的外键。
 */

type FeedRow = WorkoutRow & {
  created_at: string
  likes: { user_id: string }[] | null
  comments: { id: string; user_id: string; text: string; created_at: string }[] | null
}

const FEED_SELECT = `${WORKOUT_COLUMNS},created_at,likes(user_id),comments(id,user_id,text,created_at)`

function client() {
  if (!supabase) throw new Error('还没配置数据库（.env.local 里缺密钥）')
  return supabase
}

/** 一次把这些人的昵称都查出来，避免一条一条查 */
async function fetchNicknames(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (userIds.length === 0) return map

  const { data, error } = await client().from('profiles').select('id,nickname').in('id', userIds)
  if (error) throw error

  const rows = (data ?? []) as unknown as { id: string; nickname: string }[]
  for (const row of rows) map.set(row.id, row.nickname)
  return map
}

/** 所有人的训练动态，从新到旧 */
export async function fetchFeed(currentUserId: string, limit = 50): Promise<FeedItem[]> {
  const { data, error } = await client()
    .from('workouts')
    .select(FEED_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = (data ?? []) as unknown as FeedRow[]
  const nicknames = await fetchNicknames([...new Set(rows.map((r) => r.user_id))])

  return rows.map((row) => {
    const likes = row.likes ?? []
    const comments = (row.comments ?? [])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map<FeedComment>((c) => ({
        id: c.id,
        userId: c.user_id,
        nickname: nicknames.get(c.user_id) ?? '队友',
        text: c.text,
        createdAt: c.created_at,
      }))

    return {
      // 动态列表里不查健身的每一组（那是另一个查询），
      // 所以这里传空数组，界面上用时长/部位来展示就够了
      record: rowToRecord(row, []),
      nickname: nicknames.get(row.user_id) ?? '队友',
      createdAt: row.created_at,
      likeCount: likes.length,
      likedByMe: likes.some((l) => l.user_id === currentUserId),
      comments,
    }
  })
}

/** 点赞 / 取消点赞 */
export async function setLike(workoutId: string, userId: string, liked: boolean): Promise<void> {
  if (liked) {
    // 用 upsert + 忽略重复：这样连点两次也不会报「已存在」的错
    const { error } = await client()
      .from('likes')
      .upsert({ workout_id: workoutId, user_id: userId }, { ignoreDuplicates: true })
    if (error) throw error
    return
  }

  const { error } = await client().from('likes').delete().eq('workout_id', workoutId).eq('user_id', userId)
  if (error) throw error
}

/** 发一条评论，返回它的 id 和时间（好让界面直接插进去，不用整页重刷） */
export async function addComment(
  workoutId: string,
  userId: string,
  text: string,
): Promise<{ id: string; createdAt: string }> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('评论不能是空的')

  const { data, error } = await client()
    .from('comments')
    .insert({ workout_id: workoutId, user_id: userId, text: trimmed })
    .select('id,created_at')
    .single()

  if (error) throw error
  const row = data as unknown as { id: string; created_at: string }
  return { id: row.id, createdAt: row.created_at }
}

/** 删掉自己的评论 */
export async function deleteComment(id: string): Promise<void> {
  const { error } = await client().from('comments').delete().eq('id', id)
  if (error) throw error
}

/** 把数据库的英文报错翻成人话 */
export function explainFeedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (/duplicate key/i.test(message)) return '你已经点过赞了'
  if (/permission denied|row-level security|policy/i.test(message))
    return '没有权限。只有自己发的评论才能删，点赞也只能点自己的'
  if (/failed to fetch|network|fetch failed/i.test(message)) return '连不上数据库，检查一下网络'

  return message
}
