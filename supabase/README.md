# MuseSync Supabase 本地迁移

本目录保存 MuseSync Auth 用户资料和房间大厅同步所需的本地 SQL。当前只完成本地代码与迁移准备，尚未修改远端数据库。

## 当前迁移

- `migrations/20260605173000_auth_profiles_public_rooms.sql`

该迁移会创建或升级：

- `public.profiles`
  - `id uuid primary key references auth.users(id)`
  - `display_name text`
  - `avatar_index integer not null default 0`
  - `avatar_url text`
  - `created_at timestamptz`
  - `updated_at timestamptz`
  - RLS：登录用户只能读取、新增和更新自己的资料。
  - CHECK：昵称去空格后为 1–20 字；头像索引只能是 0–9。
- `public.public_rooms`
  - active room/lobby fields
  - `login_address text`
  - `has_password boolean not null default false`
  - `is_public boolean not null default true`
  - RLS：匿名和登录用户只能读取活跃房间的非敏感列。
  - `login_address` 不授予浏览器读取权限。

## 本地审核通过后

在以下 Supabase 项目的 SQL Editor 中执行 `migrations/20260605173000_auth_profiles_public_rooms.sql`：

```text
https://uaypgtiuocytadgbrnue.supabase.co
```

不要把 service role key 放进前端。浏览器只需要：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

生产环境必须在 Cloudflare Pages 等部署平台中配置这两个变量。仓库中的 `apps/client/.env.production` 不赋值，避免占位字符串被 Vite 编译进客户端包。

后端房间同步必须配置：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

服务端会持续上报所有有成员的房间，包括私密房和密码房。房主离开或断线后，剩余成员会自动完成房主交接，下一次同步改为新房主 IP。浏览器不负责写入房间或房主 IP。

## Auth Redirect URL

在 Supabase Dashboard 的 **Authentication > URL Configuration** 中配置：

```text
Site URL: 生产站点根地址
Redirect URLs:
http://127.0.0.1:5173/
生产站点根地址
```

Redirect URL 必须是站点根地址或实际部署路径，不能附加 `#/app`。Supabase implicit flow 会临时占用 URL fragment 返回认证信息，客户端解析完成后再进入 `#/app`。

## 应用后验证

From the repository root, run:

```powershell
pnpm check:supabase
```

该命令读取 `apps/client/.env.local` 并检查远端 REST schema，不会输出 anon key。

本地契约测试：

```powershell
pnpm test:contracts
```

1. Create or sign in with a MuseSync account.
2. Go to `#/app`.
3. Set nickname and avatar.
4. Create or join a room.
5. In Supabase Table Editor, confirm the signed-in user's row exists in `public.profiles` with `display_name` and `avatar_index`.

客户端的 localStorage 仅作为断网 fallback，并按 Supabase 用户 ID 分键保存；不同账号不会共用昵称和头像缓存。

## 时间字段

- MuseSync 账号最近登录时间：Supabase Auth 自动维护 `auth.users.last_sign_in_at`，可在 Authentication 用户列表中查看。
- 房间最近活跃时间：`public.public_rooms.updated_at`，由后端约每 5 秒的房间心跳更新。
- `profiles.updated_at` 只代表昵称或头像资料最后修改时间。

这三种时间语义不同，因此不会额外在 `profiles` 重复创建登录时间列。

迁移应用前的只读检查结果：

- `public_rooms` exists but is missing at least the `has_password` column.
- `profiles` is missing from the remote REST schema.

应用迁移后，云端资料保存和完整大厅同步才会真正可用。

登录注册页对重复邮箱使用中性确认提示，避免根据注册响应泄露账号是否存在。
