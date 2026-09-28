/**
 * 日期小工具。
 *
 * 一个重要的细节：全程用「本地时区」算日期，不要用 toISOString()。
 * toISOString() 会转成 UTC，晚上 8 点之后在中国会算成第二天，
 * 「今天的安排」就会显示错。这种 bug 很难发现，所以统一走这几个函数。
 */

/** Date → "2026-09-28"（本地时区） */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "2026-09-28" → Date（本地零点） */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 今天是几号，"2026-09-28" */
export function todayISO(): string {
  return toISODate(new Date())
}

/** 包含 date 的那一周的周一 */
export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay() // 0 = 周日
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toISODate(d)
}

/** 本周一的日期 */
export function thisMonday(): string {
  return mondayOf(new Date())
}

/** 在某个日期上加减天数 */
export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** 这天是星期几：1 = 周一 ... 7 = 周日 */
export function weekdayOf(iso: string): number {
  const day = fromISODate(iso).getDay()
  return day === 0 ? 7 : day
}

/** "10月20日 - 10月26日" */
export function formatWeekRange(weekStart: string): string {
  const start = fromISODate(weekStart)
  const end = fromISODate(addDays(weekStart, 6))
  const f = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`
  return `${f(start)} - ${f(end)}`
}

/** "10月22日 星期三" */
export function formatDateWithWeekday(iso: string): string {
  const d = fromISODate(iso)
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getMonth() + 1}月${d.getDate()}日 ${names[d.getDay()]}`
}

/** 这一周相对于「本周」是什么：本周 / 上周 / 下周 / 空字符串 */
export function relativeWeekLabel(weekStart: string): string {
  const current = thisMonday()
  if (weekStart === current) return '本周'
  if (weekStart === addDays(current, -7)) return '上周'
  if (weekStart === addDays(current, 7)) return '下周'
  return ''
}

/**
 * 把时间戳变成「今天 07:20」「昨天 20:05」「10月19日 18:40」这种好读的样子。
 * 注意：数据库给的是 UTC 时间戳（带 +00:00），new Date() 会自动转成本地时间。
 */
export function formatRelativeTime(timestamp: string): string {
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return ''

  const clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const day = toISODate(d)
  const today = todayISO()

  if (day === today) return `今天 ${clock}`
  if (day === addDays(today, -1)) return `昨天 ${clock}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${clock}`
}
