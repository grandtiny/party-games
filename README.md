# Party Games

私人聚会游戏站。首页提供平级的血染钟楼和德州扑克入口；当前已实现暗流涌动从圆桌入座、私密配角、首夜、白天提名投票到普通夜晚和下一天的本地循环，并内置暗流涌动角色与规则资料。

## 本地开发

要求：Node.js 24+、pnpm 10+。

```powershell
pnpm install
pnpm dev
```

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
本地 Compose 默认通过 `mirror.gcr.io` 拉取官方 Node 镜像；可使用环境变量 `NODE_IMAGE` 覆盖镜像来源。

德州扑克当前通过功能开关开放：

```powershell
$env:POKER_ENABLED = "true"
docker compose up -d --build
```

未设置时首页保持德扑入口关闭，血染钟楼行为不变。

首页右上角提供系统设置入口。首次访问时创建至少 8 位的管理员密码，之后可以在设置页配置 OpenAI 兼容接口、测试连接和修改管理员密码。管理员密码使用加盐哈希保存，模型 API Key 只在服务端持久化且不会通过读取接口返回明文。

规则问答默认使用仓库内置资料，不需要外部服务。除设置页面外，也可以使用环境变量提供初始 OpenAI 兼容配置：

```powershell
$env:CLOCKTOWER_LLM_ENDPOINT = "https://example.com/v1/chat/completions"
$env:CLOCKTOWER_LLM_API_KEY = "your-key"
$env:CLOCKTOWER_LLM_MODEL = "model-name"
docker compose up --build
```

设置页面保存的配置优先于环境变量。接口未配置、关闭、超时或返回错误时会自动使用本地资料，不影响游戏状态机和裁定。

## 验证

```powershell
pnpm typecheck
pnpm test
pnpm build
$env:BASE_URL = "http://127.0.0.1:18081"
pnpm verify:local
pnpm verify:poker-local
```

`verify:local` 默认创建五人房间，自动完成首夜、公屏与私聊、进入提名、顺时针投票、处决、普通夜晚行动，并验证黎明进入第二天。

规则测试还会批量运行 5 到 15 人的多轮确定性对局，并检查特殊登记、恶魔传位和夜间 SQLite 恢复。

当前实现边界见 [docs/mvp-scope.md](docs/mvp-scope.md)。

## 模块结构

```text
packages/game-core/              游戏模块契约与注册表
packages/clocktower/             暗流涌动规则状态机与本地资料
packages/poker/                  德扑规则内核、确定性快照与桌型领域层
apps/server/src/platform/        房间平台接口
apps/server/src/games/           服务端游戏适配器
apps/web/src/platform/           大厅、设置和通用外壳
apps/web/src/games/clocktower/   血染钟楼页面、组件和主题作用域
apps/web/src/games/poker/        德扑建房、圆桌大厅和多人牌桌
```

服务端游戏适配器统一实现 `create`、`handle`、`project`、`tick`、`migrate` 和 `validate`。血染钟楼前端改造约束见 [apps/web/src/games/clocktower/README.md](apps/web/src/games/clocktower/README.md)。
