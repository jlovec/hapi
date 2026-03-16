# CI/CD 思维指南

> **目的**：确保 CI/CD 工作流的环境一致性、可靠性和可维护性。

---

## 为什么需要这个指南？

CI/CD 工作流是代码质量的最后一道防线，但常见问题包括：

- **环境不一致**：不同 workflow 使用不同的运行时版本或缺少必要依赖
- **测试无法执行**：workflow 声称要运行测试，但环境不支持
- **静默失败**：测试失败但 workflow 仍然通过
- **配置重复**：每个 workflow 独立配置环境，难以维护

这些问题会导致：
- PR 合并后才发现测试实际没运行
- 本地通过但 CI 失败（或反之）
- 修改依赖版本需要更新多个文件

---

## 核心原则

### 1. 环境一致性原则

**所有需要运行项目代码的 workflow 必须使用相同的运行时环境。**

#### 反例：PR24 的问题

```yaml
# .github/workflows/test.yml ✅ 正确
- uses: oven-sh/setup-bun@v2
- run: bun install
- run: bun run test

# .github/workflows/codex-pr-review.yml ❌ 错误
# 缺少 setup-bun，导致无法运行 web 测试
runs-on: ubuntu-latest  # 只有基础工具，没有 bun
```

**后果**：
- AI reviewer 在 PR#24 中报告"未运行测试（自动化环境缺少 `bun`，无法执行 `web` 侧测试命令）"
- 测试文件的修改无法被验证
- 静态分析无法发现运行时错误

#### 正确做法

**方案 A：复用环境配置步骤**

```yaml
# .github/workflows/codex-pr-review.yml
steps:
  - uses: actions/checkout@v4
  - uses: oven-sh/setup-bun@v2  # ✅ 添加这一行
  - run: bun install
  # ... 其他步骤
```

**方案 B：创建复合 Action（推荐）**

```yaml
# .github/actions/setup-project-env/action.yml
name: Setup Project Environment
description: Install bun and project dependencies
runs:
  using: composite
  steps:
    - uses: oven-sh/setup-bun@v2
      with:
        bun-version: 1.3.10  # 统一版本
    - run: bun install
      shell: bash

# 在所有 workflow 中使用
- uses: ./.github/actions/setup-project-env
```

**优势**：
- 单一配置源，修改一次生效所有 workflow
- 版本统一管理
- 减少配置重复

---

### 2. 测试执行验证原则

**如果 workflow 声称要检查测试，必须确保测试能够执行。**

#### Checklist

- [ ] 运行时环境已安装（bun/node/python 等）
- [ ] 依赖已安装（`bun install` / `npm ci` / `pip install`）
- [ ] 测试命令在 CI 环境中可执行
- [ ] 测试失败会导致 workflow 失败（`set -e` 或检查退出码）

#### AI Reviewer 的责任

如果 AI reviewer 无法运行测试，应该：

```markdown
**Testing**
❌ 无法执行测试：当前环境缺少 `bun` 运行时。

**建议**：
在 workflow 中添加：
\`\`\`yaml
- uses: oven-sh/setup-bun@v2
- run: bun install
\`\`\`

**风险**：
- 测试文件的修改未经验证
- 可能存在运行时错误未被发现
```

并且 workflow 应该失败（`exit 1`），而不是继续执行。

---

### 3. 配置即代码原则

**CI/CD 配置应该像代码一样被测试和验证。**

#### 实践

1. **Workflow 配置验证**

```yaml
# .github/workflows/validate-workflows.yml
name: Validate Workflows
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate workflow syntax
        run: |
          for file in .github/workflows/*.yml; do
            echo "Validating $file"
            # 使用 actionlint 或其他工具验证
          done
```

2. **环境一致性测试**

```bash
# 检查所有 workflow 是否使用相同的 bun 版本
grep -r "setup-bun" .github/workflows/ | grep -o "bun-version: [0-9.]*" | sort -u
# 应该只有一个版本
```

3. **依赖版本锁定**

```yaml
# ✅ 好：明确版本
- uses: oven-sh/setup-bun@v2
  with:
    bun-version: 1.3.10

# ❌ 差：使用 latest
- uses: oven-sh/setup-bun@v2
  # 可能导致不同时间运行结果不同
```

---

## 常见场景 Checklist

### 添加新的 CI Workflow

- [ ] 是否需要运行项目代码？
  - 是 → 添加 `setup-project-env` 或等效步骤
  - 否 → 明确说明为何不需要
- [ ] 是否需要运行测试？
  - 是 → 确保 `bun run test` 可执行
  - 否 → 在 workflow 注释中说明
- [ ] 失败时是否会阻止 PR 合并？
  - 是 → 确保 `set -e` 或检查退出码
  - 否 → 考虑是否应该阻止

