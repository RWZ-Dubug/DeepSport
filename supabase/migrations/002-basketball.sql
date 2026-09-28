-- ============================================================================
--  DeepSport 数据库升级 002：加入篮球
--
--  【怎么用】
--    1. Supabase 控制台 → SQL Editor → New query
--    2. 把本文件全部内容复制进去
--    3. 点 Run，看到 Success 就成了
--
--    可以重复运行，不会弄丢已有数据。
--
--  【这个脚本做两件事】
--    ① 把「运动类型只能是跑步/足球/健身」这个限制放宽，允许篮球
--    ② 加 6 个篮球专属的数据列
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 第 1 步：放宽 sport 的取值范围
--
-- 说明：原来的限制是建表时用 check (...) 写在列上的，PostgreSQL 会自动给它
-- 起个名字。这里先自动找出那个名字再删掉，免得因为名字不一样而删不掉。
-- workouts 和 plan_items 两张表都有这个限制，一起处理。
-- ---------------------------------------------------------------------------
do $$
declare
  item record;
begin
  for item in
    select conrelid::regclass as tbl, conname
      from pg_constraint
     where conrelid in ('public.workouts'::regclass, 'public.plan_items'::regclass)
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%sport%'
  loop
    execute format('alter table %s drop constraint %I', item.tbl, item.conname);
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 第 2 步：加回新的限制（现在允许四种运动）
-- ---------------------------------------------------------------------------
alter table public.workouts
  add constraint workouts_sport_check
  check (sport in ('run', 'football', 'basketball', 'gym'));

alter table public.plan_items
  add constraint plan_items_sport_check
  check (sport in ('run', 'football', 'basketball', 'gym'));


-- ---------------------------------------------------------------------------
-- 第 3 步：加篮球专属的数据列
--
-- 注意：有几个字段篮球和足球是共用的，不用新建：
--   content    训练内容
--   intensity  强度
--   position   场上位置
--   opponent   对手
--   score      比分
--   assists    助攻（足球、篮球都用它）
--   duration   时长
--   feel       主观感受
--   note       备注
-- ---------------------------------------------------------------------------
alter table public.workouts add column if not exists points           int;  -- 得分
alter table public.workouts add column if not exists rebounds         int;  -- 篮板
alter table public.workouts add column if not exists steals           int;  -- 抢断
alter table public.workouts add column if not exists blocks           int;  -- 盖帽
alter table public.workouts add column if not exists three_made       int;  -- 三分命中
alter table public.workouts add column if not exists free_throws_made int;  -- 罚球命中


-- 完成。看到 Success 就说明篮球已经可以用了。
