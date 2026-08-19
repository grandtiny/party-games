# Party Games

私人聚会游戏站。首页提供血染钟楼、德州扑克、海龟汤、怀旧庄园、扫雷、数独和五子棋入口；当前已实现暗流涌动完整本地循环，复用同一服务端规则内核、按行动顺序逐步广播的德扑多人房间和三档确定性单人 AI 对局，服务端持有汤底的多人海龟汤，以及扫雷、数独和支持标准禁手、离线 AI、残局、教学、存档与复盘的五子棋。怀旧庄园当前开放包含 86 种原版作物和多季规则的现实时间农场循环，并直接复用平台账号保存长期进度。

## 本地开发

要求：Node.js 24+、pnpm 10+。

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

首次克隆，以及拉取后 `package.json` 或 `pnpm-lock.yaml` 有变化时，都需要重新执行
`pnpm install --frozen-lockfile`。否则工作区子包的依赖链接不会生成，编辑器会把缺失模块
继续放大成大量 TypeScript 类型错误。

浏览器打开 `http://localhost:5173`。开发服务器会把 API 和 Socket.IO 请求代理到 `http://localhost:3000`。

## 本地生产构建

```powershell
pnpm build
pnpm start
```

浏览器打开 `http://localhost:3000`。

## Docker

```powershell
docker compose up --build
```

浏览器打开 `http://localhost:18081`。SQLite 数据保存在 Docker 命名卷 `party-games-data`。
Compose 默认拉取官方 `node:24-bookworm-slim` 镜像；可使用环境变量 `NODE_IMAGE` 覆盖镜像来源。

### 怀旧庄园

庄园没有单独的账号或游客存档。玩家登录现有平台账号后，每个账号自动创建并持续复用一份农场存档；退出登录后不能读取或操作庄园。当前农场按经典 1000×768 场景还原 18 块菱形土地、顶部状态栏、底部工具栏以及商店、种子包和仓库弹窗；新账号从 6 块土地起步，按原版等级和金币要求依次开垦至 18 块，并可领取原版新手礼包。农场支持 57 种商店种子、29 种特殊奖励种子、原版 30 档升级奖励、生长阶段与多季收获、随机缺水/杂草/害虫、按持续时间计算的减产、照料奖励、普通/高速/极速化肥、枯萎清理、仓库出售、等级解锁和离线成长。升级奖励中的装扮目前只记录权益，摆放界面尚未开放；牧场保留原版入口，具体玩法和好友交互尚未开放。

默认按现实时间成长。开发联调时可设置正数倍率缩短等待时间，例如：

```powershell
$env:MANOR_TIME_SCALE = "120"
$env:MANOR_LEGACY_ASSETS_PATH = "C:\path\to\qqfarm"
pnpm start
```

`MANOR_LEGACY_ASSETS_PATH` 是可选的旧资源根目录。服务端只会从该目录查找并只读提供 `module/nc/farm/diy/26f.jpg`；没有配置或文件不存在时使用前端内置的经典农场场景资源。

Docker Compose 默认把宿主机 `./data/legacy-assets` 只读挂载到容器。可在 `.env` 中用 `MANOR_LEGACY_ASSETS_HOST_PATH` 改成旧资源根目录；不提供对应图片时仍会使用内置场景。

德州扑克默认启用。如需临时关闭入口：

```powershell
$env:POKER_ENABLED = "false"
docker compose up -d --build
```

直接运行和 Docker Compose 的默认行为一致；只有显式设置为 `false` 时才关闭。

首页右上角提供系统设置入口。首次访问时创建至少 8 位的管理员密码，之后可以在设置页配置平台级 OpenAI 兼容接口、测试连接和修改管理员密码。管理员密码使用加盐哈希保存，模型 API Key 只在服务端持久化且不会通过读取接口返回明文。

血染规则问答默认使用仓库内置资料。海龟汤正式多人房间优先使用平台级大模型生成汤面、汤底和真相要点，并使用裁判模型处理提问、猜谜和提示；接口未配置、关闭、超时或返回无效 JSON 时会标记为本地降级。除设置页面外，也可以使用环境变量提供初始 OpenAI 兼容配置：

```powershell
$env:PARTY_GAMES_LLM_ENDPOINT = "https://example.com/v1"
$env:PARTY_GAMES_LLM_API_KEY = "your-key"
$env:PARTY_GAMES_LLM_MODEL = "default-model"
$env:PARTY_GAMES_LLM_STORY_MODEL = "story-model"
$env:PARTY_GAMES_LLM_JUDGE_MODEL = "judge-model"
docker compose up --build
```

设置页面保存的配置优先于环境变量。`PARTY_GAMES_LLM_STORY_MODEL` 和 `PARTY_GAMES_LLM_JUDGE_MODEL` 未设置时会回退到 `PARTY_GAMES_LLM_MODEL`。旧的 `CLOCKTOWER_LLM_*` 环境变量和 `clocktower.llm` 持久化配置仍会读取，用于兼容已有部署。

