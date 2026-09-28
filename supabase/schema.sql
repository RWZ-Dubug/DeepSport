-- ============================================================================
--  DeepSport 数据库建表脚本
--
--  怎么用：
--    1. 打开 https://supabase.com/dashboard ，点进你的项目
--    2. 左边菜单点 「SQL Editor」
--    3. 点 「New query」
--    4. 把这一整个文件的内容复制进去
--    5. 点右下角 「Run」（或者按 Ctrl + Enter）
--    6. 看到 Success 就成了
--
--  这个脚本可以重复运行，不会把已有数据弄丢。
--
--  设计说明（给人看的）：
--    · 一共 6 张表，对应需求文档里说的 6 个 Excel 工作表
--    · 权限规则 = 「所有人看得到所有人的，但只能改自己的」
--      （这就是你选的「不分组，全部人互相可见」）
-- ============================================================================


-- ============================================================================
--  1. 个人资料（昵称）
-- ============================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null,
  created_at timestamptz not null default now()
);

-- 新用户注册时，自动帮他建一条资料（昵称取注册时填的，没填就用邮箱前缀）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nickname', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================================
--  2. 周计划：星期几 + 什么运动 + 目标
-- ============================================================================
create table if not exists public.plan_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  week_start date not null,                                   -- 这一周的周一，例如 2026-09-28
  weekday    int  not null check (weekday between 1 and 7),   -- 1=周一 ... 7=周日
  sport      text not null check (sport in ('run', 'football', 'basketball', 'gym')),
  target     text not null,                                   -- 例如「5 公里」
  memo       text,                                            -- 例如「轻松跑，配速 5'30"」
  created_at timestamptz not null default now()
);

create index if not exists plan_items_week_idx
  on public.plan_items (user_id, week_start);

-- 同一周的同一天只能有一条安排
create unique index if not exists plan_items_unique_slot
  on public.plan_items (user_id, week_start, weekday);


-- ============================================================================
--  3. 训练记录：一次训练一条
--     三种运动的专属字段都放在这张表里，用不到的就留空（null）
-- ============================================================================
create table if not exists public.workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  sport      text not null check (sport in ('run', 'football', 'basketball', 'gym')),
  duration   int,          -- 时长（分钟）
  feel       int,          -- 主观感受 1-5（跑步/足球用）
  rpe        int,          -- 主观强度 1-10（健身用）
  note       text,         -- 文字备注

  -- ---- 跑步专属 ----
  distance   numeric(6, 2),   -- 公里
  pace       text,            -- 配速，例如 5'37"
  run_kind   text,            -- 轻松跑 / 间歇跑 / 长距离 / 比赛 / 恢复跑
  heart_rate int,             -- 心率（选填）
  route      text,            -- 路线 / 地点
  shoes      text,            -- 跑鞋

  -- ---- 足球专属 ----
  content    text,            -- 训练内容：传球 / 射门 / 盘带 / 体能 / 战术 / 对抗
  intensity  text,            -- 强度：轻松 / 中等 / 比赛强度
  position   text,            -- 场上位置
  opponent   text,            -- 对手（选填）
  score      text,            -- 比分（选填）
  goals      int,             -- 进球（选填）
  assists    int,             -- 助攻（选填）

  -- ---- 健身专属 ----
  part       text,            -- 训练部位：胸 / 背 / 腿 / 肩 / 手臂 / 核心 / 全身

  -- ---- 篮球专属 ----
  -- （训练内容 content、强度 intensity、位置 position、对手 opponent、
  --   比分 score、助攻 assists 都和足球共用上面那些列）
  points           int,       -- 得分
  rebounds         int,       -- 篮板
  steals           int,       -- 抢断
  blocks           int,       -- 盖帽
  three_made       int,       -- 三分命中
  free_throws_made int,       -- 罚球命中

  created_at timestamptz not null default now()
);

create index if not exists workouts_date_idx  on public.workouts (date desc);
create index if not exists workouts_user_idx  on public.workouts (user_id);


-- ============================================================================
--  4. 健身的「每一组」：一行一组
--     例如  深蹲 | 第1组 | 8次 | 60kg
-- ============================================================================
create table if not exists public.gym_sets (
  id         uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise   text not null,        -- 动作名，例如「卧推」
  set_no     int  not null,        -- 第几组
  reps       int  not null,        -- 次数
  weight     numeric(6, 2) not null -- 重量（公斤）
);

