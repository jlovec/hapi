# Hub / Web / CLI Legacy Map（旧结构 → 目标结构映射）

> **目的**：明确当前 hub / web / cli 中的关键旧入口、过渡层、兼容桥接与目标归宿，帮助后续开发者在改代码时知道：哪些文件是历史收口点、哪些文件只能继续收缩、哪些文件是未来目标落点，以及每一类旧路径的删除条件。

> 本文档与 `architecture-refactor-guidelines.md` 配套使用。前者回答“应该往哪里去”，本文档回答“现在的东西分别将去哪里、什么时候能删”。

---

## 使用方式

当你准备修改以下高风险文件时，必须先查本表：

- `hub/src/index.ts`
- `hub/src/sync/syncEngine.ts`
- `hub/src/web/server.ts`
- `hub/src/socket/handlers/cli/sessionHandlers.ts`
- `cli/src/commands/hub.ts`
- `cli/src/runner/run.ts`
- `web/src/types/api.ts`

读取顺序：

1. 先看 `当前角色`
2. 再看 `目标归宿`
3. 再看 `当前允许的修改`
4. 最后看 `删除/收敛条件`

如果你的改动方式与本表冲突，以本表为准；如需偏离，先更新规范文档，再改代码。

---

## 映射总原则

### 原则 1：旧层只允许收缩，不允许继续膨胀

对任何被标记为 legacy / compat / temporary boundary 的文件：

- 可以迁出职责
- 可以补注释
- 可以加桥接
- **不允许继续堆新的业务规则**

### 原则 2：先建立新归宿，再迁调用方，最后删旧路径

统一顺序：

1. 明确目标位置
2. 建新 service / port / adapter / contract
3. 迁移调用方
4. 冻结旧路径
5. 删除旧路径

### 原则 3：任何旧路径都必须有收敛条件

不允许出现“以后再说”的兼容层。

---

## Hub 映射

| 当前路径 | 当前角色 | 目标归宿 | 当前允许的修改 | 删除/收敛条件 |
|---|---|---|---|---|
| `hub/src/index.ts` | Hub 运行时主入口 + legacy composition root + delivery/bootstrap entry | `hub/src/host/` 下的 host/bootstrap/runtime 拆分 | 允许补接线、注释、轻量 host 逻辑；**禁止新增 domain/app 规则** | 当启动编排、交付模式判断、基础设施接线已迁入 `host/` 分层模块后，主入口应只保留极薄 bootstrap |
| `hub/src/sync/syncEngine.ts` | 当前应用层总门面 / God Service 收口点 | `hub/src/app/session/*`、`machine/*`、`message/*`、`projection/*`、`terminal/*` | 允许改为委托/编排；**禁止继续塞新业务规则** | 当 route/socket 不再依赖胖方法，且复杂逻辑已迁入 app service 后，`SyncEngine` 应退化为 facade 或被替换 |
| `hub/src/web/server.ts` | Hono web adapter + web asset hosting adapter + relay mode hosting branch | `hub/src/infra/web/` + `hub/src/host/runtime/` | 允许保留 API wiring 与资产托管兼容逻辑；**禁止加入业务规则** | 当 web 托管逻辑与 API 组装拆开后，server.ts 仅保留 adapter 角色 |
| `hub/src/socket/handlers/cli/sessionHandlers.ts` | CLI session transport handler，当前混有 message ingest + projection side effects | `hub/src/infra/socket/cli/` + `hub/src/app/message/*` + `hub/src/app/projection/*` | 允许 parse/validate/access check/emit；**禁止新增投影或领域副作用** | 当 Todo / TeamState / future projections 全部走 app/projection dispatcher 后，handler 仅保留 transport 责任 |
| `hub/src/socket/handlers/cli/machineHandlers.ts` | CLI machine transport handler | `hub/src/infra/socket/cli/` + `hub/src/app/machine/*` | 允许薄 handler 化 | 当 machine 业务判断迁出后，handler 仅保留 transport 层职责 |
| `hub/src/socket/handlers/cli/terminalHandlers.ts` | terminal transport handler | `hub/src/infra/socket/terminal/` + `hub/src/app/terminal/*` | 允许 transport 接线；避免扩大 terminal policy | terminal 会话规则迁入 app/domain 后，handler 只保留连接与协议转换 |
| `hub/src/store/index.ts` | Store 初始化 + schema/migration 组合根 | `hub/src/infra/store/sqlite/` | 允许维持 SQLite 入口；避免注入高层业务逻辑 | 当 repository port 明确后，store/index.ts 应收敛为 infra 入口 |
| `hub/src/sync/todos.ts` | 从消息内容派生 Todo 的投影逻辑 | `hub/src/app/projection/sessionTodoProjection.ts` | 允许保留纯投影逻辑；不要反向耦合 transport | 当 projection dispatcher 建立后，作为 projection 实现保留或迁移 |
| `hub/src/sync/teams.ts` | TeamState 派生/增量应用 | `hub/src/app/projection/teamStateProjection.ts` / `hub/src/domain/projection/` | 允许纯投影和纯规则；不要扩展 transport 依赖 | 当 TeamState 完成 domain/projection 边界拆分后，原 sync 路径收敛或迁移 |

