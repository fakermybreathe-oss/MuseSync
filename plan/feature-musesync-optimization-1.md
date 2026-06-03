---
goal: 'Optimize MuseSync Cross-Region Sync and UI Aesthetics'
version: '1.0'
date_created: '2026-06-02'
last_updated: '2026-06-02'
owner: 'Antigravity'
status: 'Planned'
tags: ['feature', 'refactor', 'architecture', 'design']
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

本计划旨在全面优化 MuseSync 异地/跨境双向同播系统的可靠性、响应速度、安全性及浪漫美学交互。实施内容包括：弱网断线自愈与高精进度追赶、智能音频预缓冲、房间密码加盐哈希安全校验，以及冰川液晶舱极光延迟波动微动效 UI 升级。

## 1. Requirements & Constraints

- **REQ-001**: 弱网自愈能力。客户端在 Socket 意外断连重连后，必须在 2 秒内自动向服务器拉取状态并同步播放指针，免除用户二次手动点击播放。
- **REQ-002**: 高精进度追赶算法。服务器需根据 $Time_{now} - Time_{lastSync}$ 计算当前的实际理论进度并下发，避免重连后的设备进度严重滞后。
- **REQ-003**: 智能音频预加载。当前播放曲目剩余 15 秒且存在下一首曲目时，前端需在后台静默发起流媒体解析并预加载，实现 0 秒切歌。
- **REQ-004**: 密码传输安全校验。连线密码不能明文进行网络传输，需在前端哈希加密后发送，后端进行哈希对等比对。
- **REQ-005**: 极光波动水晶舱。液晶舱需内嵌根据 RTT 大小灵动过渡的渐变呼吸灯或流动微波形，提升浪漫视觉氛围。
- **CON-001**: 零占位符要求。代码修改必须是完整 drop-in，绝不能有残缺或 `// ...` 的代码。
- **CON-002**: 兼容性约束。密码哈希必须具备 Web Crypto API 到纯 JS 哈希函数的降级回退机制，确保非安全 HTTP 上下文（VPS 测试环境）兼容运行。

## 2. Implementation Steps

### Implementation Phase 1: 房间连线密码哈希安全防御

- GOAL-001: 移除全网明文密码校验，客户端哈希加密后传输，服务端进行密文校验。

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | 在前端 `MuseSyncPlayer.tsx` 编写 `hashPassword` 工具函数，内置加盐的哈希机制（优先 Web Crypto，若不支持则降级为加盐 Adler-32 或简易 Hash）。 | | |
| TASK-002 | 修改前端 `handleJoinRoom` 与 `join:room` 事件触发点，在向 Socket 发送 `password` 之前，先对其进行哈希计算。 | | |
| TASK-003 | 修改后端 `index.ts` 接收 `join:room` 事件逻辑，接收哈希密文并比对，且将内存中 `ExtendedRoomState` 里的 `password` 改为哈希密文存储。 | | |

### Implementation Phase 2: 弱网断线自愈与高精进度追赶

- GOAL-002: 实施跨境高延迟环境下的时间推移追赶，实现重连后的 0 手动操作自动对齐播放。

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | 修改后端 `index.ts` 的 `join:room` 成功事件下发的 `roomState`。在 `room.isPlaying === true` 时，通过公式 $position + (now - lastSyncAt)/1000$ 实时计算并下发最新的高精追赶进度值。 | | |
| TASK-005 | 重构前端 `MuseSyncPlayer.tsx` 中 Socket 的 `join:success` 回调。当收到追赶进度后，平滑 Seek 追赶，若落后超过 2 秒，则自动同步。 | | |

### Implementation Phase 3: 智能音频预缓冲预加载

