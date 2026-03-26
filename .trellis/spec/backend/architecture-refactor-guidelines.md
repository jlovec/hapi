# Hub / Web / CLI 分层与领域解耦重构指南

> **目的**：为本项目后续的 hub / web / cli 架构演进提供统一的目标图景、过渡方案、协作规范与旧代码退役规则。本文档既是重构设计基线，也是后续开发者修改相关功能时必须遵守的执行规范。

---

## 适用范围

当修改以下任一类型的代码时，必须阅读本指南：

- `hub/src/` 中涉及会话、机器、消息、RPC、Web API、Socket、SSE、terminal、push、tunnel 的代码
- `cli/src/` 中涉及 hub 连接、runner、session spawn/resume、terminal、agent flavor 的代码
- `web/src/` 中涉及 hub API、会话同步、terminal socket、跨层类型契约的代码
- `shared/src/` / `@zs/protocol` 中涉及跨端共享类型、事件契约、RPC 契约的代码

---

## 当前架构现状（代码事实）

### 1. Hub 是当前的超级组合根

当前 `hub/src/index.ts` 同时负责：

- 配置加载
- Store 初始化
- JWT / VAPID 初始化
- Socket.IO 服务启动
- SSE 管理
- NotificationHub 启动
- Tunnel 启动
- Web Server 启动
- 对外打印公共访问地址与二维码

这意味着：**宿主启动、应用编排、基础设施接线、交付模式逻辑尚未彻底分层**。

### 2. SyncEngine 是当前的应用层门面，但职责过大

当前 `hub/src/sync/syncEngine.ts` 同时承担：

- session / machine / message 查询
- session command
- spawn / resume
- config apply
- permission / terminal / git / file 相关 RPC 转发

这意味着：`SyncEngine` 目前是**可用的收口点**，但不是最终理想边界。

### 3. Transport handler 混入了领域投影逻辑

当前 `hub/src/socket/handlers/cli/sessionHandlers.ts` 在处理 message 时，同时做了：

- payload 解析
- session access 校验
- message 落库
- Todo 投影
- TeamState 投影
- realtime update emit

这意味着：**消息接收、领域副作用、投影更新、对外广播** 还没有彻底分开。

### 4. CLI 与 Hub 存在宿主耦合

当前 `cli/src/commands/hub.ts` 直接 import `hub/src/index` 启动 hub。

这意味着：CLI 不只是 hub client，也承担了 hub host 的职责；该模式适合作为当前交付方式，但不应继续扩散为架构默认。

### 5. Hub 与 Web 存在构建/托管耦合

当前 `hub/src/web/server.ts` 会：

- 查找 `web/dist`
- 在编译模式下加载 embedded assets
- 非 relay 模式时直接托管前端资源

这意味着：当前“Hub 服务 + Web 托管 + All-in-one 打包”是交织在一起的交付模型。

### 6. Web 契约层尚未完全统一

当前 `web/src/types/api.ts` 一部分复用 `@zs/protocol/types`，另一部分保留本地 API / Runner / Response 类型。

这意味着：当前 transport contract 与 UI view model 尚未完全分层。

---

## 目标架构（最终图景）

目标不是大重写，而是让架构稳定收敛到以下边界：

```text
Contracts
  ↓
Domain
  ↓
Application
  ↓
Infrastructure / Adapters
  ↓
Host / Bootstrap
```

### 1. Contracts 层

统一定义所有跨边界契约：

- HTTP API DTO
- Socket event payload
- RPC request / response
- Session / Machine / Message 共享类型
- 版本兼容约束

**规则**：
- 跨进程 / 跨包 / 跨 runtime 的数据结构，必须有唯一来源
- UI 专属 view model 可以本地存在，但 transport DTO 不允许重复定义

### 2. Domain 层

只放领域模型与规则，不放 Hono / Socket.IO / Bun / CLI 宿主逻辑。

建议领域边界：

- Session Domain
- Machine Domain
- Message Domain
- Projection Domain
- Agent Flavor Domain
- Terminal Domain

### 3. Application 层

放用例编排，不直接暴露底层协议细节。

