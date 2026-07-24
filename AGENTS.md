# Party Games 协作约束

本文件适用于整个仓库，并继承 `C:\Code\AGENTS.md` 的通用规则。

## 分支职责

- `main` 只保存已完成集成验证、可部署的版本，不直接承载功能开发。
- 新功能使用 `feature/<scope>`，缺陷修复使用 `fix/<scope>`，纯样式调整使用 `style/<scope>`，工程维护使用 `chore/<scope>`。
- 一个任务只使用一个功能分支和一个 worktree；不要让两个任务同时写同一个分支或 worktree。
- 新分支从最新 `origin/main` 创建。功能分支必须跟踪同名远端分支，不能把 upstream 设置为 `origin/main`。
- 当前分支状态以 `git branch -vv`、`git worktree list` 和远端为准，不在文档里维护容易过期的分支清单。

## 开始开发前

- 先执行 `git fetch origin`，检查 `git status --short --branch`、`git branch -vv` 和 `git worktree list`。
- 如果目标分支或 worktree 正被其他任务使用，先确认对方已经暂停且工作区状态稳定，再继续操作。
- 不覆盖、回滚或整理不属于当前任务的改动；发现关联改动时应在现有基础上整合。

## 提交与同步

- 按可独立验证的功能批次提交，不把多个无关游戏或重构混在同一提交里。
- 每个开发批次完成验证后，将功能分支推送到同名远端，避免成果只保存在本地未提交工作区。
- 分支尚未共享时可以 rebase；一旦已经推送或由多人协作，使用 merge 同步最新 `origin/main`，不得 force push。
- 合并前优先在功能分支解决与最新 `main` 的冲突，并在组合状态下重新验证。
- API Key、管理员密码、SQLite 数据库、`.env` 和本地服务配置不得提交。

## 合入 main

- 合入前要求：功能分支工作区干净、已推送同名远端、必要测试通过、生产构建通过。
- 更新主线使用 `git pull --ff-only origin main`，功能分支使用明确的 merge commit 合入，保留功能边界。
- 合入后至少运行：

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

- 修改具体游戏流程时，还要运行 README 中对应的本地验收脚本；依赖真实模型的海龟汤验收应明确记录模型配置和是否发生本地降级。
- 只有全仓验证通过且 `main` 工作区干净时，才推送 `origin/main`。

## 分支与 worktree 清理

- 功能合入后先确认 `origin/main` 已包含对应提交，再把分支和 worktree 列为清理候选。
- 删除分支或 worktree 前必须确认其中没有未提交、未跟踪或未推送内容，并获得用户明确确认。
- 不自动删除远端分支，不使用 `git reset --hard`、强制删除或强制推送处理分支分歧。
