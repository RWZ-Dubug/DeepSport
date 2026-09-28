/** 四种运动 */
export type SportType = 'run' | 'football' | 'basketball' | 'gym'

/** 界面上按这个顺序排列运动类型 */
export const SPORT_ORDER: SportType[] = ['run', 'football', 'basketball', 'gym']

/* ==========================================================================
   周计划
   ========================================================================== */

/**
 * 周计划里的一项：某一周的某一天 + 什么运动 + 目标
 *
 * 注意 weekStart：一开始设计时只记了「星期几」，那样只能存一份固定的周计划，
 * 没法「这周和下周不一样」，也做不了「一键复制上周」。
 * 加上这一周的周一日期之后，每一周才是独立的一份安排。
 */
export type PlanItem = {
  id: string
  userId: string
  /** 这一周的周一，格式 "2026-09-28" */
  weekStart: string
  /** 1 = 周一 ... 7 = 周日 */
  weekday: number
  sport: SportType
  target: string
  memo?: string
}

/** 计划页表单里的内容 */
export type PlanDraft = {
  sport: SportType
  target: string
  memo: string
}

/* ==========================================================================
   训练记录
   ========================================================================== */

/** 健身的每一组 */
export type GymSet = {
  exercise: string
  setNo: number
  reps: number
  weight: number
}

/** 一条训练记录（界面用的形状） */
export type WorkoutRecord = {
  id: string
  userId: string
  /** "2026-09-28" */
  date: string
  sport: SportType
  /** 时长（分钟） */
  duration: number | null
  /** 主观感受 1-5（跑步、足球、篮球用） */
  feel: number | null
  /** 主观强度 1-10（健身用） */
  rpe: number | null
  note?: string

  run?: {
    distance: number
    /** 配速，由距离和时长自动算出来 */
    pace: string
    kind: string
    heartRate?: number
    route?: string
    shoes?: string
  }

  football?: {
    content: string
    intensity: string
    position: string
    opponent?: string
    score?: string
    goals?: number
    assists?: number
  }

  basketball?: {
    content: string
    intensity: string
    position: string
    opponent?: string
    score?: string
    points?: number
    rebounds?: number
    assists?: number
    steals?: number
    blocks?: number
    threeMade?: number
    freeThrowsMade?: number
  }

  gym?: {
    part: string
    sets: GymSet[]
  }
}

/**
 * 记录录入表单里的内容。
 * 表单里全部用字符串存（因为 input 本来就是字符串），
 * 保存时再统一转成数字，这样不用在每次输入时纠结空值。
 */
export type WorkoutDraft = {
  date: string
  sport: SportType
  duration: string
  feel: string
  rpe: string
  note: string
  run: {
    distance: string
    kind: string
    heartRate: string
    route: string
    shoes: string
  }
  football: {
    content: string
    intensity: string
    position: string
    opponent: string
    score: string
    goals: string
    assists: string
  }
  basketball: {
    content: string
    intensity: string
    position: string
    opponent: string
    score: string
    points: string
    rebounds: string
    assists: string
    steals: string
    blocks: string
    threeMade: string
    freeThrowsMade: string
  }
  gym: {
    part: string
    /** 一个动作 + 它的若干组 */
    exercises: { name: string; sets: { reps: string; weight: string }[] }[]
  }
}

/* ==========================================================================
   动态流
   ========================================================================== */

/** 动态流里的一条评论 */
export type FeedComment = {
  id: string
  userId: string
  nickname: string
  text: string
  createdAt: string
}

/**
 * 动态流里的一条。
 * 注意它不是一个独立的「帖子」——它是把训练记录汇总出来的，
 * 所以核心字段是 record，外面再包一层「谁、什么时候、被赞了几次」。
 */
export type FeedItem = {
  record: WorkoutRecord
  nickname: string
  /** 记录创建时间（UTC 时间戳），显示时转成本地时间 */
  createdAt: string
  likeCount: number
  likedByMe: boolean
  comments: FeedComment[]
}
