/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase 项目地址，形如 https://xxxxx.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase 的 anon public key（这串是公开的，放在前端没有安全问题） */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