- GOAL-003: 在前一首歌快结束时，静默缓存下一首歌曲，消除异地拉取音流的卡顿。

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | 在 `MuseSyncPlayer.tsx` 内新增 `prebufferAudioRef` 或使用静默后台 `Audio` 实体。 | | |
| TASK-007 | 编写并在 `handleTimeUpdate` 限流函数中插入逻辑：当距离歌曲结束小于 15 秒时，静默 `fetch` 下一首歌曲的流媒体代理链接并加载至预缓冲实体。 | | |
| TASK-008 | 重构 `selectTrack` 和 `switchTrack`，当切换到下一首且预缓冲实体已有对应 `audioUrl` 时，瞬间零延时秒开播放。 | | |

### Implementation Phase 4: 冰川舱延迟波形微动效 UI 升级

- GOAL-004: 在 TopBar 中央的水晶舱内加入极光呼吸微动效，动态呈现连接状态与延迟高低。

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | 修改 `TopBar.tsx` 中的水晶舱容器布局，内嵌一个灵动的时延流态呼吸指示圈。 | | |
| TASK-010 | 编写时延指示圈的颜色渐变控制器：`rtt < 50ms` 时为翡翠绿，`50-150ms` 时为冰川蓝，`>150ms` 时为极光粉，并带有微弱呼吸动画效果。 | | |

## 3. Alternatives

- **ALT-001**: 引入外部 Web Crypto Polyfill 库。我们决定放弃该方案，改为在代码中直接内置一个超轻量、纯 JS 的加盐哈希实现（如 Adler-32 或极简加盐循环移位哈希）作为降级，以避免打包体积臃肿和带来新 npm 依赖。
- **ALT-002**: 采用 Service Worker 代理全局网络缓存音轨。这会导致系统复杂度大幅上升且可能因为 Range 请求而导致浏览器兼容性问题。因此我们采用轻量、无侵入的前端后台 `Audio` 静默预缓冲方案。

## 4. Dependencies

- **DEP-001**: `socket.io-client` ^4.0.0 (现有依赖)
- **DEP-002**: `@sansenjian/qq-music-api` & `NeteaseCloudMusicApi` (后端现有服务依赖)

## 5. Files

- **FILE-001**: [MuseSyncPlayer.tsx](file:///c:/Users/windy03/Desktop/新webapp/apps/client/src/views/MuseSyncPlayer.tsx) (前端播放器控制核心)
- **FILE-002**: [TopBar.tsx](file:///c:/Users/windy03/Desktop/新webapp/apps/client/src/views/TopBar.tsx) (顶部“冰川液晶水晶舱”及房间成员展示)
- **FILE-003**: [index.ts](file:///c:/Users/windy03/Desktop/新webapp/apps/server/src/index.ts) (后端 Socket.io 房间状态与 API 穿透核心)

## 6. Testing

- **TEST-001**: 密码哈希完整性测试。用错误密码加入哈希房间，验证是否 100% 拦截并返回密码错误；使用正确密码验证是否成功握手。
- **TEST-002**: 网络断线自愈测试。利用 DevTools 的 `Offline` 断网 10 秒后恢复，验证客户端是否无须点击，自动追赶并对齐主端进度。
- **TEST-003**: 跨国预缓冲测试。验证歌曲最后 15 秒时网络面板是否静默发出下一首的 `/song/:id` 请求并缓存，以及自然切歌时是否秒开。
- **TEST-004**: 延时波动动效测试。通过更改网络限速（模拟 20ms、80ms、200ms RTT），观察水晶舱呼吸圈的颜色是否流畅渐变。

## 7. Risks & Assumptions

- **RISK-001**: 多端在拖拽进度（Seek）时如果同时掉线重连，可能会因为“时间推移追赶”而产生短暂的位置抖动。为此，我们在 Seek 触发后的 1.5 秒内设置短时间防重叠锁。
- **ASSUMPTION-001**: 假设用户的浏览器均支持标准的 HTML5 Audio 预加载属性。

## 8. Related Specifications / Further Reading

- [DESIGN.md](file:///c:/Users/windy03/Desktop/新webapp/DESIGN.md) (系统设计白皮书)
- [musesync_backend_spec.md](file:///c:/Users/windy03/Desktop/新webapp/musesync_backend_spec.md) (后端通信规范)
