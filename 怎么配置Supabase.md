# DeepSport · Supabase 配置记录

> 配置一次就够了，这份文档是**记录 + 排错手册**。
> 以后换电脑、重建项目、或者朋友问你怎么弄，看这份。

---

## 一、这个项目用的 Supabase 信息

| 项目 | 值 |
|---|---|
| 项目名 | `deepsport` |
| 项目 ID（ref） | `diakytzfcmqhoegfvxuc` |
| 完整地址 | `https://diakytzfcmqhoegfvxuc.supabase.co` |
| 控制台 | https://supabase.com/dashboard/project/diakytzfcmqhoegfvxuc |
| 密钥存放 | 项目里的 `.env.local`（已加入 .gitignore，不会上传 GitHub） |

> 🔒 **anon public key 是公开密钥**，它本来就要出现在网页代码里给所有人下载，**不是秘密**。
> 真正要保密的是 **Database Password**（建项目时生成的那个）和 **service_role key**，这两个绝不能写进前端代码。

---

## 二、配置清单（做完打勾）

| # | 做什么 | 在哪 | 状态 |
|---|---|---|---|
| 1 | 注册 Supabase 账号 | https://supabase.com | ✅ |
| 2 | 建项目 `deepsport`，区域选 Singapore | New project | ✅ |
| 3 | **Enable Email provider 打开** | Authentication → Sign In / Providers → Email | ✅ |
| 4 | **Confirm email 关闭** | Authentication → Sign In / Providers **页面本体**（⚠️ 不在 Email 抽屉里，见坑 3） | ✅ |
| 5 | 跑建表脚本（6 张表） | SQL Editor → 粘贴 `supabase/schema.sql` → Run | ✅ |
| 6 | 复制 URL + anon key 填进 `.env.local` | Project Settings → API | ✅ |

**验证过的事实（都是真跑出来的，不是猜的）：**

| 检查 | 结果 |
|---|---|
| 6 张表 | 全部 `200`，权限规则（RLS）生效 |
| `external.email` | `true` —— 邮箱登录已打开 |
| `mailer_autoconfirm` | `true` —— 注册不需要邮箱验证 |
| `disable_signup` | `false` —— 允许注册 |
| 真注册一次 | `HTTP 200` + 立刻拿到登录凭证 |
| `handle_new_user` 触发器 | 昵称正确写入 `profiles` |
| 写入训练记录（RLS insert） | `HTTP 201` 成功 |
| 删除记录（RLS delete） | `HTTP 204` 成功 |

---

## 三、⚠️ 踩过的坑（重点看这里）

### 坑 1：Project URL 只复制了「项目 ID」

**错误写法：**
```
VITE_SUPABASE_URL=diakytzfcmqhoegfvxuc
```

**正确写法：**
```
VITE_SUPABASE_URL=https://diakytzfcmqhoegfvxuc.supabase.co
```

从后台复制时很容易只选到中间那段。**现在代码里已经加了自动补全**，只写项目 ID 也能用，但建议还是写完整。

### 坑 2：改完 `.env.local` 忘记按 Ctrl+S

VS Code 里改了不保存，文件根本没变，程序读到的还是空值。
**判断方法**：文件标签上有个小圆点 `●` 就是没保存；`×` 才是保存了。

### 坑 3（最坑）：`Enable Email provider` 和 `Confirm email` 搞反了

这两个开关**在同一个页面、上下挨着、名字都带 Email**，极易关错。

| 开关 | 应该 | 作用 |
|---|---|---|
| **Enable Email provider** | ✅ **开** | 「允许用邮箱注册登录」的总开关。关了 → **所有人都注册不了**，报错 `Email signups are disabled` |
| **Confirm email** | ❌ **关** | 「注册后必须去邮箱点链接才能用」。关了才是注册完立刻能用 |

**记忆口诀：总开关要开，验证开关要关。**

