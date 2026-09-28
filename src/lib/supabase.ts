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

/**
 * 决定数据库请求到底发到哪个地址。
 *
 * 【为什么要多这一层】
 * Supabase 的服务器在国外（走 Cloudflare 的 IP）。国内有一部分网络、
 * 运营商、地区连不上它。表现出来是一个非常迷惑的现象：
 *
 *     网页能正常打开（网站在 Netlify 上，能连）
 *     但一注册/登录就报「连不上数据库」
 *
 * 所以线上改成走「同源中转」：请求发给本站的 /api/...，
 * 由 Netlify 根据 netlify.toml 里的规则转给真正的 Supabase。
 * 浏览器全程只跟本站说话，不直接去连国外服务器。
 *
 * 附带好处：同源请求没有跨域（CORS）问题，更快更稳。
 *
 * 【本地开发怎么办】
 * localhost 不走中转，直接用 .env.local 里配的地址（开发机网络通常没问题）。
 */
function resolveSupabaseUrl(): string | undefined {
  const configured = normalizeUrl(import.meta.env.VITE_SUPABASE_URL)
  if (!configured) return undefined

  const { protocol, hostname, origin } = window.location
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'

  // 本地开发：直连
  if (isLocal || protocol !== 'https:') return configured

  // 线上：走同源中转（netlify.toml 里配置了 /api/* 的转发规则）
  return `${origin}/api`
}

const url = resolveSupabaseUrl()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/**
 * 有没有把 Supabase 的密钥填进环境变量？
 * 没填的话，整个应用会自动以「预览模式」运行 —— 界面照常看，只是存不了数据，
 * 这样就不会因为少配一个密钥而白屏。
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null
