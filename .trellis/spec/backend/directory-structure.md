# 目录结构

> 本文档说明当前后端目录的**真实组织方式**，并补充 hub / web / cli 分层重构期间的**目标目录设计、落位规则与迁移约束**。

---

## 概述

当前项目的后端相关代码并不是一个已经完全分层完成的整洁结构，而是由以下几类代码同时组成：

1. **仍在承担运行职责的历史入口 / 宿主入口**
2. **已经相对稳定的基础设施模块**
3. **尚未完全拆开的应用编排与领域规则聚合点**
4. **为了兼容现有交付方式而保留的 bridge / wrapper / boundary**

因此，理解本项目目录结构时，不能只看“现在文件放在哪”，还必须同时知道：

- 这个目录/文件当前扮演什么角色
- 它是不是 legacy / compat / temporary boundary
- 后续应该收敛到哪里
- 新代码现在应该落在哪一层

配套文档：

- `architecture-refactor-guidelines.md`：定义目标分层、迁移原则与禁止模式
- `legacy-map.md`：定义当前旧路径的目标归宿与删除条件
- `comment-governance.md`：定义高风险文件顶部注释、deprecated/compat 标注如何维护

---

## 当前结构：真实情况

当前后端核心目录仍以 **hub/src/** 为主，整体上接近“按功能分组”，但其中混有多个历史收口点。

```text
hub/src/
├── config/                 # 配置与密钥、运行设置
├── notifications/          # 通知分发与事件解析
├── push/                   # Web Push 通知实现
├── socket/                 # Socket.IO server / registry / handlers
│   └── handlers/cli/       # CLI transport handlers
├── sse/                    # SSE 连接管理
├── store/                  # SQLite store / schema / repository-like helpers
├── sync/                   # SyncEngine 与投影/同步相关逻辑
├── tunnel/                 # WireGuard 隧道相关实现
├── visibility/             # 会话可见性跟踪
├── web/                    # Hono server / middleware / routes / web asset hosting
├── configuration.ts        # 配置加载
└── index.ts                # 主启动入口
```

这套结构**仍然可用**，但不能把它误认为是最终目标结构。当前至少存在以下高风险聚合点：

- `hub/src/index.ts`：宿主入口 + composition root + delivery/bootstrap 入口
- `hub/src/web/server.ts`：HTTP adapter + web 资源托管 + relay/bundled 分支
- `hub/src/sync/syncEngine.ts`：应用层总门面 / God Service 收口点
- `hub/src/socket/handlers/cli/sessionHandlers.ts`：transport handler 中混有投影与派生状态逻辑
- `cli/src/commands/hub.ts`：CLI → Hub 的 legacy host bridge
- `cli/src/runner/run.ts`：runner 总控聚合点

结论：**当前目录可以继续维护，但旧聚合点只能收缩，不能继续膨胀。**

---

## 当前目录应如何理解

### 1. `index.ts` 不等于“随便放总控逻辑”

在本项目里，`hub/src/index.ts` 当前是：

- 启动入口
- 宿主接线点
- 历史兼容 bootstrap

它**不是**新增业务规则的容器。

允许：

- 启动编排
- 配置读取
- 依赖组装
- 兼容启动桥接

不允许：

- 新 domain rule
- 新 application policy
- 新 projection rule
- 新 transport contract 定义

### 2. `sync/` 当前不是纯“同步基础设施目录”

`hub/src/sync/` 当前混有：

- `SyncEngine` 这类应用层门面
- Todo / TeamState 等投影与派生状态逻辑
- 一些历史收口职责

因此修改 `sync/` 时，必须先判断：

- 这是 query/command 编排？
- 这是 projection？
- 这是领域规则？
- 这是 legacy facade？

不要因为文件现在位于 `sync/` 下，就默认继续把新逻辑加进去。

### 3. `web/server.ts` 当前是 adapter + hosting 混合体

`hub/src/web/server.ts` 目前既承担：

- Hono API adapter
- web 静态资源托管
- bundled / relay 模式分支

因此它当前仍是一个历史收口点。这里允许继续维护 API wiring 和交付兼容逻辑，但不应承载新的业务规则。

### 4. `socket/handlers/cli/` 是 transport 层，不是业务层

CLI socket handlers 当前已经出现“transport + projection 副作用”混合情况，尤其是 `sessionHandlers.ts`。

正确方向是：

- handler 只负责 parse / validate / access check / emit
- 业务判断进 application
- 投影更新进 projection dispatcher / projection service

新增功能时，不要把新的衍生逻辑继续堆到 handler 内。

### 5. `store/` 当前接近 infra，但尚未完全 ports 化

`hub/src/store/` 当前已经具备较强的基础设施特征，包含：

- schema / migration / db 初始化
- CRUD 操作
- 一部分 repository 风格封装

可以把它视为“正在向 infra/store 收敛的现实层”。

新增规则：

- 可以继续增强数据访问能力
- 不要把高层业务策略回灌到 store
- 后续如引入 port/repository abstraction，应以这里为底层实现承接点

---

## 目标目录结构（推荐落点）

后续分层重构的目标不是把所有代码一次性搬走，而是逐步形成更清晰的职责边界。

### Hub 目标结构

```text
hub/src/
├── host/                         # 宿主 / bootstrap / runtime 入口
│   ├── bootstrap/
│   ├── runtime/
│   └── wiring/
├── app/                          # 应用层：use case / command / query / orchestration
│   ├── session/
│   ├── machine/
│   ├── message/
│   ├── projection/
│   └── terminal/
├── domain/                       # 领域规则、纯模型、纯计算
│   ├── session/
│   ├── machine/
│   ├── message/
│   └── projection/
├── ports/                        # 抽象端口（repo / notifier / transport / runtime）
│   ├── store/
│   ├── notification/
│   ├── realtime/
│   └── runtime/
├── infra/                        # 基础设施适配器实现
│   ├── store/
│   ├── web/
│   ├── socket/
│   ├── sse/
│   ├── push/
│   ├── tunnel/
│   └── notification/
├── config/
└── shared/                       # 仅 hub 内部共享且无法稳定归属的薄共享件
```

### CLI 目标结构

```text
cli/src/
├── host/                         # CLI 宿主入口 / bootstrap
├── app/                          # runner/session/machine 编排
│   ├── runner/
│   ├── api/
│   └── session/
├── domain/                       # runner/agent 领域模型与规则
│   ├── runner/
│   └── agent/
├── infra/                        # flavor/runtime/hub client 等适配器
│   ├── agent/
│   ├── runtime/
│   └── hub/
└── commands/                     # 极薄命令入口
```

### Web 目标结构

Web 当前保持 FSD 风格即可，但应进一步明确共享契约与本地 view model 的边界：

```text
web/src/
├── shared/
│   └── api/                      # transport dto / mappers / client adapters
├── entities/
├── features/
├── widgets/
├── processes/
├── pages/
└── app/
```

关键约束：

- 跨 runtime DTO 优先进入 shared contract
- web 本地只保留 UI-specific type / mapper / view model
- `web/src/types/api.ts` 应逐步拆薄，避免继续成为混合边界容器

---

## 新代码应该放哪里

### 优先落位规则

#### 1. 宿主/启动相关

放到：

- `hub/src/host/*`
- `cli/src/host/*`

示例：

- 启动编排
- runtime 选择
- delivery mode bootstrap
- 进程级 wiring

#### 2. 应用编排 / use case / command / query

放到：

- `hub/src/app/<domain>/`
- `cli/src/app/<domain>/`

示例：

- `sendMessage`
- `renameSession`
- `spawnSession`
- `resumeSession`
- `applySessionConfig`
- projection dispatch orchestration

#### 3. 纯领域规则 / 纯计算

放到：

- `hub/src/domain/<domain>/`
- `cli/src/domain/<domain>/`

示例：

- TeamState 增量合并规则
- session 状态转换规则
- machine 状态推导
- 消息相关纯规则

#### 4. transport / http / socket / sse / push / db 实现

放到：

- `hub/src/infra/*`
- `cli/src/infra/*`
- `web/src/shared/api/*`

示例：

- Hono route adapter
- Socket.IO handler adapter
- SSE manager
- sqlite repository implementation
- push notification channel
- hub client

#### 5. 共享契约 / DTO

放到：

- `shared/src/*` 或 `@zs/protocol/types` 对应唯一来源

规则：

- 新增跨端字段，优先改 shared contract
- 不要在 web / cli / hub 各自复制一份 DTO

---

## Legacy / Compat 路径的目录规则

对于被认定为 legacy / compat / temporary boundary 的目录或文件，遵循以下规则：

### 允许

- 加结构注释
- 加委托逻辑
- 加薄包装
- 加兼容桥接
- 为迁移新落点补 glue code

### 不允许

- 新 domain rule
- 新 application policy
- 新 projection side effect
- 新 transport contract 副本
- 新的长期依赖入口
- 没有删除条件的 compat helper

### 判断标准

如果某个改动会让旧目录“更重要、更难删、更像最终归宿”，那它通常就是错误方向。

---

## 迁移期间的目录演进规则

### 原则 1：先有目标目录，再迁代码

不要直接把旧文件“拆碎”后散落到各处。先明确目标目录，再迁出职责。

推荐顺序：

1. 明确目标落点
2. 创建新 app/domain/infra/host 目录与薄入口
3. 迁移调用方或迁出职责
4. 将旧文件收敛为 facade / bridge
5. 满足删除条件后移除旧文件

### 原则 2：旧目录只减不增

以下位置在迁移期应视为**收缩区**：

- `hub/src/index.ts`
- `hub/src/sync/`
- `hub/src/web/server.ts`
- `hub/src/socket/handlers/cli/sessionHandlers.ts`
- `cli/src/commands/hub.ts`
- `cli/src/runner/run.ts`
- `web/src/types/api.ts`

对这些地方的新增改动，优先问自己：

- 是否能改为委托到新模块？
- 是否能先建立 app/domain/infra 新落点？
- 是否需要同时更新 legacy 注释与删除条件？

### 原则 3：新目录必须体现语义，不要空泛分组

避免创建没有职责边界的目录名，例如：

- `helpers/`
- `misc/`
- `common/`（除非它真的承载稳定共享抽象）
- `new/`
- `temp/`

推荐按职责语义命名，例如：

- `app/session/`
- `domain/projection/`
- `infra/socket/cli/`
- `host/runtime/`

---

## 与现有模块组织规则的关系

### Store 层模式仍然有效，但要放在更大的分层语境里理解

当前 `store/` 中“`*Store.ts` 负责 CRUD、其他文件负责业务封装”的现实模式仍然成立，这是现状约定。

但从重构角度看，后续应进一步区分：

- 纯数据库实现 → `infra/store/*`
- repository port / interface → `ports/store/*`
- 更高层 use case / orchestration → `app/*`

因此：

- 现有 store 模式可以继续维护
- 不应再把更高层业务判断塞进 store

### Socket handler 按客户端类型组织仍然有效，但职责要继续变薄

当前：

- `socket/handlers/cli/`
- `socket/handlers/terminal.ts`

这种按客户端类型组织方式仍然合理。

但职责边界需明确：

- transport parsing / ack / emit → handler
- command/query orchestration → app
- domain rule / projection calculation → domain 或 projection service

### 通知系统可以继续按功能聚合

`notifications/`、`push/`、`sse/` 目前作为基础设施/adapter 功能块继续存在是合理的。

后续如果细化：

- channel / adapter 实现可下沉到 `infra/notification/`
- dispatch 抽象可上提到 `ports/notification/` 或 app orchestration

---

## 修改相关目录时，其他开发者必须怎么做

### 修改高风险聚合点前

必须先读：

- `architecture-refactor-guidelines.md`
- `legacy-map.md`
- `comment-governance.md`

并先判断：

1. 当前文件是正式层，还是 legacy / compat / temporary boundary？
2. 这次改动是在迁出职责，还是在继续堆功能？
3. 是否应该把新逻辑放到 app/domain/infra/host，而不是旧文件？
4. 是否需要同步更新顶部注释、`@deprecated`、`REMOVE_AFTER:`、`MIGRATION_PHASE:`？

### 新增目录或新文件时

必须说明：

- 它属于哪一层
- 它为什么放在这里
- 它是否是过渡结构
- 如果是过渡结构，删除条件是什么

### 修改 shared contract / web-local type boundary 时

必须检查：

- 这是跨 runtime DTO 吗？
- 如果是，应该先改 `@zs/protocol/types` 吗？
- 当前 web/cli/hub 是否已经存在重复定义？
- 这次修改是否会让 boundary 文件继续膨胀？

---

## 反模式

### 不要

- ❌ 把 `hub/src/index.ts` 当成新的业务总控文件
- ❌ 继续向 `SyncEngine` 叠加新业务方法
- ❌ 在 `sessionHandlers.ts` 中继续加入新的投影/派生副作用
- ❌ 在 `web/src/types/api.ts` 中复制 shared DTO
- ❌ 在 `cli/src/commands/hub.ts` 中加入新的 hub 业务逻辑
- ❌ 新建没有删除条件的 compat 目录或 helper
- ❌ 为了“快一点”把 application/domain 逻辑塞回 adapter / host / handler

### 要

- ✅ 先判断层，再落代码
- ✅ 旧路径优先收缩为 facade / bridge
- ✅ 新功能优先放进 app/domain/infra/host 明确层级
- ✅ 跨端 DTO 保持唯一来源
- ✅ 修改高风险目录时同步维护注释与迁移状态
- ✅ 让目录结构帮助维护者理解代码角色，而不是掩盖历史债务

---

## 总结

本项目当前目录结构的核心事实是：**可运行，但仍处于架构收敛过程中**。

因此目录规范不能只回答“现在长什么样”，还必须回答：

- 哪些目录已经相对稳定
- 哪些文件只是历史收口点
- 新代码现在应该放哪里
- 旧路径应该如何收缩
- 什么时候可以删除 compat / legacy 结构

后续任何与 hub / web / cli 分层、领域解耦、兼容迁移相关的改动，都应把以下三份文档一起看：

- `architecture-refactor-guidelines.md`
- `legacy-map.md`
- `comment-governance.md`