建议服务：

- `SessionCommands`
- `SessionQueries`
- `SessionResumeService`
- `MachineQueries`
- `MachineLivenessService`
- `MessageCommands`
- `MessageQueries`
- `ProjectionDispatcher`
- `TerminalCommands`

### 4. Infrastructure / Adapters 层

负责具体实现：

- SQLite repository
- Hono routes
- Socket handlers
- SSE publisher
- Push adapter
- Tunnel adapter
- CLI runtime / process / worktree adapter

### 5. Host / Bootstrap 层

只负责组合，不承载业务规则：

- hub host
- cli host
- bundled / all-in-one host
- web hosting adapter

---

## 重构总策略（推荐）

本项目后续必须采用以下顺序推进：

### 推荐主线

**契约优先 → 分层收口 → 领域拆分 → 宿主解耦 → 旧代码退役**

### 为什么这样排

1. **先稳契约**，避免 hub / web / cli 三端边改边漂移
2. **再瘦应用层**，让 `SyncEngine` 从 God Service 退化为 facade
3. **再做领域边界**，避免“看似分模块，实则还是传球式耦合”
4. **最后处理宿主解耦**，因为这一步对打包和交付冲击最大

### 明确不推荐的顺序

- 不要先按目录大搬家
- 不要一开始就删 `SyncEngine`
- 不要先拆 all-in-one / CLI-hosted hub
- 不要在契约未稳定时同时做大规模领域拆分

---

## 分阶段过渡方案

### Phase 0：冻结与标注

目标：先止血，不继续让旧层恶化。

要求：

- 给旧入口、兼容桥接、legacy host 增加明确注释
- 建立旧目录 → 新目标目录的映射表
- 明确“新代码禁止继续堆入旧层”的规则

### Phase 1：契约收敛（不改行为）

目标：统一 API / RPC / realtime contract。

要求：

- web 不再新增本地 transport DTO
- hub / cli / web 对共享契约只认一个来源
- 新增边界字段时，先改 shared contract，再改三端消费

### Phase 2：应用层收口

目标：让 `SyncEngine` 退化为委托门面。

要求：

- 复杂逻辑先迁入 app service
- route / socket handler 先保留旧入口，但内部转发到 app service
- `SyncEngine` 只做编排，不继续吸纳新业务逻辑

### Phase 3：投影剥离

目标：把 Todo / TeamState / future summary 之类副作用从 transport handler 中拆出。

要求：

- message append 与 projection update 分离
- projection 基于事件触发，不直接塞在 handler 中

### Phase 4：领域拆分

目标：形成清晰的 Session / Machine / Message / Projection / Flavor / Terminal 领域边界。

要求：

- 不允许跨领域偷写状态规则
- 跨领域协作经由 app service，而不是直接互相调用 infra

### Phase 5：宿主解耦

目标：把 CLI-hosted hub、hub-served web 收敛为交付适配，而非默认架构。

要求：

- Hub 作为独立服务核心存在
- CLI 作为命令宿主存在
- All-in-one 只作为交付模式存在

### Phase 6：旧代码清理

目标：删除兼容层、旧导出、临时桥接。

要求：

- deprecated 项必须有删除条件
- 旧目录冻结后不得长期双轨并存

---

## 目标目录设计

以下是推荐的目标目录图景，不要求一次性到位：

### Hub

```text
hub/src/
  host/
  app/
    session/
    machine/
    message/
    projection/
    terminal/
  domain/
    session/
    machine/
    message/
    projection/
    terminal/
    flavor/
  ports/
    repositories/
    rpc/
    events/
  infra/
    store/
    web/
    socket/
    sse/
    push/
    tunnel/
```

### CLI

```text
cli/src/
  host/
  commands/
  app/
    runner/
    api/
    terminal/
  domain/
    runner/
    agent/
  ports/
    hub/
    runtime/
  infra/
    hub/
    runtime/
    agent/
```

### Web

Web 保持 FSD 组织为主，但要明确 contract / view model / UI model 三层边界：

```text
web/src/
  app/
  processes/
  pages/
  widgets/
  features/
  entities/
  shared/
    api/
      contracts/
      dto/
      mappers/
```