### 修改测试文件

- [ ] 本地测试通过
- [ ] CI 中的测试 workflow 通过
- [ ] 如果有 AI reviewer，确认它能运行测试
- [ ] 如果 AI reviewer 报告"未运行测试"，检查环境配置
- [ ] **检查是否引入了运行时特定依赖（见下方"引入运行时特定依赖"）**

### 升级运行时版本

- [ ] 更新所有 workflow 中的版本号
- [ ] 更新 Dockerfile 中的版本号
- [ ] 更新 `package.json` 中的 `engines` 字段
- [ ] 更新文档中的版本要求

### 引入运行时特定依赖

- [ ] 依赖是否只在特定运行时可用？（如 `bun:ffi`、`bun:sqlite`、Node.js 特定模块）
- [ ] 测试环境是否与生产环境使用相同的运行时？
  - 是 → 无需额外处理
  - 否 → 必须提供测试环境的 mock
- [ ] 是否在 vitest.config.ts 中配置了 alias mock？
- [ ] Mock 实现是否覆盖了测试所需的接口？
- [ ] 是否添加了注释说明为何需要 mock？

**示例：Mock bun-pty**

```typescript
// vitest.config.ts
export default defineConfig({
    test: {
        alias: {
            // Mock bun-pty for test environment (vitest runs in Node.js, not Bun)
            // bun-pty depends on bun:ffi which is not available in Node.js
            'bun-pty': resolve('./src/__mocks__/bun-pty.ts'),
        }
    }
})
```

```typescript
// src/__mocks__/bun-pty.ts
export interface IPty { /* ... */ }
export const spawn: null = null  // Simulate unavailable runtime
```

---

## 快速诊断

### 问题：AI reviewer 说"无法运行测试"

**检查清单**：
1. 查看 workflow 文件是否有 `setup-bun` 或等效步骤
2. 查看是否有 `bun install` 步骤
3. 查看测试命令是否正确（`bun run test` vs `npm test`）
4. 查看 workflow 日志，确认失败原因

**修复**：
```yaml
# 在 steps 中添加
- uses: oven-sh/setup-bun@v2
- run: bun install
```

### 问题：本地通过但 CI 失败

**可能原因**：
- 本地使用不同的运行时版本
- 本地有全局安装的依赖，CI 没有
- 环境变量不同
- 文件路径大小写敏感性（macOS vs Linux）

**诊断**：
```bash
# 本地模拟 CI 环境
docker run -it --rm -v $(pwd):/app -w /app oven/bun:1.3.10 bash
bun install
bun run test
```

### 问题：CI 通过但本地失败

**可能原因**：
- 本地依赖版本不同（`bun.lock` 未同步）
- 本地有未提交的文件影响测试
- 本地环境变量干扰

**诊断**：
```bash
# 清理并重新安装
rm -rf node_modules
bun install --frozen-lockfile
bun run test
```

### 问题：测试失败提示"Cannot find package 'bun:ffi'"

**原因**：
- 代码中静态导入了依赖 Bun 运行时特定模块的包（如 `bun-pty`）
- 测试环境运行在 Node.js（vitest），无法解析 `bun:ffi` 等 Bun 特定模块

**修复**：
1. 在 `vitest.config.ts` 中添加 alias mock：
```typescript
export default defineConfig({
    test: {
        alias: {
            'bun-pty': resolve('./src/__mocks__/bun-pty.ts'),
        }
    }
})
```

2. 创建 mock 文件 `src/__mocks__/bun-pty.ts`：
```typescript
// Mock for bun-pty in test environment
export interface IPty { /* ... */ }
export const spawn: null = null  // Simulate unavailable runtime
```

**预防**：
- 引入新的运行时特定依赖时，立即提供测试环境的 mock
- 参考"引入运行时特定依赖" checklist

---

## 案例 3: Lockfile Drift - 依赖锁文件不一致

### 问题描述

CI 中的 `compose-smoke` job 失败，错误信息：

```
Lockfile precheck (frozen)
Process completed with exit code 1.
```

检查步骤：
```yaml
- name: Lockfile precheck (frozen)
  run: |
    bun install --frozen-lockfile
    git diff --exit-code bun.lock
```

### 根本原因

**Category C: Change Propagation Failure（变更传播失败）**

开发者修改了依赖或 `package.json`，但是：
1. 忘记提交更新后的 `bun.lock` 文件
2. 或者在不同的 bun 版本下，lockfile 产生了不同的哈希值
3. 或者 lockfile 不完整/损坏，CI 重新生成后与原文件不同

### 为什么会发生

**常见场景**：

