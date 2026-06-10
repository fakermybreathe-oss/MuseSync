---
goal: 独立搜索结果面板、登录态持久化及多版权无感降级机制
version: 1.0
date_created: 2026-05-31
status: 'Planned'
tags: [feature, architecture]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

本计划旨在重构前端的搜索展示逻辑（将搜索与收藏歌单分离，保持平台独立展示）、加入登录态持久化，并在后端建立完善的多版权无感降级服务（NetEase 播放受限时静默回退至 QQ）。

## 1. Requirements & Constraints

- **REQ-001**: 前端需新增独立的 `SearchResultsPanel`，将搜索结果与个人的“收藏歌单”在 UI 上严格隔离。
- **REQ-002**: 搜索结果**不合并**。网易云和 QQ 音乐的搜索结果应独立展示，遵循用户在 `SearchBox` 选择的平台。
- **REQ-003**: 搜索并试听搜索结果时，不需要强制用户处于已登录状态。
- **REQ-004**: 前端需利用 `localStorage` 持久化保存网易云与 QQ 的登录凭证（`Auth` 状态），避免刷新页面后重复登录。
- **REQ-005**: 后端需抽象 `musicService.ts`，内置多版权降级逻辑。
- **REQ-006**: 降级逻辑必须带有严密的标题和歌手匹配打分机制，严禁错误回退到 "Live"、"伴奏" 等非标准音轨。

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: 抽象并实现后端 `musicService` 及多版权降级打分机制

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | 创建 `apps/server/src/services/musicService.ts` 文件。 | | |
| TASK-002 | 在 `musicService.ts` 中实现 `scoreTrackMatch(targetTitle, targetArtist, candidate)` 打分算法。 | | |
| TASK-003 | 在 `musicService.ts` 中实现 `resolveNeteaseWithFallback(id)` 核心降级逻辑。 | | |
| TASK-004 | 修改 `apps/server/src/index.ts` 中 `/api/netease/song/:id` 路由以接入 `resolveNeteaseWithFallback`。 | | |

### Implementation Phase 2

- GOAL-002: 前端搜索分离与登录持久化

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | 创建 `apps/client/src/views/SearchResultsPanel.tsx`，专门用于展示独立平台的搜索结果，不含登录拦截。 | | |
| TASK-006 | 修改 `apps/client/src/views/MuseSyncPlayer.tsx`，在 `useEffect` 中读取 `localStorage` 以恢复登录态。 | | |
| TASK-007 | 修改 `MuseSyncPlayer.tsx`，在更新 Auth 状态时同步写入 `localStorage`。 | | |
| TASK-008 | 修改 `MuseSyncPlayer.tsx` 的 `handleSearch` 函数，将结果写入 `searchResults` 并唤出 `SearchResultsPanel`，而不是原有的 `PlaylistPanel`。 | | |
| TASK-009 | 确认 `SearchBox` 中的网易云和 QQ 切换器继续决定当前搜索针对哪一个独立的库。 | | |

## 3. Alternatives

- **ALT-001**: 曾考虑实现“双轨合并全网搜索”，但根据用户明确反馈被否决。当前决定保留原有的单库平台独立搜索。

## 4. Dependencies

- **DEP-001**: 依赖后端的 `qq-music-api` 和 `NeteaseCloudMusicApi` 现存实例来进行交叉搜索。

## 5. Files

- **FILE-001**: `apps/server/src/services/musicService.ts` (NEW)
- **FILE-002**: `apps/server/src/index.ts` (MODIFY)
- **FILE-003**: `apps/client/src/views/SearchResultsPanel.tsx` (NEW)
- **FILE-004**: `apps/client/src/views/MuseSyncPlayer.tsx` (MODIFY)
- **FILE-005**: `apps/client/src/views/PlaylistPanel.tsx` (MODIFY)

## 6. Testing

- **TEST-001**: 测试网易云平台搜索“陈奕迅”，确保只展示网易云库的结果，不弹登录拦截，且弹出的是专门的 SearchResultsPanel。
- **TEST-002**: 测试播放一首需要 VIP 的网易云歌曲，确保播放未失败并触发了对 QQ 音乐的 Fallback 调用。
- **TEST-003**: F5 刷新页面后，确认已登录状态（如头像、昵称）被成功恢复。

## 7. Risks & Assumptions

- **RISK-001**: QQ 音乐的二次模糊搜索若未能命中正确音轨，依然会导致最终播放失败。此风险通过精确的打分机制 (`scoreTrackMatch`) 来最小化。
- **ASSUMPTION-001**: 假设用户的 `localStorage` 没有被浏览器策略强制清空。

## 8. Related Specifications / Further Reading

- [MuseSync Backend Spec](file:///c:/Users/windy03/Desktop/%E6%96%B0webapp/musesync_backend_spec.md)