---

## 其他开发者修改相关功能时必须怎么做

以下规则是强制性的。

### 1. 修改前必须先判定“这是哪一层的问题”

在动手前必须先回答：

- 这是 contract 问题？
- 这是 application 编排问题？
- 这是 domain rule 问题？
- 这是 infrastructure adapter 问题？
- 这是 host / bootstrap / packaging 问题？

**禁止**：不判断层次，直接在最容易改的地方补丁。

### 2. 修改跨 hub / web / cli 的功能时，必须先检查契约唯一来源

如果涉及：

- API response/request
- socket event payload
- rpc request/response
- shared session/machine/message metadata

则必须先检查：

- 是否已经在 shared contract 中定义
- web 是否在本地重复定义了同义类型
- cli / hub 是否使用了字符串拼装契约而不是共享定义

**禁止**：在 web / cli / hub 任一侧临时复制一份 transport 类型。

### 3. 修改 `SyncEngine` 时必须遵守“只减不增”原则

对于 `hub/src/sync/syncEngine.ts`：

- 可以迁出职责
- 可以改成委托
- 可以加 facade 级拼装
- **不可以继续往里堆新的业务规则**

任何新增复杂逻辑，应优先落到新的 app service。

### 4. 修改 socket / route handler 时必须保持 handler 变薄

`handler` 的职责应尽量限于：

- parse / validate
- access check
- call app service
- map response / emit transport event

**禁止**：
- 在 handler 内直接加入投影更新
- 在 handler 内埋复杂业务判断
- 在 handler 内堆 flavor-specific policy

### 5. 修改 message ingest / session sync 时必须检查是否把领域副作用塞回 transport

如果改动涉及：

- `sessionHandlers`
- message append
- session-updated event
- todo/team state/summaries derived state

必须问：

- 这是 message domain 的事实更新？
- 还是 projection domain 的派生更新？
- 是否应该通过 projection dispatcher 完成，而不是直接写在 handler 里？

### 6. 修改 CLI 的 `hub` 命令或 Hub 启动逻辑时，必须明确自己是在改“临时宿主桥接”还是“目标架构”

对 `cli/src/commands/hub.ts`、`hub/src/index.ts` 这类文件：

- 若只是为了兼容当前 all-in-one 交付，可保留 legacy host 角色
- 但必须注释清楚它是 **legacy host / compatibility host**
- **禁止** 在这些文件继续加入新的业务逻辑

### 7. 修改 Web API 类型时必须明确区分三类模型

- shared transport contract
- local mapped DTO
- UI view model

**禁止**：把 UI 层需要的字段加工直接反向污染 shared transport type。

### 8. 每次修改高风险区域，都必须补充注释或更新迁移备注

高风险区域包括：

- `hub/src/index.ts`
- `hub/src/sync/syncEngine.ts`
- `hub/src/web/server.ts`
- `hub/src/socket/handlers/cli/sessionHandlers.ts`
- `cli/src/commands/hub.ts`
- `web/src/types/api.ts`

如果行为边界、职责边界、迁移状态发生变化，必须同步更新注释。

---

## 旧函数 / 旧入口 / 兼容桥接清理规则

### 1. 旧代码分类

#### A. 兼容转发函数

特点：老函数内部只调用新 service。

处理规则：
- 允许短期保留
- 必须加 `@deprecated`
- 必须写明替代路径与删除条件

#### B. 旧聚合门面

特点：例如历史膨胀后的 `SyncEngine` public methods。

处理规则：
- 先内部委托
- 再减少外部调用面
- 最后删除 public surface

#### C. 旧宿主入口

特点：CLI-hosted hub、legacy all-in-one bootstrap。

处理规则：
- 允许过渡期存在
- 必须标记为 legacy host
- 不允许继续添加新业务逻辑

#### D. 临时 mapper / helper / compat glue

特点：迁移期间产生的桥接函数。

处理规则：
- 必须记录调用方
- 调用数收敛到 0 后立即删除
- 不允许长期无 owner 漂浮

