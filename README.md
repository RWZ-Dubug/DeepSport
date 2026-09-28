# DeepSport

> 一个给自己和小圈子朋友用的**训练计划与记录**网页应用，覆盖 **跑步 / 足球 / 篮球 / 健身** 四项运动。

**提前排好一周的训练计划 → 练完当场打卡记录 → 和朋友互相看见、互相监督。**

它解决的不是「专业运动员分析数据」，而是**普通人坚持训练**这件事：有计划、有记录、有人看得见。

---

## 功能

- **账号**：邮箱 + 密码注册登录，昵称显示在动态里
- **周计划**：按周排、绑定星期几，下周可一键「复制上周」，也能清空重排
- **训练记录**：四种运动各有专属字段
  - 跑步：距离、时长、**配速自动计算**、跑步类型、心率、路线、跑鞋
  - 足球：训练内容、强度、位置、对手比分、进球助攻
  - 篮球：训练内容、强度、位置、对手比分、**得分 / 篮板 / 助攻 / 抢断 / 盖帽 / 三分 / 罚球**
  - 健身：训练部位、动作、**每一组单独记录**（组数 / 次数 / 重量）、RPE
- **动态**：所有人练完自动出现在动态流里，可点赞、可评论
- **关键数字**：本周跑量、本周训练次数、连续打卡天数

## 技术栈

| 层 | 选择 |
|---|---|
| 界面 | React 19 + TypeScript + Vite 7 |
| 样式 | Tailwind CSS 4 |
| 数据与账号 | Supabase（Postgres + 内置邮箱密码账号系统） |
| 路由 | React Router 7 |
| 图标 | lucide-react |
| 上线 | Vercel |

## 本地运行

```bash
npm install
npm run dev
```

然后打开 http://localhost:5173

详细步骤（含遇到问题怎么办）看 **[怎么运行.md](./怎么运行.md)**。

## 首次使用需要配置

项目依赖 Supabase 提供数据库和账号系统，所以第一次跑起来需要：

1. 建一个 Supabase 项目
2. 把地址和密钥填进 `.env.local`（这个文件已被 `.gitignore` 忽略，**不会上传**）
3. 在 Supabase 的 SQL Editor 里依次运行建表脚本

完整步骤和踩过的坑都在 **[怎么配置Supabase.md](./怎么配置Supabase.md)**。

```
.env.local 里需要两行：
VITE_SUPABASE_URL=https://你的项目ID.supabase.co
VITE_SUPABASE_ANON_KEY=你的 anon public key
```

> `anon public key` 是**公开密钥**，放在前端代码里是设计如此，不是泄露。
> 真正要保密的是 Database Password 和 service_role key。

## 数据库

```
supabase/
├── schema.sql                      建表脚本（全新项目跑这个）
└── migrations/
    ├── 001-week-start.sql          周计划加上「周次」列
    └── 002-basketball.sql          加入篮球
```

6 张表：`profiles` 个人资料、`plan_items` 周计划、`workouts` 训练记录、
`gym_sets` 健身每一组、`likes` 点赞、`comments` 评论。

**权限规则一句话：所有人看得到所有人的，但只能改自己的。**

## 项目结构

```
src/
├── main.tsx              入口（含全局出错兜底）
├── App.tsx               路由表 + 登录守门人
├── index.css             全局样式（Tailwind）
├── components/
│   ├── Layout.tsx        外壳：顶栏 + 导航 + 手机底部标签栏
│   └── ErrorBoundary.tsx 组件出错兜底，避免整页白屏
├── pages/
│   ├── Login.tsx         登录 / 注册
│   ├── Today.tsx         今天：今日安排 + 快速记录 + 关键数字
│   ├── Plan.tsx          计划：按周排、复制上周、清空
│   ├── Records.tsx       记录：历史列表 + 按运动筛选
│   ├── LogWorkout.tsx    记一笔：四种运动的录入表单
│   └── Feed.tsx          动态：动态流 + 点赞 + 评论
└── lib/
    ├── types.ts          类型定义 + 运动列表（改这里就能加运动项目）
    ├── date.ts           日期与时间计算
    ├── sport.ts          运动的名称与配色
    ├── supabase.ts       数据库连接
    ├── auth-context.ts   登录状态定义 + useAuth
    ├── auth.tsx          登录逻辑（AuthProvider）
    ├── plan.ts           周计划的数据库操作
    ├── workout.ts        训练记录的数据库操作
    └── feed.ts           动态、点赞、评论的数据库操作
```

`src/lib/types.ts` 里的 `SPORT_ORDER` 是**运动类型的唯一清单** ——
界面上的按钮、筛选、表单都从它生成，所以加运动项目只要改这一处加一个表单区块。

## 文档

| 文件 | 内容 |
|---|---|
| [需求文档.md](./需求文档.md) | 项目的完整需求（逐条确认过的选择，含「明确不做」的清单） |
| [怎么运行.md](./怎么运行.md) | 怎么启动、怎么关、遇到报错怎么办、文件都是干什么的 |
| [怎么配置Supabase.md](./怎么配置Supabase.md) | 配置记录 + 排错手册（含踩过的坑） |

## 已知局限

- 网页版**不会弹手机提醒**，不能像 App 那样到点震动催训练
- **心率要自己填**，需要手表或心率带
- 服务器在国外（Supabase + Vercel 免费版），国内打开偶尔慢几秒
- **所有人互相可见**：任何拿到网址注册的人都能看到训练数据
- Supabase 免费版项目 7 天不用会自动暂停，控制台点一下 Restore 即可恢复

## 开发命令

| 命令 | 干什么 |
|---|---|
| `npm run dev` | 本地启动 |
| `npm run build` | 打包（部署时用） |
| `npm run preview` | 预览打包结果 |
| `npm run lint` | 代码规范检查 |
