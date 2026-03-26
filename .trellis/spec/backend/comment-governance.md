# 注释治理清单（分层 / Legacy / Compat / Deprecated）

> **目的**：统一本项目与架构演进相关的注释治理方式，明确哪些文件的结构注释必须维护、什么时候必须更新、deprecated/compat/legacy 注释应该怎么写、如何收敛以及如何审查。

> 本文档不是一般代码注释风格指南；它专门面向 hub / web / cli 分层、领域解耦、宿主桥接、兼容过渡、旧路径退役等高风险区域。

---

## 适用范围

以下情况必须遵守本清单：

- 修改 legacy host / bootstrap 文件
- 修改 compatibility bridge / 兼容转发函数
- 修改 deprecated public API
- 修改高风险聚合文件（如 `SyncEngine`、runner 总控、transport handler）
- 修改 shared contract 与 web-local boundary 文件
- 引入新的过渡层、临时 adapter、迁移辅助函数

---

## 注释治理目标

本清单的目标不是“让代码注释更多”，而是确保：

1. **后续开发者能判断当前文件是什么角色**
2. **高风险过渡层不会继续 silently 膨胀**
3. **deprecated / compat 路径都有删除条件**
4. **文档与代码的迁移状态保持一致**
5. **搜索 `NOTE(layering)` / `NOTE(compat)` / `@deprecated` 时能形成有效盘点**

---

## 哪些文件必须维护结构性注释

以下文件类型必须维护结构性注释，而不是只依赖函数名或目录名表达意图：

### 1. Legacy Host / Bootstrap

例如：

- `hub/src/index.ts`
- `cli/src/commands/hub.ts`
- 未来任何 bundled / all-in-one 启动入口

必须说明：

- 当前是宿主入口还是核心逻辑入口
- 为什么仍然保留在这里
- 这里允许写什么 / 不允许写什么

### 2. 高风险聚合文件

例如：

- `hub/src/sync/syncEngine.ts`
- `cli/src/runner/run.ts`
- `hub/src/socket/handlers/cli/sessionHandlers.ts`

必须说明：

- 当前承担哪些职责
- 哪些职责只是暂时还没迁走
- 后续应往哪个方向收敛

### 3. Shared Contract 与 Local Boundary 文件

例如：

- `web/src/types/api.ts`
- shared contract 的边界出口文件

必须说明：

- 哪些是共享契约
- 哪些是本地 UI / view model
- 哪些内容不应继续在本文件膨胀

### 4. Compat Bridge / 过渡层

任何迁移期间新增的桥接函数、适配器、wrapper、兼容入口，都必须有明确注释。

---

## 什么时候必须更新注释

以下情况中，注释必须与代码同一变更提交更新：

### 1. 文件职责发生变化

例如：
- 原来只是 host wiring，现在又承担 delivery mode 分支
- 原来只是 transport handler，现在又增加 projection dispatch

### 2. 文件角色从“正式层”变为“过渡层”

例如：
- 新 app service 建好后，旧入口变成 compat facade
- 新 contract 建好后，旧 DTO boundary 只剩 wrapper 角色

### 3. 文件删除条件发生变化

例如：
- 旧 bridge 原本依赖 A/B/C 三个调用方
- 迁移后只剩 B
- 注释必须更新收敛状态

### 4. 架构规范文档已更新，但代码注释仍停留在旧描述

此时必须同步修正代码注释，避免 spec 与代码相互矛盾。

---

## 强制标签规范

与架构演进相关的注释统一使用以下标签：

- `@deprecated`
- `TODO(refactor)`
- `NOTE(layering)`
- `NOTE(compat)`
- `REMOVE_AFTER:`
- `MIGRATION_PHASE:`

### `REMOVE_AFTER:` 强制适用范围

以下文件/代码类别必须写 `REMOVE_AFTER:`，不能只写模糊备注：

1. legacy host / bootstrap 入口
2. compatibility bridge / wrapper / facade
3. deprecated public API 或 deprecated helper
4. 已标记 `MIGRATION_PHASE:` 的高风险聚合点

也就是说，像 `hub/src/index.ts`、`cli/src/commands/hub.ts`、`hub/src/sync/syncEngine.ts`、`cli/src/runner/run.ts` 这类文件，
如果已经承认自己是过渡态、兼容态或迁移聚合点，就必须写出可验证的删除/收敛条件。

### 禁止事项

- 不要发明模糊标签，如 `TODO(cleanup maybe)`、`hack for now`、`temp stuff`
- 不要使用无法稳定搜索的自然语言碎片代替结构标签
- 不要只写“后面再删”，必须写删除条件

---

## 推荐模板