create index if not exists gym_sets_workout_idx on public.gym_sets (workout_id);


-- ============================================================================
--  5. 点赞
-- ============================================================================
create table if not exists public.likes (
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id)     -- 同一个人对同一条只能点一次
);


-- ============================================================================
--  6. 评论
-- ============================================================================
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_workout_idx on public.comments (workout_id);


-- ============================================================================
--  权限规则（RLS = 行级安全）
--
--  规则一句话：所有人看得到所有人的，但只能增删改自己的。
-- ============================================================================

alter table public.profiles   enable row level security;
alter table public.plan_items enable row level security;
alter table public.workouts   enable row level security;
alter table public.gym_sets   enable row level security;
alter table public.likes      enable row level security;
alter table public.comments   enable row level security;

-- ---- profiles ----
drop policy if exists "profiles 所有人可读" on public.profiles;
create policy "profiles 所有人可读" on public.profiles
  for select using (true);

drop policy if exists "profiles 只能改自己" on public.profiles;
create policy "profiles 只能改自己" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles 只能建自己" on public.profiles;
create policy "profiles 只能建自己" on public.profiles
  for insert with check (auth.uid() = id);

-- ---- plan_items ----
drop policy if exists "计划 所有人可读" on public.plan_items;
create policy "计划 所有人可读" on public.plan_items
  for select using (true);

drop policy if exists "计划 只能增自己的" on public.plan_items;
create policy "计划 只能增自己的" on public.plan_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "计划 只能改自己的" on public.plan_items;
create policy "计划 只能改自己的" on public.plan_items
  for update using (auth.uid() = user_id);

drop policy if exists "计划 只能删自己的" on public.plan_items;
create policy "计划 只能删自己的" on public.plan_items
  for delete using (auth.uid() = user_id);

-- ---- workouts ----
drop policy if exists "记录 所有人可读" on public.workouts;
create policy "记录 所有人可读" on public.workouts
  for select using (true);

drop policy if exists "记录 只能增自己的" on public.workouts;
create policy "记录 只能增自己的" on public.workouts
  for insert with check (auth.uid() = user_id);

drop policy if exists "记录 只能改自己的" on public.workouts;
create policy "记录 只能改自己的" on public.workouts
  for update using (auth.uid() = user_id);

drop policy if exists "记录 只能删自己的" on public.workouts;
create policy "记录 只能删自己的" on public.workouts
  for delete using (auth.uid() = user_id);

-- ---- gym_sets（归属看它挂在哪条训练记录下）----
drop policy if exists "组 所有人可读" on public.gym_sets;
create policy "组 所有人可读" on public.gym_sets
  for select using (true);

drop policy if exists "组 只能增自己的" on public.gym_sets;
create policy "组 只能增自己的" on public.gym_sets
  for insert with check (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

drop policy if exists "组 只能改自己的" on public.gym_sets;
create policy "组 只能改自己的" on public.gym_sets
  for update using (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

drop policy if exists "组 只能删自己的" on public.gym_sets;
create policy "组 只能删自己的" on public.gym_sets
  for delete using (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

-- ---- likes ----
drop policy if exists "点赞 所有人可读" on public.likes;
create policy "点赞 所有人可读" on public.likes
  for select using (true);

drop policy if exists "点赞 只能点自己的" on public.likes;
create policy "点赞 只能点自己的" on public.likes
  for insert with check (auth.uid() = user_id);

drop policy if exists "点赞 只能取消自己的" on public.likes;
create policy "点赞 只能取消自己的" on public.likes
  for delete using (auth.uid() = user_id);

-- ---- comments ----
drop policy if exists "评论 所有人可读" on public.comments;
create policy "评论 所有人可读" on public.comments
  for select using (true);

drop policy if exists "评论 只能发自己的" on public.comments;
create policy "评论 只能发自己的" on public.comments
  for insert with check (auth.uid() = user_id);

drop policy if exists "评论 只能删自己的" on public.comments;
create policy "评论 只能删自己的" on public.comments
  for delete using (auth.uid() = user_id);


-- ============================================================================
--  收工。看到 Success 就说明 6 张表和权限规则都建好了。
-- ============================================================================