那一页长这样：
```
  Authentication → Sign In / Providers
  ┌────────────────────────────────────────────┐
  │  User Signups            ← 在这一块里！     │
  │    Allow new users to sign up   [ ●━ ]  ✅ │
  │    Confirm email                [ ━● ]  ❌ │
  │                                            │
  │  ─────────────────────────────────────     │
  │  Auth Providers（下面是登录方式列表）        │
  │    Email >          ← 点开的抽屉里【没有】  │
  │    Phone >            Confirm email 开关！  │
  │    Google >                                 │
  └────────────────────────────────────────────┘
```

⚠️ **这是最容易踩空的地方**：`Email` 抽屉里只有「Enable email provider / Secure email change / 密码长度 / OTP 有效期」这些，
**没有** `Confirm email`。别在抽屉里找，关掉抽屉看页面本体。

（`Enable email provider` 这个开关**是在**抽屉里的，所以很容易误以为 `Confirm email` 也在那儿。）

---

## 四、为什么 `Confirm email` 必须关掉？（硬理由）

来自 [Supabase 官方文档](https://supabase.com/docs/guides/auth/auth-smtp)：

> 如果你没有配置自己的 SMTP 邮件服务，Supabase 内置邮件服务
> **只会发送给「项目团队成员」的邮箱**，其他地址一律失败，报错 `Email address not authorized`。
> 而且内置服务**限速每小时 2 封**，官方明确说「不保证送达、不建议用于生产环境」。

**对 DeepSport 的影响：**

「Confirm email」开着的话，**你的朋友用自己的邮箱注册会直接失败**（因为他们的邮箱不在你的 Supabase 团队名单里）。
只有你自己的邮箱能收到验证邮件。

所以：**要么关掉 Confirm email，要么去接 Resend / Brevo 这类第三方邮件服务**（那是另一套配置，目前不需要）。

---

## 五、出问题了怎么查

### 报错对照表

| 页面上的报错 | 真正的原因 | 怎么修 |
|---|---|---|
| `Email signups are disabled` | Enable Email provider 被关了 | 去打开总开关 |
| `Email address not authorized` | Confirm email 还开着，且邮箱不在团队里 | 去关掉 Confirm email |
| `Email not confirmed` | 同上 | 同上 |
| `Invalid login credentials` | 邮箱或密码打错了 | 重新输 |
| `User already registered` | 这个邮箱注册过了 | 切到「登录」标签 |
| 连不上数据库 / fetch failed | 网络问题，或 `.env.local` 填错 | 检查地址和密钥 |

### 自己动手验证（可选）

在 VS Code 终端里运行，会打印当前的认证设置：

```powershell
node -e "fetch('https://diakytzfcmqhoegfvxuc.supabase.co/auth/v1/settings',{headers:{apikey:process.env.K}}).then(r=>r.json()).then(s=>console.log(s))" 
```

看两个值：
- `external.email` 要是 `true`
- `mailer_autoconfirm` 要是 `true`（true = 不需要邮箱验证，正是我们想要的）

---

## 六、免费版的限制（提前知道）

| 限制 | 说明 | 影响 |
|---|---|---|
| 项目 7 天不用会暂停 | 控制台点 **Restore** 一键恢复 | 数据不丢，但朋友那几天打不开 |
| 数据库 500 MB | 我们这种文字记录用不了多少 | 基本无感 |
| 月活用户 50,000 | 小圈子远远够 | 无感 |
| 内置邮件每小时 2 封 | 所以关掉 Confirm email | 已规避 |

---

## 七、6 张表是干什么的

| 表 | 大白话 |
|---|---|
| `profiles` | 昵称。注册时由触发器自动建 |
| `plan_items` | 周计划：星期几 + 什么运动 + 目标 |
| `workouts` | 一次训练一条，三种运动的专属字段都在里面，用不到就留空 |
| `gym_sets` | 健身的每一组，一行一组（卧推 60kg × 8） |
| `likes` | 点赞 |
| `comments` | 评论 |

**权限规则一句话：所有人看得到所有人的，但只能改自己的。**
（这就是你选的「不分组，全部人互相可见」）