---

## CLI 映射

| 当前路径 | 当前角色 | 目标归宿 | 当前允许的修改 | 删除/收敛条件 |
|---|---|---|---|---|
| `cli/src/commands/hub.ts` | CLI → Hub legacy host bridge | `cli/src/host/` 或独立 host bootstrap | 只允许命令解析与启动桥接；**禁止新增 hub 业务逻辑** | 当 CLI 不再直接 import hub 源码时，该文件应被移除或退化为 host wrapper |
| `cli/src/runner/run.ts` | Runner 总控入口，混合 runner lifecycle、spawn/resume、worktree、agent flavor、auth/setup 等 | `cli/src/app/runner/*` + `cli/src/domain/runner/*` + `cli/src/infra/runtime/*` + `cli/src/infra/agent/*` | 允许拆函数、分层委托；**禁止继续集中膨胀** | 当 spawn/resume/runner lifecycle/worktree/agent-specific 行为分离完成后，run.ts 应收敛为 orchestrator |
| `cli/src/api/apiSession.ts` | session 侧 hub client + realtime/session rpc glue | `cli/src/app/api/` + `cli/src/infra/hub/http|socket/` | 允许 client 层细化；避免掺入业务策略 | 当 shared rpc/api contracts 收敛后，该路径只保留 client 实现 |
| `cli/src/api/apiMachine.ts` | machine 侧 hub client + runner rpc glue | `cli/src/app/api/` + `cli/src/infra/hub/http|socket/` | 允许 client 实现细分；避免侵入 runner policy | 当 machine commands/queries 契约稳定后，只保留 infra client 职责 |
| `cli/src/runner/worktree.ts` | runtime worktree adapter | `cli/src/infra/runtime/worktree/` | 可以增强适配能力；避免混入 session business policy | 当 runtime adapter 分层完成后迁移 |
| `cli/src/claude/*`、`cli/src/codex/*` 等 agent 目录 | flavor-specific integration | `cli/src/infra/agent/<flavor>/` + `cli/src/domain/agent/*` | 允许 flavor 内实现细化；避免把 flavor rule 散落到 runner 总控 | 当 AgentCapability / LaunchAdapter 稳定后统一归位 |

---

## Web 映射

| 当前路径 | 当前角色 | 目标归宿 | 当前允许的修改 | 删除/收敛条件 |
|---|---|---|---|---|
| `web/src/types/api.ts` | shared transport contract 与 web-local view/model 的临时边界 | shared contract + `web/src/shared/api/dto|mappers/` | 允许保留 UI-specific 衍生类型；**禁止继续重复定义跨 runtime DTO** | 当 shared contract 收敛、web 只保留 view model 时，该文件应被拆薄或拆散 |
| `web/src/hooks/useTerminalSocket.ts` | terminal websocket client hook | `web/src/shared/api/terminal/` + `entities/terminal` | 允许保留 UI hook 角色；避免塞入 terminal domain policy | 当 terminal adapter/view model 分层完成后收敛 |
| `web/src/hooks/useSSE.ts` | SSE transport client | `web/src/shared/api/realtime/` | 允许保留 transport hook；避免混入 session business decision | 当 session sync process 独立后，hook 只负责 transport |
| `web/src/processes/*` | 过程编排层 | 保持 FSD process 层 | 允许继续作为 orchestration 层 | 不是 legacy，重点是不要反向承担底层 transport contract 定义 |