### 1. Legacy Host 模板

```ts
/**
 * Legacy host/bootstrap entry for current bundled delivery path.
 *
 * Current role:
 * - command/bootstrap wiring
 * - compatibility startup path
 *
 * NOTE(layering): do not add new domain or application logic here.
 */
```

### 2. Compat Bridge 模板

```ts
/**
 * Compatibility bridge during layering migration.
 *
 * Purpose:
 * - keep old callers working while delegating to the new application service
 *
 * REMOVE_AFTER:
 * - all old callers migrate to SessionCommands
 */
```

### 3. Deprecated API 模板

```ts
/**
 * @deprecated use SessionCommands.renameSession instead.
 * This API remains only for old route/socket callers.
 * REMOVE_AFTER:
 * - all route/socket callers migrate
 */
```

### 4. Temporary Boundary 模板

```ts
/**
 * NOTE(layering): temporary boundary between shared transport contracts
 * and local UI/view-model shapes.
 *
 * Keep only UI-specific derived types here.
 * Do not duplicate cross-runtime DTOs in this file.
 */
```

### 5. 聚合文件顶部说明模板

```ts
/**
 * Current role:
 * - orchestration facade over multiple services
 * - still carries some legacy responsibilities during migration
 *
 * MIGRATION_PHASE: 2
 * NOTE(layering): shrink this file over time; do not add new business rules here.
 */
```

---

## 必须盘点的重点文件

以下文件在每次相关改动时，必须检查顶部注释是否仍准确：

- `hub/src/index.ts`
- `hub/src/sync/syncEngine.ts`
- `hub/src/web/server.ts`
- `hub/src/socket/handlers/cli/sessionHandlers.ts`
- `cli/src/commands/hub.ts`
- `cli/src/runner/run.ts`
- `web/src/types/api.ts`

### 当前已补充标注的文件

- `hub/src/index.ts`
- `hub/src/sync/syncEngine.ts`
- `hub/src/web/server.ts`
- `hub/src/config/serverSettings.ts`
- `hub/src/configuration.ts`
- `cli/src/commands/hub.ts`
- `cli/src/runner/run.ts`
- `hub/src/socket/handlers/cli/sessionHandlers.ts`
- `hub/src/socket/handlers/cli/machineHandlers.ts`
- `hub/src/socket/handlers/cli/terminalHandlers.ts`
- `cli/src/claude/utils/authConfig.ts`
- `cli/src/ui/apiUrlInit.ts`
- `web/src/types/api.ts`

### 当前仍建议后续补充的文件

- 未来新增的 host/bootstrap wrapper
- 未来新增的 compat facade / bridge

---

## 注释审查清单

当你 review 架构相关改动时，除了看代码逻辑，还必须检查：

- [ ] 该文件当前角色是否能从顶部注释读出来？
- [ ] 如果这是 legacy / compat / temporary boundary，注释里是否禁止继续堆业务逻辑？
- [ ] deprecated 注释是否写明替代路径？
- [ ] `REMOVE_AFTER:` 是否具体而可验证？
- [ ] 代码中的迁移状态是否与 `architecture-refactor-guidelines.md` / `legacy-map.md` 一致？
- [ ] 这次改动如果改变了收敛路径，是否同步更新了 spec 文档？

---

## 搜索与盘点规则

建议在做架构整理、收尾、发布前，统一搜索以下标签：

```text
NOTE(layering)
NOTE(compat)
@deprecated
REMOVE_AFTER:
MIGRATION_PHASE:
```

目的：

- 盘点还有哪些 compat bridge 未删
- 盘点哪些临时边界仍在扩大
- 盘点哪些 deprecated 项已满足删除条件
- 防止“过渡层永久存在”

---

## 与其他规范的关系

注释治理不是独立存在的，必须与下面文档联动：

- `backend/architecture-refactor-guidelines.md`
- `backend/legacy-map.md`
- `guides/cross-layer-thinking-guide.md`
- `backend/directory-structure.md`

规则是：

- `architecture-refactor-guidelines.md` 定义目标和原则
- `legacy-map.md` 定义旧路径的归宿和删除条件
- 本文定义代码注释怎么表达这些信息

---

## 总结

在本项目里，架构相关注释不是“装饰”，而是迁移控制面的一部分。

如果没有这些注释：

- 后续开发者不知道一个文件是不是 legacy
- 兼容层会继续膨胀
- deprecated 不会真正被删除
- spec 文档和代码状态会越来越不一致

因此，任何与 hub / web / cli 分层、领域解耦、宿主桥接、兼容迁移相关的修改，都必须把**代码、注释、规范文档**当成一个整体来维护。