本地真实模型联调可以用脚本复用当前 shell 里的 OpenAI/Codex 风格环境变量，不会把 API Key 写入仓库：

```powershell
pnpm build
pnpm start:llm-local -- -Port 18083
```

脚本优先读取 `PARTY_GAMES_LLM_*`，缺省时尝试 `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`、`CODEX_LLM_*` 等变量；如果本机存在 `C:\Code\30_Tools\cli\CLIProxyAPI_6.10.9_windows_amd64\config.yaml`，还会自动复用本地 CPA 的 OpenAI-compatible 入口和 client key。所有映射只存在于启动进程环境中，不会把 API Key 写入仓库或 `.env`。

默认 CPA 模型为已通过本地验收的 `codex-auto-review`。如需切换模型：

```powershell
pnpm start:llm-local -- -Port 18083 -CpaModel codex-auto-review
```

## 验证

```powershell
pnpm typecheck
pnpm test
pnpm build
$env:BASE_URL = "http://127.0.0.1:18081"
pnpm verify:local
pnpm verify:poker-local
pnpm verify:poker-ai-local
pnpm verify:turtle-soup-ai-local
pnpm verify:poker-tournament-local
```

`verify:local` 默认创建五人房间，自动完成首夜、公屏与私聊、进入提名、顺时针投票、处决、普通夜晚行动，并验证黎明进入第二天。

`verify:poker-local` 创建两人积分桌，验证入座、准备、发牌、底牌隔离、服务端合法行动、弃牌结算、未跟注筹码退回、行动记录、离桌结算、重新入座和筹码守恒。

`verify:poker-ai-local` 创建一名真人和三名 AI 的积分桌，验证自动入座与准备、拒绝额外真人加入、AI 按顺序逐个行动并停回真人、底牌隔离和筹码守恒。

`verify:turtle-soup-ai-local` 创建单人海龟汤房间并要求题目生成、提问裁判和提示生成均来自模型；如需临时允许本地降级，可设置 `$env:REQUIRE_TURTLE_SOUP_MODEL = "false"`。

`verify:poker-tournament-local` 创建两人自动盲注淘汰赛，验证房主暂停/恢复、计时状态投影、拒绝手动跳级，以及截止时间前不会提前提升盲注。

`verify:poker-ai-local` 与 `verify:poker-tournament-local` 会在未初始化的验收数据库中创建本地账号；已初始化时可通过 `VERIFY_ACCOUNT_USERNAME`、`VERIFY_ACCOUNT_PASSWORD` 和可选的 `VERIFY_LEGACY_ADMIN_PASSWORD` 提供账号凭据。

`/turtle-soup/lab` 是协作提示词测试页，会直接显示可编辑汤面、汤底和要点，并保留原 LABYRINTH 浏览器侧 Base URL、API Key、故事模型、裁判模型配置；该测试线只用于调提示词。猜谜判定优先返回 `achieved_point_ids`，旧版 `achieved_points` 文本仍兼容。正式多人房间只使用服务端平台级大模型配置，服务端持有汤底，玩家解出前不会广播汤底、未命中要点正文或 API Key。

规则测试还会批量运行 5 到 15 人的多轮确定性对局，并检查特殊登记、恶魔传位和夜间 SQLite 恢复。

当前实现边界见 [docs/mvp-scope.md](docs/mvp-scope.md)。

## 开发协作

分支职责、worktree 隔离、验证门槛和合入规则见 [AGENTS.md](AGENTS.md)。功能开发不要直接写入 `main`；每个功能分支应跟踪同名远端，并在合入前同步最新主线完成组合验证。

## 模块结构

```text
packages/game-core/              游戏模块契约与注册表
packages/clocktower/             暗流涌动规则状态机与本地资料
packages/poker/                  德扑规则内核、确定性快照与桌型领域层
packages/gomoku/                 五子棋规则、禁手、三档 AI、残局和教学内容
packages/manor/                  庄园经济、成长、随机事件与存档迁移领域层
apps/server/src/platform/        房间平台接口
apps/server/src/games/           服务端游戏适配器
apps/web/src/platform/           大厅、设置和通用外壳
apps/web/src/games/clocktower/   血染钟楼页面、组件和主题作用域
apps/web/src/games/poker/        德扑建房、圆桌大厅、多人牌桌和单人 AI 对局
apps/web/src/games/turtle-soup/  海龟汤入口、多人房间和提示词测试页
apps/web/src/games/minesweeper/  扫雷规则适配、棋盘和移动端操作
apps/web/src/games/sudoku/       数独题目、状态模型、棋盘和输入工具
apps/web/src/games/gomoku/       五子棋对局、残局、教学、账号同步和逐手复盘
apps/web/src/games/manor/        账号庄园、农田操作、种子商店和仓库
```

服务端游戏适配器统一实现 `create`、`handle`、`project`、`tick`、`migrate` 和 `validate`。血染钟楼前端改造约束见 [apps/web/src/games/clocktower/README.md](apps/web/src/games/clocktower/README.md)。
