import { Heart, Loader2, MessageCircle, Send, Trash2, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/auth-context'
import { formatRelativeTime } from '../lib/date'
import { addComment, deleteComment, explainFeedError, fetchFeed, setLike } from '../lib/feed'
import { SPORT_BADGE, SPORT_LABEL } from '../lib/sport'
import { isSupabaseConfigured } from '../lib/supabase'
import type { FeedItem, WorkoutRecord } from '../lib/types'

/** 一句话概括这次练了什么（四种运动各写各的） */
function summary(record: WorkoutRecord): string {
  if (record.run) {
    const r = record.run
    const bits = [`跑了 ${r.distance} 公里`]
    if (r.pace) bits.push(`配速 ${r.pace}`)
    if (r.kind) bits.push(r.kind)
    return bits.join(' · ')
  }

  if (record.football) {
    const f = record.football
    const bits = [f.content]
    if (record.duration) bits.push(`${record.duration} 分钟`)
    if (f.position) bits.push(f.position)
    if (f.goals) bits.push(`进 ${f.goals} 球`)
    if (f.assists) bits.push(`${f.assists} 助攻`)
    return bits.filter(Boolean).join(' · ')
  }

  if (record.basketball) {
    const b = record.basketball
    const bits = [b.content]
    if (b.points) bits.push(`${b.points} 分`)
    if (b.rebounds) bits.push(`${b.rebounds} 篮板`)
    if (b.assists) bits.push(`${b.assists} 助攻`)
    if (b.steals) bits.push(`${b.steals} 抢断`)
    if (b.blocks) bits.push(`${b.blocks} 盖帽`)
    if (b.threeMade) bits.push(`三分 ${b.threeMade}`)
    if (!b.points && !b.rebounds && record.duration) bits.push(`${record.duration} 分钟`)
    return bits.filter(Boolean).join(' · ')
  }

  if (record.gym) {
    const bits = [`练了${record.gym.part}`]
    if (record.duration) bits.push(`${record.duration} 分钟`)
    if (record.rpe) bits.push(`RPE ${record.rpe}`)
    return bits.join(' · ')
  }

  return ''
}

/** 比赛类运动的比分那一行 */
function matchLine(record: WorkoutRecord): string {
  const info = record.football ?? record.basketball
  if (!info?.opponent) return ''
  return info.score ? `对手 ${info.opponent} · ${info.score}` : `对手 ${info.opponent}`
}

export default function Feed() {
  const { user, nickname } = useAuth()

  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [sendingId, setSendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchFeed(user.id))
    } catch (e) {
      setError(explainFeedError(e))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  /** 点赞：先改界面再发请求（点起来才不卡），失败就改回去 */
  async function handleLike(item: FeedItem) {
    if (!user) return
    const next = !item.likedByMe
    const id = item.record.id

    setItems((prev) =>
      prev.map((it) =>
        it.record.id === id ? { ...it, likedByMe: next, likeCount: it.likeCount + (next ? 1 : -1) } : it,
      ),
    )

    try {
      await setLike(id, user.id, next)
    } catch (e) {
      setError(explainFeedError(e))
      setItems((prev) =>
        prev.map((it) =>
          it.record.id === id ? { ...it, likedByMe: !next, likeCount: it.likeCount + (next ? -1 : 1) } : it,
        ),
      )
    }
  }

  async function handleComment(item: FeedItem) {
    if (!user) return
    const id = item.record.id
    const text = (drafts[id] ?? '').trim()
    if (!text) return

    setSendingId(id)
    setError(null)
    try {
      const created = await addComment(id, user.id, text)
      setItems((prev) =>
        prev.map((it) =>
          it.record.id === id
            ? {
                ...it,
                comments: [
                  ...it.comments,
                  { id: created.id, userId: user.id, nickname, text, createdAt: created.createdAt },
                ],
              }
            : it,
        ),
      )
      setDrafts((d) => ({ ...d, [id]: '' }))
    } catch (e) {
      setError(explainFeedError(e))
    } finally {
      setSendingId(null)
    }
  }

  async function handleDeleteComment(item: FeedItem, commentId: string) {
    if (!window.confirm('删掉这条评论？')) return
    setError(null)
    try {
      await deleteComment(commentId)
      setItems((prev) =>
        prev.map((it) =>
          it.record.id === item.record.id
            ? { ...it, comments: it.comments.filter((c) => c.id !== commentId) }
            : it,
        ),
      )
    } catch (e) {
      setError(explainFeedError(e))
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
        还没配置数据库，动态功能暂时用不了。
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">动态</h1>
        <p className="mt-0.5 text-xs text-slate-500">大家练完会自动出现在这里，不用自己发帖</p>
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
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <p className="text-sm text-slate-500">还没有人记录训练</p>
          <p className="mt-1 text-xs text-slate-400">谁先记一笔，这里就有了</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const id = item.record.id
            const line = matchLine(item.record)

            return (
              <article key={id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 px-4 pt-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {item.nickname.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{item.nickname}</div>
                    <div className="text-xs text-slate-400">{formatRelativeTime(item.createdAt)}</div>
                  </div>
                  <span
                    className={`ml-auto shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${
                      SPORT_BADGE[item.record.sport]
                    }`}
                  >
                    {SPORT_LABEL[item.record.sport]}
                  </span>
                </div>

                <div className="px-4 pt-3">
                  <p className="text-sm text-slate-700">{summary(item.record)}</p>
                  {line ? <p className="mt-1 text-xs text-slate-400">{line}</p> : null}
                  {item.record.note ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{item.record.note}</p>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-1 border-t border-slate-100 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => handleLike(item)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      item.likedByMe ? 'text-red-500 hover:bg-red-50' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Heart size={15} fill={item.likedByMe ? 'currentColor' : 'none'} />
                    <span className="tnum">{item.likeCount}</span>
                  </button>

                  <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500">
                    <MessageCircle size={15} />
                    <span className="tnum">{item.comments.length}</span>
                  </span>
                </div>

                {item.comments.length > 0 ? (
                  <div className="space-y-1.5 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
                    {item.comments.map((c) => (
                      <div key={c.id} className="group flex items-start gap-1.5 text-xs">
                        <span className="font-medium text-slate-700">{c.nickname}</span>
                        <span className="min-w-0 flex-1 break-words text-slate-500">{c.text}</span>
                        {c.userId === user?.id ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(item, c.id)}
                            className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                            aria-label="删掉这条评论"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2">
                  <input
                    type="text"
                    value={drafts[id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleComment(item)
                    }}
                    placeholder="说点什么…"
                    className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-300"
                  />
                  <button
                    type="button"
                    onClick={() => handleComment(item)}
                    disabled={sendingId === id || !(drafts[id] ?? '').trim()}
                    className="rounded-lg p-1.5 text-blue-500 transition-colors hover:bg-blue-50 disabled:opacity-40"
                    aria-label="发送"
                  >
                    {sendingId === id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
