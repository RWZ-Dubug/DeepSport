-- ============================================================================
--  DeepSport 数据库升级 001：周计划加上「周次」
--
--  【为什么要升级】
--    plan_items 表原来只有「星期几」。那样只能存一份固定的周计划，
--    做不到「这周和上周不一样」，也就没法实现「一键复制上周」。
--    加上 week_start（那一周的周一日期）之后，每一周都是独立的一份安排。
--
--  【怎么用】
--    1. Supabase 控制台 → 左边菜单 SQL Editor → New query
--    2. 把本文件全部内容复制进去
--    3. 点 Run，看到 Success 就成了
--
--    可以重复运行，不会弄丢已有数据。
-- ============================================================================


-- 1) 加列。先允许为空，好给已有数据补值
alter table public.plan_items
  add column if not exists week_start date;


-- 2) 给已有数据补上周次：按它创建时间所在的那一周算
update public.plan_items
   set week_start = date_trunc('week', coalesce(created_at, now()))::date
 where week_start is null;


-- 3) 补完了，改成必填
alter table public.plan_items
  alter column week_start set not null;


-- 4) 加快「按人 + 按周」查询
create index if not exists plan_items_week_idx
  on public.plan_items (user_id, week_start);


-- 5) 约束：同一周的同一天，只能有一条安排
--    （防止手滑给周三排两条）
create unique index if not exists plan_items_unique_slot
  on public.plan_items (user_id, week_start, weekday);


-- 完成。看到 Success 就说明升级成功了。
