import type { SportType } from './types'

export const SPORT_LABEL: Record<SportType, string> = {
  run: '跑步',
  football: '足球',
  basketball: '篮球',
  gym: '健身',
}

/** 每种运动的标签配色，用来在一堆记录里一眼分辨 */
export const SPORT_BADGE: Record<SportType, string> = {
  run: 'bg-blue-50 text-blue-700 ring-blue-200',
  football: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  basketball: 'bg-orange-50 text-orange-700 ring-orange-200',
  gym: 'bg-violet-50 text-violet-700 ring-violet-200',
}

export const SPORT_DOT: Record<SportType, string> = {
  run: 'bg-blue-500',
  football: 'bg-emerald-500',
  basketball: 'bg-orange-500',
  gym: 'bg-violet-500',
}

export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 把一组健身动作按动作名归类，方便显示 */
export function groupGymSets(sets: { exercise: string; setNo: number; reps: number; weight: number }[]) {
  const map = new Map<string, { setNo: number; reps: number; weight: number }[]>()
  for (const s of sets) {
    const list = map.get(s.exercise) ?? []
    list.push({ setNo: s.setNo, reps: s.reps, weight: s.weight })
    map.set(s.exercise, list)
  }
  return [...map.entries()].map(([exercise, group]) => ({ exercise, group }))
}