### 2. 删除条件必须写清楚

所有 deprecated / legacy bridge 必须至少包含：

- 为什么还保留
- 替代实现在哪里
- 哪些调用方还未迁走
- 满足什么条件后删除

---

## 注释与标注规范

### 1. 何时必须加注释

以下情况必须加结构性注释，而不是只写函数名：

- 兼容桥接层
- legacy host
- deprecated public API
- 迁移中目录
- 容易被继续堆逻辑的大文件入口

### 2. 推荐格式

#### Deprecated 函数

```ts
/**
 * @deprecated use SessionCommands.renameSession instead.
 * 该函数仅作为旧调用方的兼容桥接。
 * 删除条件：所有 route / socket 调用方完成迁移。
 */
```

#### Legacy Host

```ts
/**
 * Legacy host entry for current bundled/all-in-one delivery path.
 * 不要在这里新增业务逻辑；这里只允许保留宿主接线与兼容启动流程。
 */
```

#### Compatibility Bridge

```ts
/**
 * Compatibility bridge during layering migration.
 * 目的：兼容旧入口，转发到新应用层服务。
 * 删除条件：旧调用方全部迁移完成。
 */
```

### 3. 推荐标签

统一使用：

- `@deprecated`
- `TODO(refactor)`
- `NOTE(layering)`
- `NOTE(compat)`
- `REMOVE_AFTER:`
- `MIGRATION_PHASE:`

**禁止**：随意发明含义模糊的标签，导致后续无法搜索与收敛。

---

## 注释更新范围要求

当修改以下文件时，除了改代码，还要检查顶部注释是否仍准确：

- `hub/src/index.ts`
- `hub/src/web/server.ts`
- `hub/src/sync/syncEngine.ts`
- `hub/src/socket/handlers/cli/sessionHandlers.ts`
- `cli/src/commands/hub.ts`
- `web/src/types/api.ts`

如果注释与当前职责不一致，必须在同一变更中一起更新。

### 特别提醒

- 顶部注释不能再把明显的 legacy / bridge 文件写成“最终架构核心”
- 如果一个文件当前只是过渡层，要明确写出来
- 如果一个文件未来应该变薄，要在注释中限制新增职责范围

---

## 禁止模式

- ❌ 在 web / hub / cli 任一侧重复定义 transport contract
- ❌ 在 `SyncEngine` 中继续堆新业务逻辑
- ❌ 在 route / socket handler 中继续堆投影副作用
- ❌ 在 legacy host / compatibility entry 中新增业务逻辑
- ❌ 为了快修 bug，把 domain rule 临时塞回 transport 层
- ❌ 新旧双轨长期共存但没有删除条件
- ❌ 写了 deprecated 但没有替代路径与删除条件

---

## 推荐动作清单

当你准备修改 hub / web / cli 相关功能时，按下面流程：

1. 先判定改动属于哪一层
2. 搜索相关 contract、handler、service、view model 是否已存在
3. 如果跨端，先确认 shared contract 是否需要更新
4. 如果涉及 `SyncEngine` / handler，先判断能否迁到 app service
5. 如果涉及旧入口或 compat bridge，先补注释再改逻辑
6. 改完后同步更新：
   - 结构注释
   - deprecated / legacy 标注
   - 相关 spec 文档

---

## 与其他规范的关系

- 当功能跨越 hub / web / cli 时，同时阅读：
  - `guides/cross-layer-thinking-guide.md`
- 当修改 backend 目录布局或新增模块时，同时阅读：
  - `backend/directory-structure.md`
- 当修改测试时，同时阅读：
  - `spec/unit-test/index.md`

---

## 总结

本项目的架构演进原则不是“大重写”，而是：

**先稳契约，再瘦层次，再拆领域，最后拆宿主。**

任何开发者在修改相关功能时，都必须：

- 保持契约唯一来源
- 把复杂度从旧层迁出，而不是继续堆入
- 明确 legacy / compat / deprecated 的删除条件
- 同步维护注释与规范文档

这比“代码暂时能跑”更重要，因为本项目当前最大的风险不是单点 bug，而是**边界继续失控**。
