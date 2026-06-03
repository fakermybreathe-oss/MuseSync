---
goal: 'Integrate Supabase BaaS, Cartoony Avatar Selector, and Live Lobby'
version: '1.0'
date_created: '2026-06-02'
last_updated: '2026-06-02'
owner: 'Antigravity'
status: 'Planned'
tags: ['architecture', 'database', 'auth', 'design']
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

本架构设计方案旨在解决双端连接头像重复的视觉瑕疵，满足用户对“房主/游客一键式昵称与头像注册”的高灵动交互追求，并规划了 Supabase BaaS 实时云端数据库在同播系统中的落地与全网活跃“公共同播大厅（Live Lobby）”的实现方案。

## 1. Requirements & Constraints

- **REQ-001**: 渐进式临时 Profile 机制。用户首次进入页面，必须先弹出 iOS 控制中心风格的极速头像与昵称设置卡片，保存至 `localStorage`。
- **REQ-002**: 10 宫格卡通形象。前端内置 10 个知名可爱卡通人物头像（哆啦A梦、皮卡丘、蜡笔小新、龙猫、史迪奇、海绵宝宝等）的扁平高画质 SVG 渲染或防盗链 CDN。
- **REQ-003**: Supabase 数据库接入。使用 Supabase BaaS 替代笨重的本地 MySQL 配置，实现秒级拉起并在云端持久化用户账号与 Live 房间状态。
- **REQ-004**: 实时公共大厅广播。房主创建房间时可选择“广播为全网公共房间”，大厅数据库记录该房间并在欢迎页下方以晶莹毛玻璃卡片流实时渲染，支持异地路人 0 门槛随时加入。
- **CON-001**: 跨端网络安全性。Supabase anon 匿名公钥将使用 Vite 的 `import.meta.env` 安全注入，不泄露后台数据库修改权。
- **CON-002**: 零占位符与 100% 完整交付。未来所开发的代码必须是完美 drop-in，绝不能有任何 `// ...` 的代码。

## 2. Implementation Steps

### Implementation Phase 1: 卡通 10 宫格 Profile 与 LocalStorage 零门槛入舱

- GOAL-001: 解决双端头像重复痛点，无需外部数据库即可实现两端完全不同的昵称与头像标识。

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | 在前端 `components/` 下新建 `AvatarSelector.tsx`。构建一个精巧的 10 宫格卡通头像点击选择面板，内置 10 个知名卡通人物的高清 CDN 地址，并伴有弹性形变微动画。 | | |
| TASK-002 | 修改 `WelcomePortal.tsx` 门脸页。若本地未检测到 `musesync_user_profile` 缓存，首要弹出设置昵称和 10 宫格头像面板。 | | |
| TASK-003 | 修改 `MuseSyncPlayer.tsx`。在 Socket 的 `join:room` 事件中携带本地配置的昵称和头像地址，并在 `TopBar` 水晶舱中实时渲染，彻底终结双端头像雷同问题。 | | |

### Implementation Phase 2: 后端数据库 Supabase 数据表设计与集成

- GOAL-002: 建立成熟的云端数据库，实现多端账户持久化与登录态托管。

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | 在 Supabase 控制台创建 Postgres 数据库表：定义 `users` 表与 `rooms` 表，设置 UUID 关联和 `is_public` 活跃状态（Schema 见 Alternatives）。 | | |
| TASK-005 | 前端 `package.json` 引入 `@supabase/supabase-js` 官方 SDK，并在 `utils/` 下新建 `supabaseClient.ts`。 | | |
| TASK-006 | 在 `MuseSyncPlayer.tsx` 接入 Supabase 用户持久化登录，提供尊贵会员账号与游客一键无缝绑定升级入口。 | | |

### Implementation Phase 3: Live 全网公共同频大厅广播

- GOAL-003: 房主创建公共房间后，全网其他游客能在欢迎页的 Live 大厅流中实时看到并一键加入。

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | 升级后端 `index.ts` 内存状态，并在创建房间事件中引入对 `isPublic` 标识的持久化，向 Supabase 实时广播此公开发布。 | | |
| TASK-008 | 在 `WelcomePortal.tsx` 下方嵌入一个晶莹剔透的毛玻璃滚动“全网共鸣同频舱大厅”，实时抓取全网正在播放的活跃公共房间。 | | |

## 3. Alternatives

- **ALT-001**: 采用传统的云服务器本地安装 MySQL 数据库。我们建议放弃该方案，转而采用 Supabase。这极大减轻了独立开发者维护物理数据库、端口防黑、配置连接池的精力消耗，且能借力 Supabase 的实时数据库特性直接实现大厅秒级无缝同步。
- **ALT-002**: Postgres 数据库表 SQL Schema 参考设计：
  ```sql
  -- 用户资产表
  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nickname VARCHAR(50) NOT NULL,
    avatar_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- 全网公共同播房间表
  CREATE TABLE rooms (
    room_id VARCHAR(10) PRIMARY KEY,
    host_id UUID REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(64),
    is_public BOOLEAN DEFAULT false,
    current_track_title VARCHAR(255),
    rtt_ms INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );
  ```

## 4. Dependencies

- **DEP-001**: `@supabase/supabase-js` ^2.0.0 (待引入)
- **DEP-002**: `socket.io` ^4.0.0 (现有后端长链)

## 5. Files

- **FILE-001**: [AvatarSelector.tsx](file:///c:/Users/windy03/Desktop/新webapp/apps/client/src/components/AvatarSelector.tsx) (NEW - 卡通10宫格极简拟物化点击板)
- **FILE-002**: [WelcomePortal.tsx](file:///c:/Users/windy03/Desktop/新webapp/apps/client/src/views/WelcomePortal.tsx) (MODIFY - 整合卡通设置和公共同频大厅)
- **FILE-003**: [MuseSyncPlayer.tsx](file:///c:/Users/windy03/Desktop/新webapp/apps/client/src/views/MuseSyncPlayer.tsx) (MODIFY - 穿透携带用户 Profile 数据)
- **FILE-004**: [index.ts](file:///c:/Users/windy03/Desktop/新webapp/apps/server/src/index.ts) (MODIFY - 引入数据库活跃房间同步广播)

## 6. Testing

- **TEST-001**: 10宫格临时头像本地持久化测试。验证 localStorage 能否 100% 保留卡通头像索引与昵称，刷新是否 0 门槛自动对齐。
- **TEST-002**: 异地多端水晶舱双头像辨识测试。两端设置完全不同的卡通头像，在 VPS 穿透环境下，验证水晶舱是否高对比度地渲染出两个完全不同的可爱头像。
- **TEST-003**: 大厅 Live 广播同步测试。Host 开启公共房间后，在异地 Guest 端大厅实时列表观察该房间名、在播歌名是否秒级广播，点击是否能 0 门槛瞬间接入同播。

## 7. Risks & Assumptions

- **RISK-001**: Supabase 免费套餐在长期闲置后，数据库会被自动暂停，导致再次加载时会由于冷启动而产生约 5-10 秒的延迟。
- **ASSUMPTION-001**: 假设精选的 10 个高清卡通头像均托管在阿里/腾讯的高稳定性无损图片 CDN 上，确保任意设备秒速载入。

## 8. Related Specifications / Further Reading

- [DESIGN.md](file:///c:/Users/windy03/Desktop/新webapp/DESIGN.md) (系统设计白皮书)
- [musesync_backend_spec.md](file:///c:/Users/windy03/Desktop/新webapp/musesync_backend_spec.md) (后端通信规范)
