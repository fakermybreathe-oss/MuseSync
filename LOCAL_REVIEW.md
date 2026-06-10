# MuseSync 本地审核清单

## 审核入口

- 登录页：`http://127.0.0.1:5173/#/login`
- 受保护页面：`http://127.0.0.1:5173/#/app`

本地 Vite 当前运行在 `5173`。本轮只保留本地改动，没有拉取、提交或发布代码。

## 本轮实现

- 登录、注册、邮箱 Magic Link 和认证错误提示全部中文化。
- 未登录访问 `#/app` 会返回 `#/login`，登录成功后进入资料与房间页面。
- 登录页和二级页面各自只使用一片主折射镜片，内部输入框、头像区、按钮和房间项不再创建第二套折射坐标系。
- 主镜片使用 SVG 位移折射、连续高光边缘和厚度阴影，不使用 `backdrop-filter: blur(...)` 毛玻璃。
- 主镜片、输入框、按钮和头像控件保留 `Spring + requestAnimationFrame` 弹性反馈。
- 昵称与 10 宫格头像保存到 `public.profiles`，并按 Supabase 用户 ID 写入 localStorage 兜底缓存。
- 创建或加入房间前必须先成功保存资料；失败时留在当前页面并显示中文错误。
- 所有有成员的房间都会同步到 Supabase，包括私人房和密码房。
- 房间同步包含 `login_address`、`has_password`、`is_public` 和 `updated_at`。
- 房主 IP 按反代 Header 与 Socket 握手地址解析；房主离开时由剩余成员接管。
- 浏览器只能读取活跃房间的非敏感字段，`login_address` 与写权限仅供后端 service role 使用。

## Supabase 状态

- 已重新授权项目：`musesync`，项目 ref：`uaypgtiuocytadgbrnue`。
- 已应用迁移：`20260605173000_auth_profiles_public_rooms.sql`。
- 已应用安全加固迁移：`20260607012344_harden_room_policies.sql`。
- `public.profiles` 已包含昵称、头像索引、头像 URL 与时间字段，并启用用户只能读写本人资料的 RLS。
- `public.public_rooms` 已包含：
  - `login_address text null`
  - `has_password bool default false`
  - `is_public bool default true`
- 已移除旧的公共写入策略；浏览器仅保留活跃房间只读策略。
- `pnpm check:supabase` 已通过。
- Supabase 当前剩余提示是 Auth 的泄露密码保护未开启，属于控制台配置项，不影响本地认证链路审核。

## 自动验证

- `pnpm test:contracts`：30 项通过。
- `pnpm build`：客户端、服务端和共享工作区生产构建全部通过。
- 本轮相关客户端文件 ESLint：通过。
- 980px 桌面截图：主镜片与内容连续，没有内部硬切线或嵌套毛玻璃。
- 375px 设备仿真：
  - 登录页 `innerWidth=375`，文档宽度 `375`，面板宽度 `327`。
  - 二级页面 `innerWidth=375`，文档宽度 `375`，面板宽度 `343`。
  - 两个页面均无横向溢出。

## 请人工审核

1. 打开登录页，注册新账号或登录已有账号。
2. 进入 `#/app`，填写昵称并选择头像。
3. 创建房间或加入房间，确认资料保存成功。
4. 退出后重新登录，确认同一账号恢复昵称和头像。
5. 检查主面板边缘是否有需要继续调整的折射厚度、透明度或回弹手感。
6. 审核通过后再决定是否提交、拉取或发布。

## 审核通过后

用户确认视觉与真实账号流程后，再创建本次完整开发交接 Markdown，记录文件改动、Supabase 迁移、验证命令、已知提示和下一轮开发入口。
