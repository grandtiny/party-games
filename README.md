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

## 验证

```powershell
pnpm typecheck
pnpm test
pnpm build
$env:BASE_URL = "http://127.0.0.1:18081"
pnpm verify:local
```

`verify:local` 默认创建五人房间，自动完成首夜、公屏与私聊、进入提名、顺时针投票、处决、普通夜晚行动，并验证黎明进入第二天。

规则测试还会批量运行 5 到 15 人的多轮确定性对局，并检查特殊登记、恶魔传位和夜间 SQLite 恢复。

当前实现边界见 [docs/mvp-scope.md](docs/mvp-scope.md)。