| 场景 | 原因 | 后果 |
|------|------|------|
| **忘记提交** | `git add package.json` 但忘记 `git add bun.lock` | CI 检测到不一致 |
| **版本差异** | 本地 bun 1.3.10，CI bun 1.3.15 | lockfile 格式/哈希不同 |
| **部分安装** | 只安装了部分 workspace 的依赖 | lockfile 不完整 |
| **手动编辑** | 直接编辑 lockfile（极少见） | 格式损坏 |

### 预防机制

#### P0: Pre-commit Hook

在 `.git/hooks/pre-commit` 中添加检查：

```bash
#!/bin/bash
# 检查 package.json 和 lockfile 是否同步

if git diff --cached --name-only | grep -q "package.json"; then
  if ! git diff --cached --name-only | grep -q "bun.lock"; then
    echo "❌ Error: package.json changed but bun.lock not staged"
    echo "Run: bun install && git add bun.lock"
    exit 1
  fi
fi
```

#### P0: 开发规范文档

在 `.trellis/spec/backend/quality-guidelines.md` 或前端规范中明确：

**Lockfile 提交规则**：
- ✅ 修改依赖时，必须同时提交 lockfile
- ✅ 使用 `bun install` 而不是 `bun add --no-save`
- ✅ 提交前运行 `bun install` 确保 lockfile 最新
- ❌ 不要手动编辑 lockfile
- ❌ 不要在 `.gitignore` 中忽略 lockfile

#### P1: 改进 CI 错误信息

修改 workflow 提供更清晰的错误提示：

```yaml
- name: Lockfile precheck (frozen)
  run: |
    echo "Checking lockfile consistency..."
    bun install --frozen-lockfile || {
      echo "❌ Lockfile is out of sync with package.json"
      echo ""
      echo "To fix this:"
      echo "  1. Run: bun install"
      echo "  2. Commit the updated bun.lock"
      echo "  3. Push again"
      exit 1
    }

    git diff --exit-code bun.lock || {
      echo "❌ Lockfile was modified during install"
      echo "This means your committed lockfile is incomplete or uses a different bun version"
      echo ""
      echo "To fix this:"
      echo "  1. Ensure you're using bun >= 1.3.10"
      echo "  2. Run: bun install"
      echo "  3. Commit the updated bun.lock"
      echo "  4. Push again"
      exit 1
    }
```

#### P1: 统一 Bun 版本

在 `package.json` 中已经锁定：

```json
{
  "engines": {
    "bun": ">=1.3.10"
  }
}
```

但考虑更严格的版本范围：

```json
{
  "engines": {
    "bun": "^1.3.10"  // 只允许 1.3.x 版本
  }
}
```

### 修复步骤

当遇到 lockfile precheck 失败时：

```bash
# 1. 确保使用正确的 bun 版本
bun --version  # 应该 >= 1.3.10

# 2. 重新生成 lockfile
bun install

# 3. 检查变更
git diff bun.lock

# 4. 如果变更合理，提交
git add bun.lock
git commit -m "chore: update lockfile"
git push

# 5. 如果变更异常（大量无关变更），检查 bun 版本
# 可能需要升级/降级到与 CI 一致的版本
```

### 系统性扩展

**类似问题**：
- `package-lock.json` (npm)
- `yarn.lock` (yarn)
- `pnpm-lock.yaml` (pnpm)
- 任何需要"成对提交"的文件：
  - Database schema + migration files
  - TypeScript types + implementation
  - OpenAPI spec + generated code

**设计改进**：
- 考虑在 `setup-project-env` action 中验证 bun 版本
- 添加 lockfile 验证脚本到 `package.json` scripts
- 在 PR template 中添加 lockfile 检查项

**流程改进**：
- 在开发者 onboarding 文档中强调 lockfile 重要性
- 考虑添加 pre-push hook（比 pre-commit 更宽松）
- 在 code review checklist 中添加"lockfile 已更新"项

---

## 相关资源

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Bun CI 集成指南](https://bun.sh/docs/cli/test#ci)
- [跨平台思维指南](./cross-platform-thinking-guide.md)（处理路径和命令）

---

## 记住

> **CI 环境不一致是技术债的隐形来源。**
>
> 花 10 分钟统一环境配置，可以避免数小时的"为什么 CI 失败"调试时间。

> **Lockfile 是依赖管理的契约。**
>
> 修改依赖时忘记提交 lockfile，就像修改 API 接口但不更新文档一样危险。

---

**最后更新**：2026-03-16
- 基于 PR#24 的教训：环境一致性原则
- 基于 Issue#313-012 的教训：运行时特定依赖的 mock 处理
- 基于 CI failure (compose-smoke) 的教训：Lockfile drift 预防与修复