---

## Shared Contract 映射

| 当前路径 | 当前角色 | 目标归宿 | 当前允许的修改 | 删除/收敛条件 |
|---|---|---|---|---|
| `shared/src/messages.ts` | 消息/会话相关共享协议定义 | `shared/src/contracts/` + `shared/src/domain/` | 允许继续演进共享契约 | 当 contracts/domain 分层更清晰时迁移文件位置，但不能打破唯一来源原则 |
| `shared/src/socket.ts` | realtime/socket 共享契约 | `shared/src/contracts/realtime/` | 允许继续作为唯一来源 | 当 realtime contract 模块化完成后迁移文件位置 |
| `@zs/protocol/types` | 当前最主要的 shared type 出口 | 继续作为 shared 唯一来源，或演进到更清晰的 contracts 分层 | 可扩展，不允许被旁路复制 | 只有当新 shared package 完整替代后才允许迁移出口 |

---

## 需要重点收敛的旧职责聚合点

以下不是“马上删除”，而是“后续不能继续加码”的聚合点：

### 1. `SyncEngine`

现状：
- 兼做 query、command、rpc bridge、spawn/resume、config apply

后续规则：
- 新功能优先落 app service
- `SyncEngine` 只负责委托/编排
- 如果不得不在这里临时加桥接，必须写注释说明目标迁移点

### 2. `cli/src/runner/run.ts`

现状：
- 兼做 runner lifecycle、spawn session、agent-specific handling、worktree、state persistence

后续规则：
- 新逻辑优先拆到 runner 子模块、agent adapter、runtime adapter
- 不允许把新的 flavor-specific policy 继续堆到总控文件

### 3. `hub/src/socket/handlers/cli/sessionHandlers.ts`

现状：
- 兼做 ingest、投影、副作用广播

后续规则：
- 只允许越来越薄
- 一切新增派生逻辑都应优先进 projection dispatcher

### 4. `web/src/types/api.ts`

现状：
- 兼做 shared DTO 再导出与 local model 容器

后续规则：
- 新增跨端字段必须先进 shared contract
- 这里只保留 web 本地映射和 UI-specific 类型

---

## Legacy / Compat 文件允许写什么、不允许写什么

### 允许写

- 迁移注释
- 委托逻辑
- 薄包装
- 兼容桥接
- 为了删除旧路径而加的过渡层

### 不允许写

- 新 domain rule
- 新 projection side effect
- 新 transport contract 定义副本
- 新的打包/宿主耦合扩散
- 没有删除条件的 compat helper

---

## 删除条件模板

当你在旧路径保留 compat / legacy bridge 时，必须至少写明：

```ts
/**
 * NOTE(compat): why this still exists
 * REMOVE_AFTER:
 * - condition A
 * - condition B
 */
```

推荐删除条件写法：

- `all route handlers migrated to SessionCommands`
- `CLI no longer imports hub/src/index directly`
- `Todo/TeamState projections moved behind dispatcher`
- `web transport DTO fully sourced from shared contracts`

---

## 修改前快速检查表

在改高风险旧路径前，先过一遍：

- [ ] 我知道这个文件当前是 legacy / compat / temporary boundary 还是正式目标层吗？
- [ ] 我知道它的目标归宿在哪里吗？
- [ ] 我这次是在“迁出职责”，还是在“继续堆功能”？
- [ ] 我是否需要同步更新注释和删除条件？
- [ ] 我的修改是否会让未来迁移更难？

如果最后一个问题回答为“会”，暂停修改，先调整方案。

---

## 总结

Legacy Map 的作用不是催促一次性删旧代码，而是确保整个团队对这些问题有统一认知：

- 哪些是历史收口点
- 哪些是过渡层
- 哪些只能继续收缩
- 哪些是未来真正归宿
- 每条旧路径何时可以删

后续所有与 hub / web / cli 分层、领域解耦相关的修改，都应同时参考：

- `backend/architecture-refactor-guidelines.md`
- `backend/legacy-map.md`
- `guides/cross-layer-thinking-guide.md`
