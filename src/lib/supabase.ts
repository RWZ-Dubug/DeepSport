import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 容错：Project URL 完整的样子是 https://abcdefg.supabase.co，
 * 但从后台复制时很容易只复制到中间那段「项目 ID」。
 * 这里帮它自动补全，省得因为少写一截而白屏又看不出原因。
 */
function normalizeUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim()
  if (!value) return undefined
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, '')
  return `https://${value}.supabase.co`
}

const url = normalizeUrl(import.meta.env.VITE_SUPABASE_URL)
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/**
 * 有没有把 Supabase 的密钥填进 .env.local？
 * 没填的话，整个应用会自动以「预览模式」运行 —— 界面照常看，只是存不了数据，
 * 这样就不会因为少配一个密钥而白屏。
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null
