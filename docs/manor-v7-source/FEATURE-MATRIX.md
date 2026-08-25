# QQ 农牧场 V7 全量功能矩阵

本文档是授权源项目 `7.0 Beta1 Build 20120209.1000` 与 Party Games 当前庄园实现之间的长期对照基线。
它记录源项目有什么、当前做到了什么、哪些功能被本地化替代、哪些明确放弃，以及哪些仍需决定。

- 源项目基线：`summary.csv` 中的 `source_bundle_sha256=9a73402041a571286e27e2cd6e95bf99b00343bc410ae2ae90af9dacc846aff0`
- 当前实现基线：`feature/manor` 分支提交 `0f2e431`
- 最近审计日期：2026-08-25
- 源项目证据路径均相对授权包内 `source/plugin/qqfarm/`，不记录源机器绝对路径
- 当前实现证据主要来自 `packages/manor-v7/`、`apps/server/src/manor-v7-*`、`apps/web/src/games/manor/` 和庄园测试

## 0. 审计边界与覆盖

本矩阵的“全量”指授权 V7 包中可识别的产品能力，不只指当前页面上能点到的按钮。审计同时覆盖玩家入口、
农场/牧场协议、XML 与 Flash 运行时、工具页、运营后台、计划任务、活动模块、外部平台依赖和源码自身缺陷。

| 审计面 | 源项目规模 | 本文记录方式 |
| --- | --- | --- |
| 玩家功能 | 农场、鱼塘、牧场、野生动物、社交、经济、活动 | 第 3–11 节按稳定功能 ID 记录状态、差异和证据。 |
| 农场协议 | `mync.php` 允许 135 个唯一模块 | 第 14.1 节逐个列出精确模块名；`source-protocols.csv` 可机械核对。 |
| 牧场协议 | `mymc.php` 允许 97 个唯一模块 | 第 14.2 节逐个列出精确模块名；`source-protocols.csv` 可机械核对。 |
| 源协议异常 | 11 个允许模块缺处理文件、20 个处理文件不在允许列表、5 个重复声明 | 第 14.3 节单独记录，不能拿源码残缺当作当前实现依据。 |
| XML/Flash 运行时 | 7 个 XML 配置模块、8197 个素材模块文件 | 运行时能力在第 3–4 节；逐文件、符号和素材状态在同目录 CSV 台账。 |
| 配套工具页 | 7 个模块 | 第 12 节 `TOOL-*`。 |
| 运营后台 | 20 个入口模块及额外快捷赠礼处理 | 第 12 节 `ADMIN-*`。 |
| 计划任务 | 每日重置、天气、VIP 更新及调度器 | 第 3、5、10、12 节。 |
| Discuz/外部服务 | 安装、账号、好友、支付、分享、广告和腾讯联动 | 第 2、3、10、13 节。 |

功能状态以“玩家最终得到的行为”为准，协议覆盖以源入口为准，素材覆盖以生成台账为准。这三种口径不能互相替代。
当前共有 235 个稳定功能 ID（不含 `D-*` 决策）：已实现 112、部分实现 12、特殊实现 23、未实现 35、
放弃 44、待确认 3、源残留 6。状态变化必须同步更新对应行和这组汇总数。

## 1. 状态定义

| 状态 | 判定口径 |
| --- | --- |
| 已实现 | 玩家可从当前原版 SWF 入口完成主要流程，状态真实持久化，并有领域或服务端测试证据。 |
| 部分实现 | 主流程可用，但源项目的某些分支、奖励、展示、历史记录或管理能力仍缺失；空响应兼容桩也归入此类。 |
| 特殊实现 | 产品目标保留，但技术架构、账号、经济、时间窗口或交互被明确替换，不再追求源行为完全一致。 |
| 未实现 | 源项目存在且当前没有可完成流程，也没有明确放弃决定。 |
| 放弃 | 已有明确产品决定不接入；保留兼容空响应不改变其“放弃”状态。 |
| 待确认 | 源码或素材可识别，但价值、规则、素材完整性或本地化方式尚未决定。 |
| 源残留 | 授权包只剩声明、静态桩、演示数据、缺失处理文件或不可达处理文件，本身不构成可完整运行的源功能。 |

“客户端不报错”不等于“已实现”。例如 `feeds` 返回空数组、充值窗口被关闭、外链被 Ruffle 拒绝，
都必须按实际业务结果标为部分实现或放弃。

## 2. 已确认的本地化决策

| 编号 | 决策 | 当前状态 | 约束与影响 |
| --- | --- | --- | --- |
| D-01 | 只以 V7 授权项目为产品与素材基线 | 特殊实现 | 旧经典版、早期自行拆图版和旧版补丁不再作为实现来源。 |
| D-02 | 复用 Party Games 平台账号 | 特殊实现 | 不迁移 Discuz 登录、QQ 登录或源项目用户体系；每个已登录平台账号一份庄园存档。 |
| D-03 | 使用 TypeScript 领域层、Fastify 与 SQLite | 特殊实现 | 不运行源 PHP/MySQL 业务代码；源代码只作为规则和协议证据。 |
| D-04 | 不迁移源数据库玩家数据 | 放弃 | `qqfarm_market`、`qqfarm_mc`、`qqfarm_mclogs`、`qqfarm_message`、`qqfarm_nc`、`qqfarm_nclogs`、`qqfarm_user` 均不迁移。 |
| D-05 | 最大程度保留 V7 原版页面和美术 | 特殊实现 | 使用原版 SWF + Ruffle，服务端重写协议；React 自绘 V7 场景不再是正式入口。 |
| D-06 | 所有平台账号固定为 7 级年费 VIP | 特殊实现 | 客户端仍显示 VIP 身份和分类，但不维护开通、到期、续费和 VIP 经验成长。 |
| D-07 | 删除所有充值、续费和腾讯会员入口 | 放弃 | 元宝充值、黄钻开通、腾讯会员外链及相关跳转不进入产品。 |
| D-08 | 无限 VIP 免费商品改为金币购买 | 特殊实现 | 已有金币价直接使用；只有元宝价时按 `元宝价 × 1000` 转金币；种子、动物、土地和窝棚使用原金币规则。 |
| D-09 | 限次奖励可以免费 | 特殊实现 | 每日礼包、签到、连续签到、升级奖励、回归礼包和节日限次礼包保留免费，但必须有日/次/账号限制。 |
| D-10 | 禁止旧 SWF 打开外部网页 | 放弃 | Ruffle `openUrlMode=deny`；论坛、广告、合作专区、QQ 空间、腾讯管家、餐厅入口等不能跳出本站。 |
| D-11 | 好友来自平台账号全集 | 特殊实现 | 农场和牧场使用同一好友集合，不实现 QQ/Discuz 好友同步或手动好友申请。 |
| D-12 | 庄园测试工具默认关闭 | 特殊实现 | 仅显式启用后对平台 owner 开放加速时间和发资源；不得作为正式经济入口。 |
| D-13 | 站点语言决定庄园语言 | 特殊实现 | 当前使用中文 V7 资源，不维护源项目模板/编码切换。 |
| D-14 | 不接入旧论坛与交流论坛入口 | 放弃 | 留言板保留为庄园内部功能，Discuz 论坛和原项目交流论坛不保留。 |
| D-15 | Lovesday 活动长期开放用于本地玩法 | 特殊实现 | 活动窗口调整为 2000–2099，保留 99 个产物九倍出售规则。 |

## 3. 平台、运行时与存档

| ID | 源项目功能 | 状态 | 当前实现与差异 | 证据 |
| --- | --- | --- | --- | --- |
| PLAT-01 | Discuz 插件安装、导航和登录检查 | 放弃 | 不安装 Discuz 插件，庄园是 Party Games 的平级游戏入口。 | `discuz_plugin_qqfarm_SC_UTF8.xml`；D-02 |
| PLAT-02 | 首次进入自动初始化农场/牧场用户 | 已实现 | 平台账号首次访问时自动创建 schema 9 存档。 | `core/mync.php`、`core/mymc.php`；`manor-v7-service.ts` |
| PLAT-03 | 农场、牧场和公共用户表分表保存 | 特殊实现 | 合并为每账号一份版本化 JSON 状态并保存在 SQLite；好友双存档事务更新。 | `database-boundary.csv`；`repository.ts` |
| PLAT-04 | 按服务器时间成长 | 已实现 | 读取时确定性推进，支持离线成长；测试环境可配置时间倍率。 | `advance.ts`、`manor-v7-service.ts` |
| PLAT-05 | Flash Player/ActiveX 运行 | 特殊实现 | 浏览器使用仓库内 Ruffle，不安装旧 Flash ActiveX。 | `ManorRufflePlayer.tsx` |
| PLAT-06 | V7 农场和牧场原版主界面 | 已实现 | 分别加载 `happyfarm3_v_101.swf` 与 `mcloader_v_28.swf`，使用本地配置和模块。 | `V7Page.tsx`、`ManorRufflePlayer.tsx` |
| PLAT-07 | 农场/牧场互跳 | 已实现 | 页签与 `C.util.toApp`、`QZONE.FP.toApp`、`switchToFarm` 桥接共同切换场景。 | `V7Page.tsx` |
| PLAT-08 | 场景截图 | 特殊实现 | 新增本地 PNG 截图，不上传 QQ 相册。 | `ManorRufflePlayer.tsx` |
| PLAT-09 | 源玩家数据迁移 | 放弃 | 七张可变玩家表全部排除，旧 PHP/MySQL 数据不读取。 | `database-boundary.csv`；D-04 |
| PLAT-10 | 管理员测试和资源发放 | 特殊实现 | 仅保留显式开关控制的 owner 测试工具；不嵌入正式页面经济。 | `ManorTestTools.tsx`、`app.ts` |
| PLAT-11 | 原版网络外链和统计上报 | 放弃 | 所有外链禁止打开；腾讯统计、广告和分享不发送。 | `openUrlMode=deny`；D-10 |
| PLAT-12 | React 自绘农牧场场景 | 放弃 | `V7Scenes.tsx`、`V7Windows.tsx` 仍在仓库但没有正式路由引用，不能作为功能完成证据。 | `App.tsx`、`V7Page.tsx` |
| PLAT-13 | 原 XML 配置服务 | 特殊实现 | 7 个源 XML 模块改为仓库内固定模板，由 Fastify 注入本站资源与协议地址；不运行 `xml.php`。 | `source/xml/mod/`、`/api/manor/flash/config/:fileName` |
| PLAT-14 | 原 JavaScript/SWFObject 页面桥 | 特殊实现 | 不加载 `script.php` 和旧 SWFObject；React + Ruffle 提供加载、农牧场互跳和截图所需最小桥接。 | `script.php`、`ManorRufflePlayer.tsx`、`V7Page.tsx` |
| PLAT-15 | 每日重置与计划任务 | 特殊实现 | 不运行常驻 PHP cron；按上海自然日在状态读取/动作时确定性重置每日次数，离线后首次访问也能补齐。 | `source/cron/daily.php`、状态迁移与动作测试 |
| PLAT-16 | 全站关闭庄园及关闭公告 | 未实现 | 源项目可由后台暂停整个农牧场并显示原因；当前没有庄园专属维护开关。 | `nmc.php`、`admin/mod/system.php` |
| PLAT-17 | GBK/UTF-8 双插件包和可切换模板 | 放弃 | 站点只按自身语言和前端主题渲染，不维护 Discuz 编码包、PHP 模板编译和播放器皮肤切换。 | `discuz_plugin_qqfarm_SC_*.xml`、`view/qf_*`、D-13 |
| PLAT-18 | 旧版本数据库升级脚本 | 放弃 | 不执行 `63Fto70B1.php`、`upgrade.php` 或旧表修复；版本化 TypeScript 存档自行迁移。 | D-03、D-04 |
| PLAT-19 | 牧场开通资格与手动注册 | 特殊实现 | 源 `cgi_ws_com`/`cgi_register` 的资格检查与开通步骤被首次进入自动初始化替代。 | `cgi_ws_com`、`cgi_register`、PLAT-02 |

## 4. 目录、规则与素材覆盖

| ID | 源项目内容 | 状态 | 当前实现与差异 | 证据 |
| --- | --- | --- | --- | --- |
| CAT-01 | 全量 V7 文件台账 | 已实现 | 已登记 8197 个模块文件、4735 个 SWF、1249 个 PNG、2189 个 JPG、21 个 GIF。 | `summary.csv`、`files.csv` |
| CAT-02 | 作物目录 | 已实现 | 源配置 589 行，已逐项判定并接入 577 种可运行作物，保留 VIP、隐藏和土地要求。4 种作物只有 3 个阶段素材而阻塞；另 8 条 `crop_type=11` 是节日卡片，不属于作物目录。 | `rules-summary.csv`、`catalog-crops.csv`、`catalog.generated.ts`、`state.test.ts` |
| CAT-03 | 动物目录 | 已实现 | 源配置 178 行，运行目录 177 种，包括 153 种普通动物和 24 种隐藏动物。唯一排除项为缺失两段动画素材的仙人掌小妖（1565）。 | `rules-summary.csv`、`catalog-animals.csv`、`catalog.generated.ts`、`state.test.ts` |
| CAT-04 | 鱼目录 | 已实现 | 源配置 17 行，运行目录 16 种；仅排除 ID 1 测试鱼，团圆鱼（15）作为隐藏奖励保留，其余鱼种均有鱼体和鱼苗素材。 | `rules-summary.csv`、`catalog-fish.csv`、`catalog.generated.ts`、`state.test.ts` |
| CAT-05 | 工具目录 | 已实现 | 当前接入农牧场 91 个工具定义，并按独立物品类型保存化肥、鱼食、罐头、沙漏、武器、狗粮和看守用品。 | `catalog-tools.csv`、`catalog.generated.ts` |
| CAT-06 | 装扮目录 | 已实现 | 源配置农场 704 行、牧场 117 行，821 条定义全部保留在领域目录；629 项可售、187 项为可渲染隐藏装扮，5 项缺主素材。缺素材项仅兼容既有拥有记录，不可购买或装备。 | `rules-summary.csv`、`catalog-decorations.csv`、`catalog.generated.ts`、`state.test.ts` |
| CAT-07 | 作物与动物全部生长/生产状态素材 | 已实现 | 已导出并校验当前运行目录需要的阶段资产，运行时问题表为空。 | `runtime-catalog-assets.csv`、`runtime-catalog-issues.csv` |
| CAT-08 | 原版主场景、窗口和装饰素材 | 已实现 | 正式页面直接使用原 SWF，不再自行拆层重组主界面。 | `apps/web/public/assets/manor/v7-swf/` |
| CAT-09 | 音效和动画 | 已实现 | 4735 个源 SWF 全部进入运行目录；89 个专用动物音效 SWF 已逐项审计，88 个含有效音频，`s1038.swf` 明确登记为源占位。缺少音频文件的 4 种动物已关闭声音入口，庄园支持持久化静音。活动动画单独归 CAT-11。 | `swf-audio.csv`、`swf-audio-summary.csv`、Ruffle 运行时 |
| CAT-10 | 农场形象素材 | 已实现 | 原 XML 的 326 个有效形象 ID 与本地 PNG 一一对应，男 167 个、女 159 个，均为 140x226；目录已生成并进入运行时严格校验。源包另有 1 个有效插件 SWF、1 个 XML 和 1 个零字节废 SWF。 | `catalog-avatars.csv`、`catalog.generated.ts`、`state.test.ts` |
| CAT-11 | 活动素材 | 部分实现 | 181 个延后运营文件已登记；只有第 11 节列出的活动进入运行时。 | `categories.csv`；第 11 节 |
| CAT-12 | 旧经典版素材和早期拆图成果 | 放弃 | 不再作为修复或补图来源。 | D-01 |
| CAT-13 | 基线中已关闭或过期的配置能力 | 源残留 | 好友背包、限时特价、广告种子页、七夕链接、QQ 超市等在 V7 配置里已关闭或时间窗早已结束，不算可用源功能。 | `mcini_main` 的 `openControl`、`addon` 开关 |

## 5. 农场核心功能

| ID | 源项目功能 | 状态 | 当前实现与差异 | 主要协议/证据 |
| --- | --- | --- | --- | --- |
| FARM-01 | 初始农田和 24 块土地 | 已实现 | 新账号生成 24 块土地并按规则逐步开垦。 | `user_init.php`、`reclaim.ts` |
| FARM-02 | 金币开垦土地 | 已实现 | 等级、顺序和金币费用均由领域层校验。 | `user_reclaim*` |
| FARM-03 | 红土地升级 | 已实现 | 使用原金币规则，不提供 VIP 免费升级。 | `cgi_farm_upgrade`、D-08 |
| FARM-04 | 黑土地升级 | 已实现 | 使用原金币规则，元宝购买路径改为本地金币。 | `cgi_farm_upgrade_black`、`cgi_farm_shop_pay` |
| FARM-05 | 播种与土地适配 | 已实现 | 校验空地、种子库存、普通/红/黑土地要求。 | `farmlandstatus_planting` |
| FARM-06 | 多阶段离线生长 | 已实现 | 生长按确定性时间推进并映射原阶段素材。 | `advance.ts` |
| FARM-07 | 多季作物、成熟、枯萎和翻地 | 已实现 | 收获后进入下一季；最终季结束后翻地，有机会发现隐藏种子。 | `farmlandstatus_harvest/scarify` |
| FARM-08 | 浇水 | 已实现 | 自己和好友均可浇水，行为进入动态。 | `farmlandstatus_water` |
| FARM-09 | 除草与除虫 | 已实现 | 自己和好友可处理；好友动作原子更新双方存档。 | `clearweed/spraying` |
| FARM-10 | 放草和放虫 | 已实现 | 好友恶作剧有每日上限并影响最终产量。 | `scatterseed/pest`、`friend-actions.ts` |
| FARM-11 | 随机缺水、杂草和害虫事件 | 已实现 | 相同快照产生相同随机结果，便于恢复和测试。 | `advance.ts`、`state.test.ts` |
| FARM-12 | 周四下雨自动浇水 | 已实现 | 使用上海日期口径执行原周四降雨规则。 | `weather` 状态测试 |
| FARM-13 | 化肥和成长加速 | 已实现 | 普通、高速、极速等工具真实消耗库存；VIP 普通化肥不再无限免费。 | `farmlandstatus_fertilize`、D-08 |
| FARM-14 | 照料延误影响产量 | 已实现 | 生长速度不变，缺水/草/虫导致最终产量最多减半。 | `effectiveYield` |
| FARM-15 | 单块收获和即时画面更新 | 已实现 | 收获写入仓库并返回原客户端需要的字段。 | `farmlandstatus_harvest` |
| FARM-16 | 种子商店 | 已实现 | 等级、隐藏、VIP 分类保留；所有普通可重复购买种子使用金币。 | `usertool_getseedinfo`、`repertory_buyseed` |
| FARM-17 | 种子背包与卖出 | 已实现 | 支持查看、单项卖出和批量卖出，种子按原半价规则。 | `cgi_farm_seed_*` |
| FARM-18 | 蔬果仓库 | 已实现 | 支持单项和全部卖出；使用各作物实际售价。 | `repertory_sale/saleall` |
| FARM-19 | 产物锁定 | 已实现 | 锁定产物不会被单卖或全部卖出。 | `cgi_farm_set_lock` |
| FARM-20 | 农场工具和独立库存 | 已实现 | 化肥、鱼食、狗粮、武器等按类型保存，购买真实扣金币。 | `usertool_*`、`cgi_farm_shop_pay` |
| FARM-21 | 看门狗购买、切换、喂食和有效期 | 已实现 | 狗粮按金币购买；喂饱的看门狗可拦截偷窃并转移金币，时间到期停止工作。 | `dog_*`、`buy-farm-dog` |
| FARM-22 | 农场装扮购买、续期和启用 | 已实现 | 保留原装扮界面；元宝/VIP 免费选项改为金币，支持到期、续期和互斥部件。 | `item_*`、`cgi_farm_buyitem`、D-08 |
| FARM-23 | 告示牌 | 已实现 | 支持选择和取消审计过的告示牌。 | `set-board` |
| FARM-24 | 农场形象 | 已实现 | 原插件的男女切换、分页、预览、保存和取消继续使用；只接受 326 个本地形象 ID，选择结果持久化并在本人及好友农场展示。腾讯 QQ 秀、QQ 头像、商城和充值不属于本站形象功能，按 EXT-04、EXT-08 移除。 | `qqshow_*`、`set-avatar`、`catalog-avatars.csv` |
| FARM-25 | 鲜花加工和赠送 | 已实现 | 支持审计配方、材料扣减、留言卡、好友收花和删除记录。 | `user_case`、`cgi_farm_flower_*` |
| FARM-26 | 便便 + 红玫瑰加工化肥 | 已实现 | 原子扣除配方材料并增加化肥。 | `process-manure-fertilizer` |
| FARM-27 | 农场公告 | 部分实现 | 返回本地静态公告；没有管理员可编辑的动态公告系统。 | `user_getnotice` |
| FARM-28 | 好友操作自定义提示语 | 未实现 | 源工具页可分别设置浇水、除草、除虫、放草和放虫反馈；当前使用固定提示。 | `core/source/tools/mod/setting.php` |
| FARM-29 | 健康模式/防沉迷时间段 | 待确认 | 当前不限制游玩时间；源协议 `item_healthmode` 未重构。建议自用站点放弃，但尚未形成明确决定。 | `item_healthmode` |
| FARM-30 | 土地扩建基金 | 未实现 | 源功能可每账号一次领取 200000 金币扩建基金；常规开地已实现，但这笔限次奖励未接入。 | `cgi_farm_landext_fund`、`landExtPic.jpg` |
| FARM-31 | 飞机访问/分享动画 | 待确认 | 有 `plane_v_0.swf` 和分享图，但源 PHP 没有独立业务处理，尚不能确认是纯动画还是带奖励流程。 | `ui/plane_v_0.swf` |
| FARM-32 | “出售有机”窗口 | 待确认 | 有 `sellyouji_v_1.swf`，但源 PHP 与 XML 只声明素材，没有可复核的独立结算规则。 | `ui/sellyouji_v_1.swf` |

## 6. 鱼塘功能

| ID | 源项目功能 | 状态 | 当前实现与差异 | 主要协议/证据 |
| --- | --- | --- | --- | --- |
| FISH-01 | 开通鱼塘 | 已实现 | 每账号一次开通并持久化。 | `cgi_fish_register` |
| FISH-02 | 鱼苗商店和隐藏鱼 | 已实现 | 普通鱼苗按等级和金币购买；活动鱼不进入普通商店。 | `cgi_fish_list/buy` |
| FISH-03 | 鱼苗解锁 | 已实现 | 按原客户端协议记录解锁。 | `cgi_fish_unlock` |
| FISH-04 | 放鱼和容量 | 已实现 | 校验背包数量和鱼塘容量。 | `cgi_fish_plant` |
| FISH-05 | 多阶段成长 | 已实现 | 独立生长阶段和剩余时间，离线推进。 | `cgi_fish_index` |
| FISH-06 | 鱼食加速 | 已实现 | 普通鱼食等工具从独立库存消耗。 | `cgi_fish_fertilize` |
| FISH-07 | 捕鱼和成鱼仓库 | 已实现 | 成熟后捕鱼进入成鱼仓库，支持查看输出。 | `cgi_fish_harvest/output/user_rep/getall` |
| FISH-08 | 成鱼锁定和出售 | 已实现 | 支持锁定、单卖并按目录售价结算。 | `cgi_fish_rep_lock/sale` |
| FISH-09 | 好友偷鱼 | 已实现 | 每位好友限制、至少保留一半产量并原子更新双方。 | `cgi_fish_steal` |
| FISH-10 | 团圆鱼限次礼包 | 已实现 | 作为典礼礼包 type 3 一次性领取，不进入普通商店。 | `cgi_farm_ceremony_package` |
| FISH-11 | 鱼塘 NPC 教程 | 部分实现 | 本地教程图和 NPC SWF 可随原界面加载；原腾讯鱼塘说明页被禁止外链，没有独立本站教程页。 | `fish_tutorial.jpg`、`fishNPC1.swf`、D-10 |

## 7. 牧场核心功能

| ID | 源项目功能 | 状态 | 当前实现与差异 | 主要协议/证据 |
| --- | --- | --- | --- | --- |
| PAST-01 | 牧场初始化和进入 | 已实现 | 与平台账号共用存档和好友集合。 | `cgi_enter` |
| PAST-02 | 动物商店与分类 | 已实现 | 普通、VIP、餐厅专供等源分类可展示；隐藏活动动物不进入普通商店。 | `cgi_get_animals` |
| PAST-03 | 购买动物 | 已实现 | 校验等级、窝棚容量和金币；VIP 动物不再免费。 | `cgi_buy_animal`、D-08 |
| PAST-04 | 窝和棚 1–13 级升级 | 已实现 | 26 条升级规则完整接入并使用原金币价。 | `cgi_up_animalhouse*` |
| PAST-05 | 牧草饲料机 | 已实现 | 显示整数饲料量，动物成长消耗饲料。 | `cgi_get_food` |
| PAST-06 | 金币购买牧草并直接入饲料机 | 已实现 | 金币扣款和饲料增加同一事务。 | `cgi_buy_food` |
| PAST-07 | 购买牧草到背包再投喂 | 已实现 | 与直接加饲料机分离，不再误报背包没有牧草。 | `buy-grass-to-inventory` |
| PAST-08 | 农场牧草转牧场饲料 | 已实现 | 从共享农场产物背包转入，不重复扣金币。 | `feed-grass-from-inventory` |
| PAST-09 | 动物成长与饥饿 | 已实现 | 成长、饲料消耗、饥饿和离线推进持久化。 | `advance.ts` |
| PAST-10 | 罐头喂养 | 已实现 | 罐头单独存储并消耗，商店购买真实扣金币。 | `cgi_feedcan` |
| PAST-11 | 特殊作物喂养 | 已实现 | 自己和好友可喂指定特殊作物并推进成长。 | `cgi_feed_special` |
| PAST-12 | 成熟后手动拖入生产 | 已实现 | 成熟不会直接跳过生产；必须开始生产，生产期结束后收副产品。 | `cgi_post_product` |
| PAST-13 | 多轮生产次数 | 已实现 | 每轮生产、待收副产品和最大生产次数独立记录。 | `productionCount` |
| PAST-14 | 收取动物副产品 | 已实现 | 支持单只和批量收取并进入副产品仓库。 | `cgi_harvest_product` |
| PAST-15 | 生产完成后收获动物 | 已实现 | 生产次数用完后才能收获，成体进入独立仓库。 | `harvest-animals` |
| PAST-16 | 幼崽、成体和副产品仓库 | 已实现 | 三类库存分离，解决原客户端多个标签页空白问题。 | `cgi_get_repertory*` |
| PAST-17 | 卖副产品、幼崽和成体 | 已实现 | 支持单项和全部卖出，按类型正确结算。 | `cgi_sale_product`、`cgi_sale_cub`、`repertory_saleall` |
| PAST-18 | 捐赠动物 | 已实现 | 活体动物可捐赠并从场景移除。 | `cgi_donate_animal` |
| PAST-19 | 动物科研 | 已实现 | 按窝/棚启动研究、倒计时并领取幼崽。 | `cgi_pasture_animal_research` |
| PAST-20 | 科研沙漏 | 已实现 | 沙漏独立库存并缩短研究时间，购买真实扣金币。 | `cgi_pasture_use_hourglass` |
| PAST-21 | 便便产生和清理 | 已实现 | 每次只清一个可见便便；达到每日奖励上限后仍可清画面对象但不再领奖励。 | `cgi_help_pasture` |
| PAST-22 | 蚊子 | 已实现 | 好友每天最多放 25 只；自己/好友可拍蚊子并同步动态。 | `cgi_demolish_pasture`、`cgi_help_pasture` |
| PAST-23 | 老鼠 | 已实现 | 自己或好友可抓当前老鼠。 | `cgi_fight` |
| PAST-24 | 看守员购买、启用和工资 | 已实现 | 看守和工资均改为金币；到期停止工作。 | `cgi_buy_guard`、`cgi_active_guard` |
| PAST-25 | 牧场装扮购买、续期和启用 | 已实现 | 元宝和 VIP 免费路径统一改为金币。 | `cgi_get_items`、`cgi_buy_item`、`cgi_renew_item` |
| PAST-26 | 牧场欢迎队形 | 已实现 | 队形内容、样式和版本持久化。 | `cgi_get_parade/set_parade` |
| PAST-27 | 一键收获/批量操作 | 已实现 | 领域层支持按动物或全部收副产品、收获和售卖；原 SWF 是否显示由等级和配置控制。 | `collect-products`、`harvest-animals` |
| PAST-28 | 餐厅专供动物 | 部分实现 | 作为动物商店分类和普通养殖对象可用；QQ 餐厅联动、供货和餐厅进度未实现。 | `restaurantEnterCfg` |
| PAST-29 | 看守员台词和道具提示 | 未实现 | 核心购买、启停和工资见 PAST-24；源 `cgi_animal_tips` 的守卫台词和机器人提示没有返回。 | `cgi_animal_tips` |
| PAST-30 | 牧场公告 | 未实现 | 源项目有普通公告和带未读标记的公共公告；当前 `cgi_get_notice` 返回空数组、公共公告内容为空。 | `cgi_get_notice`、`cgi_farm_get_common_notice` |
| PAST-31 | 好友牧场状态提示 | 部分实现 | 当前 `cgi_get_exp` 只返回成功空状态；源项目会计算可生产、可偷、蚊子和野生动物等好友提示。 | `cgi_get_exp`、SOC-03 至 SOC-08 |
| PAST-32 | 科研 NPC 引导 | 已实现 | 原策略接口改为每账号一次的本地科研说明状态，不依赖远程策略服务。 | `cgi_fetch_strategy_rules` |
| PAST-33 | 牧场道具商店 | 已实现 | 罐头、沙漏、工资和武器按本地金币价展示并购买，独立库存真实扣款。 | `cgi_get_toollist`、`cgi_pasture_shop_pay` |
| PAST-34 | 好友背包 | 源残留 | 原配置 `pack open=false`，授权包没有完整可用流程；当前不把它列为待实现功能。 | `mcini_main` `openControl` |
| PAST-35 | 牧场限时特价 | 源残留 | 原 `sprice` 时间窗为 2010 年且无当前规则；普通商店仍按本地金币定价。 | `mcini_main` `openControl`、D-08 |

## 8. 野生动物与水晶

| ID | 源项目功能 | 状态 | 当前实现与差异 | 主要协议/证据 |
| --- | --- | --- | --- | --- |
| WILD-01 | 开启野生动物槽位 | 已实现 | 金币开槽并持久化。 | `cgi_farm_open_slot` |
| WILD-02 | 领养野生动物 | 已实现 | 校验类型和槽位，扣金币。 | `cgi_farm_adopt_beast` |
| WILD-03 | 在好友农/牧场放生 | 已实现 | 双方存档原子更新，记录剩余放生次数。 | `cgi_farm_raise_beast` |
| WILD-04 | 野生动物回归奖励 | 已实现 | 到期后领取回归收益。 | `cgi_farm_reward_beast` |
| WILD-05 | 捐赠野生动物 | 已实现 | 清空槽位并更新状态。 | `cgi_farm_donate_beast` |
| WILD-06 | 武器攻击和血量 | 已实现 | 普通攻击和武器伤害按审计规则结算，武器从独立库存消耗。 | `cgi_farm_attack_beast` |
| WILD-07 | 水晶掉落、拾取和仓库 | 已实现 | 战斗产生水晶，玩家或好友拾取后持久化。 | `cgi_farm_pickup_crystal/get_usercrystal` |
| WILD-08 | 水晶出售 | 已实现 | 按审计金币价值出售。 | `cgi_farm_sell_crystal` |
| WILD-09 | 人品值/昵称/主页状态 | 部分实现 | 返回本地可用状态；源社交展示细节未完全复刻。 | `cgi_farm_get_moralexp/beast_getnick/hpage_beast` |
| WILD-10 | 水晶祝福活动 | 未实现 | 有 `crystalBless_v_0.swf` 和 `cgi_pasture_crystal_blessing`，当前没有完整规则和奖励流程。 | 活动 SWF、源协议 |

## 9. 好友、留言、动态和排行

| ID | 源项目功能 | 状态 | 当前实现与差异 | 主要协议/证据 |
| --- | --- | --- | --- | --- |
| SOC-01 | QQ/Discuz 好友列表 | 特殊实现 | 所有已注册平台账号自动成为庄园好友。 | D-11、`getSocial` |
| SOC-02 | 农场和牧场统一好友 | 已实现 | 两端返回同一账号集合，修复原先列表不一致。 | `friend` 协议测试 |
| SOC-03 | 访问好友农场和牧场 | 已实现 | 可从两端打开好友场景并读取其真实存档。 | `user_run`、`cgi_enter` |
| SOC-04 | 好友照料 | 已实现 | 浇水、除草、除虫、开始动物生产和特殊喂养均原子更新。 | `friend-actions.ts` |
| SOC-05 | 偷作物 | 已实现 | 每季每好友一次、随机 1–5 个、至少保留 60%。 | `farmlandstatus_scrounge` |
| SOC-06 | 偷动物副产品 | 已实现 | 每轮每好友一次、每次 1 个、至少保留约一半。 | `cgi_steal_product` |
| SOC-07 | 偷鱼 | 已实现 | 有访客限制和产量保护。 | `cgi_fish_steal` |
| SOC-08 | 好友恶作剧 | 已实现 | 放草、放虫、放蚊子、便便清理和抓鼠有各自限制。 | 领域好友动作 |
| SOC-09 | 好友送花 | 已实现 | 包含花束、留言卡、接收记录和删除。 | `cgi_farm_flower_*` |
| SOC-10 | 留言板和回复 | 已实现 | 使用平台账号留言，最多读取 50 条，主人可清空。 | `chat_*`、`manor_guestbook` |
| SOC-11 | 农牧场动态 | 已实现 | 核心操作写入持久化活动流，可清空。 | `hydra_feeds_select`、`activities` |
| SOC-12 | 消费、成果和系统消息 | 部分实现 | 消费历史和部分成果来自真实状态；`fcg_ws_get_costfeeds`、部分 `feeds/sysmsg` 仍是空兼容响应。 | `flashCostHistory`、兼容桩 |
| SOC-13 | 农场/牧场排行 | 已实现 | 按平台所有庄园账号计算两个等级排行。 | `farmRanking`、`pastureRanking` |
| SOC-14 | 好友访问黑名单 | 已实现 | 主人可屏蔽/恢复指定账号，农场和牧场共同生效。 | `friendFilterUserIds` |
| SOC-15 | 手动好友申请和 QQ 好友同步 | 放弃 | 由平台账号全集替代。 | D-11 |
| SOC-16 | 召回好友、请求礼包和请求计数 | 未实现 | `recall_v_3.swf`、`cgi_farm_sendrequest`、`cgi_farm_request_list/recv` 只有关闭或空状态，未形成本站请求系统。 | 源活动模块 |
| SOC-17 | 分享到 QQ 空间、微博和外部动态 | 放弃 | 不向外部平台发 feed；仅保留站内动态。 | D-10 |
| SOC-18 | 交流论坛 | 放弃 | 入口删除，不复用 Discuz 论坛。 | D-14 |
| SOC-19 | 批量偷取作物 | 特殊实现 | 当前同一请求可处理多块土地，但不复刻源配置的固定批量偷取时段；每块地仍逐项校验偷取和保护规则。 | `batchStealHour`、`#stealMany` |

## 10. 经济、VIP、商店和市场

| ID | 源项目功能 | 状态 | 当前实现与差异 | 证据 |
| --- | --- | --- | --- | --- |
| ECO-01 | 金币账户 | 已实现 | 农牧场共用一套金币，所有购买和出售由服务端结算。 | `coins`、`charge` |
| ECO-02 | 元宝账户和充值工具 | 放弃 | 不保存可消费元宝，不保留充值页或 `[3].充值工具.exe` 对应能力。 | D-07 |
| ECO-03 | VIP 开通、续费、到期 | 放弃 | 不提供会员生命周期；所有账号固定 VIP。 | D-06、D-07 |
| ECO-04 | VIP 1–7 级和年费标识 | 特殊实现 | 客户端固定报告 7 级年费状态，不累积 VIP 经验。 | `FLASH_VIP_LEVEL/STATUS` |
| ECO-05 | VIP 每日礼包、签到和回归礼包 | 特殊实现 | 保留限次免费；按上海日期或账号一次性状态防止重复领取。 | D-09 |
| ECO-06 | VIP 无限免费化肥、装扮、种子、动物和升级 | 特殊实现 | 全部改为金币；客户端免费选项隐藏或只在接口价为 0 时可出现。 | `16c2e53`、D-08 |
| ECO-07 | VIP 半价工具 | 放弃 | 为避免全员 VIP 形成永久折扣，工具直接使用接口金币价。 | `ShopToolWindow.as` |
| ECO-08 | VIP 经验成长、过期和掉级 | 放弃 | 源 `speed` 是会员等级经验的每日增减，不是作物/动物成长加速；当前固定 7 级年费身份，不维护这套生命周期。 | `core/config/_vip.php`、`source/cron/vip.php`、D-06 |
| ECO-09 | 元宝商品本地金币定价 | 特殊实现 | 优先原金币价；仅元宝价按 `×1000` 转金币。 | `manorV7LocalCoinPrice` |
| ECO-10 | 标价与实际扣款一致 | 已实现 | Flash 目录和领域扣款共用同一定价函数，协议返回实际余额变化。 | 庄园服务端测试 |
| ECO-11 | 普通仓库出售 | 已实现 | 作物、种子、鱼、幼崽、成体、副产品和水晶都有独立规则。 | 领域测试 |
| ECO-12 | 玩家自由市场 | 未实现 | 源项目支持玩家挂单、撤单、部分成交和金币转账；当前没有市场表、页面或事务。 | `qqfarm_market`、`market_nc.php`、`market_mc.php` |
| ECO-13 | Discuz 积分与金币/元宝互换 | 放弃 | 平台没有对应论坛积分，也不应重新引入元宝。 | `core/source/tools/mod/exchange.php` |
| ECO-14 | 本地兑换码 | 特殊实现 | 新增 `MANOR2026`、`PASTURE2026`，每账号每码一次；不是源线上兑换系统的完整迁移。 | `rewards.ts` |
| ECO-15 | 消费记录 | 部分实现 | 当前活动流可生成主要消费记录；没有完整复刻源 `nclogs/mclogs` 的每种历史记录。 | `flashCostHistory` |
| ECO-16 | VIP 偷取开关 | 特殊实现 | 源后台可单独启用 VIP 偷取规则；全员固定 VIP 后不再区分该权限，所有账号使用同一套好友偷取规则。 | `_qsc.php`、D-06 |

## 11. 任务、签到、礼包与活动

| ID | 源项目功能 | 状态 | 当前实现与差异 | 证据 |
| --- | --- | --- | --- | --- |
| EVT-01 | 每日礼包 | 已实现 | 农场与牧场共享领取状态，每天一次。 | `feast_*`、`cgi_get_gifts/accept_gift` |
| EVT-02 | 每日签到翻牌 | 已实现 | 每个上海自然日两次，农牧场共享次数。 | `cgi_*login_*`、`cgi_signin` |
| EVT-03 | 连续签到 3/5/7 日奖励 | 已实现 | 奖励每个连续周期只领一次，断签重置连续天数。 | `claim-sign-in-streak-reward` |
| EVT-04 | 新手任务 | 已实现 | 10 步任务序列、接受、进度、完成和奖励持久化。 | `task_*`、`cgi_up_task` |
| EVT-05 | 累计庄园任务 | 已实现 | 浇水、收获、生产等累计任务与新手任务分离。 | `tasks` 状态 |
| EVT-06 | 等级升级礼包 | 已实现 | 农场和牧场分别追踪，1–30 级每级只领一次。 | `cgi_levelup` |
| EVT-07 | VIP 回归礼包 | 已实现 | 每账号一次，包含普通和 VIP 奖励。 | `cgi_return_gift` |
| EVT-08 | Lovesday 情人节活动 | 特殊实现 | 长期开启；接入活动作物、动物和 99 件九倍出售。 | D-15 |
| EVT-09 | 万圣节糖果/饼干好友投放 | 已实现 | 农场与牧场两条投放线、每日限制、种子/动物和狂欢礼包均持久化。 | `cgi_putin`、`cgi_pasture_activity` |
| EVT-10 | 万圣节入口协议别名 | 特殊实现 | 源 `qixiflag` 等旧名字被当前 SWF 用作万圣活动状态，按实际客户端需求响应，不代表完整七夕活动。 | `#halloweenBoxStatus` |
| EVT-11 | 春节 VIP 礼包 | 已实现 | 每日一次领取金条树种子和金兔子。 | `cgi_pasture_chunjie/checkbitmap` |
| EVT-12 | 中秋/国庆典礼礼包 | 部分实现 | 状态面板可用，只接入 type 3 团圆鱼礼包；其它礼包类型返回未接入。 | `cgi_fetch_package_flags`、`cgi_farm_ceremony_package` |
| EVT-13 | 季节动物掉落和好友领养 | 已实现 | 生成三类活动动物、好友领养和原子成本规则已接入。 | `cgi_pasture_create/adopt_animal` |
| EVT-14 | 4 月 1 日水晶兑换活动 | 未实现 | 源 `cgi_farm_activity` 可用指定水晶兑换 3 种种子和 3 种动物；当前没有兑换流程。 | `AprilFoolNPC.swf`、`cgi_farm_activity` |
| EVT-15 | 万圣夜金币抽奖 | 未实现 | 源功能每天 3 次、每次消耗 1000 金币，随机给种子、鱼苗、经验、金币、元宝或临时狗；与 EVT-09 的糖果/饼干活动不是同一套。 | `cgi_farm_halloweeneve_initview/bonus` |
| EVT-16 | 感恩节礼包与放生活动 | 未实现 | 包含一次性农牧礼包，以及连续天数、每日好友放生次数和升级奖励两条流程。 | `thanksgiving.swf`、`cgi_get_thanks_package`、`cgi_farm_thanksgiving_*` |
| EVT-17 | 圣诞/元旦卡片兑换 | 未实现 | 源 `task_activity` 定义 6 种卡片组合礼包，奖励种子、动物、装扮和金币；当前未接入卡片库存与兑换。 | `christmas.swf`、`task_activity/checkbitmap` |
| EVT-18 | 春节送福抽奖 | 未实现 | EVT-11 只覆盖固定春节礼包；送福抽奖中的本地种子、动物、金币、狗和装扮尚未接入。黄钻和 QQ 秀奖品按 D-07 放弃。 | `sendbless_v_0.swf`、`sendblessopen` 配置 |
| EVT-19 | 牧场中秋活动 | 未实现 | 有独立牧场中秋模块；除 EVT-12 的团圆鱼典礼礼包外，没有重构其它玩法。 | `midAutumnPasture_v_3.swf` |
| EVT-20 | 秋季活动 | 未实现 | 有 `autumn_v_1.swf` 和活动礼图，没有可完成的当前流程。 | 活动 SWF |
| EVT-21 | 水晶祝福 | 未实现 | 参见 WILD-10。 | `crystalBless_v_0.swf` |
| EVT-22 | 烟花/爆竹活动 | 未实现 | 农场和牧场均有 2012 爆竹模块，当前未接入本地奖励链。外部领奖链接按 D-10 放弃。 | `farmfirecraker2012_v_0.swf`、`pasturefirecraker2012_v_0.swf` |
| EVT-23 | 月初/月末活动 | 未实现 | 牧场月初和农场月末模块有固定时间窗、分享图和活动入口，当前未接入。 | `monthBegin_v_0.swf`、`monthEnd_v_5.swf` |
| EVT-24 | 单身节每日礼包 | 未实现 | 源功能每天可领 11 个编号 602 种子；当前未接入。 | `singleFes_v_0.swf`、`cgi_farm_guang_gun` |
| EVT-25 | 免费礼物请求 | 未实现 | 13 种免费礼物目录存在，但发请求、列表和领取的源处理文件不完整；当前统一返回关闭状态。 | `freegift_v_5.swf`、`cgi_farm_request_*` |
| EVT-26 | Qzone 礼包 | 放弃 | 依赖 QQ 空间请求/分享；不改造成本站功能。 | `qzonegift_v_0.swf`、D-10 |
| EVT-27 | 翻牌小游戏 | 未实现 | 有 27 档农场奖品、22 档牧场奖品和翻牌窗口，但授权包没有完整服务端领取规则，当前不发奖。 | `CardsGameWindow_v_0.swf`、`cardsGameRewards` |
| EVT-28 | 七夕翻牌窗口 | 源残留 | XML 声明 `Tanabatas_v_0.swf`，但授权素材包中缺少该文件，也没有完整服务端规则。 | `nc_addon.php`、`files.csv` |
| EVT-29 | 股票活动 | 放弃 | `stocks_v_2.swf` 指向腾讯外部活动，不进入本站。 | D-10 |
| EVT-30 | Intel 联动活动 | 放弃 | 外部品牌联动模块只保留素材台账，不进入产品。 | `mcini_main_v_20120209.xml` |
| EVT-31 | 腾讯管家活动 | 放弃 | `houseKeeper_v_1.swf` 及其外链不接入；`cgi_farm_housekeeper` 在源入口声明但没有处理文件。 | D-10、`source-protocols.csv` |
| EVT-32 | 召回好友活动 | 未实现 | 参见 SOC-16；若未来做，应改为站内账号召回，不使用 QQ 请求。 | `recall_v_3.swf` |
| EVT-33 | 植树节秘密作物活动 | 未实现 | 源任务按 5 种指定作物各 200 个兑换银杏种子和整套装扮，当前未接入。 | `source/nc/mission/0312_*` |
| EVT-34 | 小丑寻宝/捉迷藏 | 未实现 | 源 0415 和 0520 活动在成熟好友农场随机出现小丑，每日最多 3 次，奖励金币、种子、化肥或装扮。 | `source/nc/mission/0415_*`、`0520_*` |
| EVT-35 | 年末抽奖 | 未实现 | XML 有本地虚拟奖和实物/外部代金券两类；本地奖尚未接入，实物和外链奖明确放弃。 | `yearEndAwards`、D-10 |
| EVT-36 | 新年标志接口 | 源残留 | `cgi_farm_newyear_getflag` 只固定返回活动未开启；独立新年 SWF 和旧红包片段不足以构成完整流程。 | `newyear.swf`、`year_gift.php` |
| EVT-37 | QQ 秀/祝福中的会员、QQ 秀奖励 | 放弃 | 不发放黄钻、QQ 秀或腾讯账号权益；本地奖品仅按 EVT-18 单独评估。 | `sendblessopen` 配置、D-07 |
| EVT-38 | 定时动态 NPC | 源残留 | `feedsNPC` 只有 2012 年固定出现时刻、头像和 SWF 素材，没有随包可复核奖励处理，当前不列入活动待办。 | `fstTimeFeedsNPC` 等配置、`feedsNPC_v_0.swf` |

## 12. 原项目工具页与运营后台

这些页面属于源项目配套系统，不应与玩家在 SWF 内的游戏循环混为一谈。

| ID | 源项目功能 | 状态 | 当前实现与差异 | 证据 |
| --- | --- | --- | --- | --- |
| TOOL-01 | 金币、最近访问、农场经验和牧场经验排行 | 部分实现 | 改为站内实时农场/牧场等级排行；没有单独的金币榜和最近访问榜，不保留旧 PHP 工具页。 | `tools/mod/top.php`、SOC-13 |
| TOOL-02 | 积分兑换工具页 | 放弃 | 依赖 Discuz 积分和元宝，参见 ECO-13。 | `tools/mod/exchange.php` |
| TOOL-03 | 游戏帮助页 | 未实现 | 当前依赖原 SWF 内说明和商品描述，没有独立完整帮助中心。 | `tools/mod/help.php` |
| TOOL-04 | 玩家提示语设置 | 未实现 | 源页面可修改提示文本；当前无对应设置。 | `tools/mod/setting.php` |
| TOOL-05 | VIP 管理页 | 放弃 | 固定全员 VIP，不提供开通、续费或到期管理。 | `tools/mod/vip.php` |
| TOOL-06 | 农场玩家市场 | 未实现 | 参见 ECO-12。 | `tools/mod/market_nc.php` |
| TOOL-07 | 牧场玩家市场 | 未实现 | 参见 ECO-12。 | `tools/mod/market_mc.php` |
| ADMIN-01 | 后台环境、版本和用户统计首页 | 未实现 | Party Games 没有庄园专属运营统计页。 | `admin/mod/home.php` |
| ADMIN-02 | 系统开关、初始资源、好友数量和隐藏目录配置 | 部分实现 | 初始状态和隐藏目录在代码/生成目录中固定；测试工具可发资源，但没有运行时管理 UI。 | `admin/mod/system.php` |
| ADMIN-03 | 公告编辑 | 未实现 | 当前只有本地静态公告。 | `admin/mod/notice.php` |
| ADMIN-04 | 作物、动物、鱼、工具和装扮在线编辑 | 特殊实现 | 改为从授权源构建受版本控制的只读目录；修改需代码审计、生成和测试，不允许运行时改表。 | `catalog-*.csv`、`catalog.generated.ts` |
| ADMIN-05 | 用户列表、编辑和删除庄园数据 | 未实现 | 平台账号系统负责身份；没有庄园专属存档管理页。 | `admin/mod/user_*` |
| ADMIN-06 | 批量发金币、元宝、经验和礼包 | 特殊实现 | 只保留本地 owner 测试工具，元宝不支持，正式环境默认关闭。 | `admin/mod/quick.php`、D-12 |
| ADMIN-07 | 全服管理员留言 | 未实现 | 当前留言板是玩家之间的庄园留言，没有管理员群发。 | `admin/mod/quick.php` |
| ADMIN-08 | 缓存清理 | 放弃 | TypeScript/SQLite 架构不使用源 PHP 文件缓存。 | `admin/mod/quick.php` |
| ADMIN-09 | 清空日志、便便、蚊子和仓库 | 未实现 | 没有正式后台批量数据修改；测试工具只处理当前 owner。 | `admin/mod/quick.php` |
| ADMIN-10 | 旧数据修复脚本 | 放弃 | 不迁移旧存档，因此不运行 PHP 数据修复。 | D-04 |
| ADMIN-11 | 从腾讯服务器同步 XML、SWF 和目录 | 放弃 | 运行时只读仓库内审计素材，不在线拉腾讯资源。 | `admin/mod/syncdata.php` |
| ADMIN-12 | 模板、Flash 播放器和压缩方式选择 | 放弃 | 当前前端、Ruffle 和构建流程固定，不提供运行时切换。 | `admin/mod/system.php` |
| ADMIN-13 | 插件安装、升级和卸载 | 放弃 | 不部署 Discuz 插件和源 PHP 数据库。 | `install.php`、`upgrade.php`、`uninstall.php` |
| ADMIN-14 | 全站开关、关闭原因和维护模式 | 未实现 | 源后台可暂停庄园并显示说明；当前没有运行时开关。 | `admin/mod/system.php`、PLAT-16 |
| ADMIN-15 | 初始金币、元宝和农牧经验配置 | 特殊实现 | 初始资源由版本化状态初始化代码固定；元宝被删除，没有运行时后台表单。 | `admin/mod/system.php`、D-03、D-07 |
| ADMIN-16 | 好友来源、上限、头像和活动选择配置 | 特殊实现 | 好友固定为平台账号全集，头像取平台资料，活动由代码/配置版本控制，不提供运行时切换。 | `admin/mod/system.php`、D-11 |
| ADMIN-17 | 每日次数、天气和 VIP 计划任务 | 特殊实现 | 每日限制和周四雨天由确定性状态推进替代；VIP 到期/经验 cron 按全员固定 VIP 决策放弃。 | `source/cron/*.php`、PLAT-15、D-06 |
| ADMIN-18 | 批量赠送种子、鱼、产品、水晶、工具、动物和装扮 | 部分实现 | owner 测试工具仅能给当前账号发一组测试资源，不能像源 `quick_gift.php` 给全服发完整目录物品。 | `admin/mod/quick_gift.php`、D-12 |

## 13. 外部服务与旧站入口

| ID | 外部能力 | 状态 | 当前处理 |
| --- | --- | --- | --- |
| EXT-01 | QQ/Qzone 登录 | 放弃 | 平台账号替代。 |
| EXT-02 | QQ 好友同步和好友管理页 | 放弃 | 平台账号全集替代。 |
| EXT-03 | QQ 空间动态、微博和分享 | 放弃 | 只写站内庄园动态。 |
| EXT-04 | QQ 秀、QQ 头像和会员奖励 | 放弃 | 不读写腾讯账号权益。 |
| EXT-05 | QQ 相册截图 | 放弃 | 替换为浏览器本地 PNG。 |
| EXT-06 | QQ 餐厅联动 | 放弃 | 餐厅专供动物可养殖，但不跳转或同步餐厅。 |
| EXT-07 | 腾讯管家 | 放弃 | 外链和活动关闭。 |
| EXT-08 | 腾讯支付、元宝充值和黄钻开通 | 放弃 | 入口、协议和外链关闭。 |
| EXT-09 | 腾讯广告、拍拍和合作专区 | 放弃 | 不展示、不跟踪、不跳转。 |
| EXT-10 | Discuz 论坛和原项目交流论坛 | 放弃 | 入口删除。 |
| EXT-11 | 原项目版本检查和下载站 | 放弃 | 不访问外部更新地址。 |
| EXT-12 | 腾讯远程素材与配置同步 | 放弃 | 使用仓库固定版本和哈希。 |
| EXT-13 | QQ 农场磨坊/加工坊应用 | 放弃 | 源 XML 只保留外部 appid 376，没有随包业务模块；不接入其它应用。 |
| EXT-14 | QQ 超市联动 | 放弃 | 只剩等级/会员开关配置，不接入腾讯外部应用。 |
| EXT-15 | 年末实物奖、邮寄信息和外部代金券 | 放弃 | 不采集邮寄资料，不兑现实物或第三方优惠券；本地虚拟奖见 EVT-35。 |
| EXT-16 | 腾讯点击流和用户行为统计 | 放弃 | 不发送 PGV/UA 上报；`cgi_ua_stat` 仅作关闭兼容。 |
| EXT-17 | 百度等外部音乐播放器 | 放弃 | 不加载源模板配置的第三方播放器；SWF 内可兼容音效按 CAT-09 处理。 |

## 14. 协议级覆盖附录

本节按源入口 `core/mync.php` 与 `core/mymc.php` 的允许模块归并。一个源模块可能由当前适配器的
`mod + act` 组合处理；下列状态以玩家功能为准，不以字符串是否同名为准。全部 232 个唯一允许模块、
处理文件存在性和重复声明都在 `source-protocols.csv`，因此本节可以按功能归组而不丢失精确模块账本。

### 14.1 农场协议组

| 状态 | 协议组 | 对应功能 |
| --- | --- | --- |
| 已实现 | `farmlandstatus_planting`、`farmlandstatus_water`、`farmlandstatus_clearweed`、`farmlandstatus_spraying`、`farmlandstatus_pest`、`farmlandstatus_scatterseed`、`farmlandstatus_scrounge`、`farmlandstatus_fertilize`、`farmlandstatus_getoutput`、`farmlandstatus_harvest`、`farmlandstatus_scarify` | FARM-05 至 FARM-15、SOC-04 至 SOC-08 |
| 已实现 | `repertory_buyseed`、`repertory_getseedinfo`、`repertory_getuserseed`、`repertory_sale`、`repertory_saleall`、`cgi_farm_seed_list`、`cgi_farm_seed_sell`、`cgi_farm_getusercrop`、`cgi_farm_set_lock` | FARM-16 至 FARM-20 |
| 已实现 | `usertool_getseedinfo`、`usertool_gettools`、`usertool_buytool`、`cgi_farm_buyweapon` | FARM-16、FARM-20、WILD-06 |
| 已实现 | `user_run`、`user_reclaim`、`user_reclaimpay`、`user_getnotice`、`user_received`、`user_case`、`cgi_farm_upgrade`、`cgi_farm_upgrade_black` | FARM-01 至 FARM-04、FARM-25、FARM-27 |
| 已实现 | `item_shop`、`item_getuseritems`、`item_activeitem`、`item_deactiveitem`、`cgi_farm_buyitem`、`cgi_farm_item_vip`、`qqshow_activeitem`、`qqshow_deactiveitem`、`user_qqshow` | 装扮和 326 项本地农场形象均已接入，见 FARM-22 至 FARM-24；腾讯外部形象与支付体系按 EXT-04、EXT-08 放弃。 |
| 已实现 | `dog_feedmoney` | FARM-21 |
| 已实现 | `cgi_fish_register`、`cgi_fish_index`、`cgi_fish_harvest`、`cgi_fish_buy`、`cgi_fish_list`、`cgi_fish_unlock`、`cgi_fish_user_rep`、`cgi_fish_plant`、`cgi_fish_rep_lock`、`cgi_fish_sale`、`cgi_fish_output`、`cgi_fish_steal`、`cgi_fish_fertilize`、`cgi_fish_getall` | FISH-01 至 FISH-10 |
| 已实现/部分 | `cgi_farm_get_userbeast`、`cgi_farm_open_slot`、`cgi_farm_get_moralexp`、`cgi_farm_adopt_beast`、`cgi_farm_raise_beast`、`cgi_farm_reward_beast`、`cgi_farm_donate_beast`、`cgi_farm_attack_beast`、`cgi_farm_get_usercrystal`、`cgi_farm_sell_crystal`、`cgi_farm_pickup_crystal`、`cgi_farm_hpage_beast`、`cgi_farm_beast_getnick` | WILD-01 至 WILD-09；社交展示细节仍为部分实现 |
| 已实现/部分 | `chat_getallinfo`、`chat_sendchat`、`chat_clearchat`、`chat_clearlog`、`friend`、`cgi_farm_getstatus_filter` | 留言和好友可用；部分日志清理协议是兼容响应，见 SOC-10 至 SOC-14 |
| 已实现/部分 | `feast_getpackagelist`、`feast_getpackage`、`feast_levelup`、`task_accept`、`task_update`、`cgi_farm_login_home`、`cgi_farm_login_click`、`cgi_pasture_signin`、`cgi_return_gift` | EVT-01 至 EVT-07；`feast_levelup` 只负责升级提示 |
| 已实现/部分 | `cgi_farm_flower_send`、`cgi_farm_flower_received`、`cgi_farm_flower_get_card`、`cgi_farm_flower_del_msg`、`cgi_farm_exchange`、`sysmsg_select`、`hydra_feeds_select`、`hydra_feeds_delete` | FARM-25、SOC-11、SOC-12、ECO-15 |
| 已实现/部分 | `cgi_fetch_package_flags`、`cgi_farm_ceremony_package`、`cgi_pasture_{chunjie,checkbitmap}`、`cgi_farm_checkbitmap` | EVT-11、EVT-12 |
| 已实现/特殊 | `cgi_farm_halloween`、`cgi_farm_get_halloweenseed`、`cgi_farm_qixiflag`、`cgi_pasture_activity`、`cgi_putin` 及 `xiaoyou` 别名 | EVT-09、EVT-10 |
| 部分实现 | `feeds_select`、`feeds_delete`、`hydra_feeds_select`、`hydra_feeds_delete`、`sysmsg_select`、`fcg_ws_get_costfeeds` | 站内动态可用，但部分源消息类别为空兼容桩，见 SOC-12 |
| 部分实现 | `cgi_farm_request_count`、`request_get_count` | 只返回关闭/零计数，见 SOC-16 |
| 未实现 | `cgi_farm_sendrequest`、`cgi_farm_request_list`、`cgi_farm_request_gift_recv` | SOC-16、EVT-25 |
| 未实现 | `item_healthmode` | FARM-29 |
| 源残留 | `user_welcome`、`user_costfeeds`、`user_checkstatus` | 源处理本身为空或固定成功，真正的提示设置见 FARM-28 |
| 未实现 | `cgi_farm_landext_fund` | FARM-30 |
| 未实现 | `cgi_farm_activity`、`cgi_farm_halloweeneve_initview`、`cgi_farm_halloweeneve_bonus`、`cgi_get_thanks_package`、`cgi_farm_guang_gun`、`cgi_farm_thanksgiving_initview`、`cgi_farm_thanksgiving_setfree` | EVT-14 至 EVT-24 |
| 未实现 | `task_activity`、`task_checkbitmap`、`task_npc` | EVT-17、EVT-33、EVT-34 |
| 特殊实现 | `task_halloween`、`task_halloweenseed`、`task_qixiflag`、`task_putin` | 对应玩家功能由当前 `cgi_*`/`xiaoyou*` 活动协议承接，见 EVT-09、EVT-10 |
| 源残留 | `cgi_farm_newyear_getflag`、`view_fcg`、`fcg_ws_get_costfeeds` | 源端原本就是固定关闭、演示或空响应，见 EVT-36、14.3 |
| 特殊实现/放弃 | `gb_buy`、`cgi_farm_shop_verify`、`cgi_farm_shop_pay`、`shop_verify` | 商品改金币购买；充值/外部支付关闭，见 ECO-02、ECO-09 |
| 特殊实现 | `cgi_ws_com`、`cgi_register` | 手动开通流程改为首次访问自动初始化，见 PLAT-19 |
| 已实现 | `cgi_fetch_strategy_rules` | PAST-32 |
| 放弃 | `cgi_farm_housekeeper` | 腾讯管家活动及外链不接入，见 EVT-31 |
| 放弃 | `cgi_ua_stat`、外部 feed/share、论坛和广告协议 | D-10、EXT-03、EXT-09、EXT-10 |

### 14.2 牧场协议组

| 状态 | 协议组 | 对应功能 |
| --- | --- | --- |
| 已实现 | `cgi_enter`、`cgi_get_animals`、`cgi_buy_animal`、`cgi_raise_cub` | PAST-01 至 PAST-04 |
| 已实现 | `cgi_get_food`、`cgi_buy_food`、`cgi_feed_food`、`cgi_feedcan`、`cgi_feed_special` | PAST-05 至 PAST-11 |
| 已实现 | `cgi_post_product`、`cgi_harvest_product`、`cgi_steal_product` | PAST-12 至 PAST-15、SOC-06 |
| 已实现 | `cgi_get_repertory`、`cgi_get_repertory_animal`、`cgi_get_package`、`cgi_sale_product`、`cgi_sale_cub`、`cgi_donate_animal` | PAST-16 至 PAST-18 |
| 部分实现 | `repertory_sale`、`repertory_saleall` | 核心售卖由 `cgi_sale_product`/`cgi_sale_cub` 完成；这两个源别名没有独立适配。 |
| 已实现 | `cgi_up_animalhouse`、`cgi_up_animalhouse_query`、`cgi_pasture_animal_research`、`cgi_pasture_use_hourglass` | PAST-04、PAST-19、PAST-20 |
| 已实现 | `cgi_help_pasture`、`cgi_demolish_pasture`、`cgi_fight` | PAST-21 至 PAST-23 |
| 已实现 | `cgi_buy_guard`、`cgi_get_userguard`、`cgi_active_guard`、`cgi_hide_guard` | PAST-24 |
| 已实现 | `cgi_get_items`、`cgi_get_useritem`、`cgi_buy_item`、`cgi_renew_item`、`cgi_active_item` | PAST-25 |
| 已实现 | `cgi_get_parade`、`cgi_set_parade` | PAST-26 |
| 已实现/部分 | `cgi_farm_get_userbeast`、`cgi_farm_open_slot`、`cgi_farm_get_moralexp`、`cgi_farm_adopt_beast`、`cgi_farm_raise_beast`、`cgi_farm_reward_beast`、`cgi_farm_donate_beast`、`cgi_farm_attack_beast`、`cgi_farm_get_usercrystal`、`cgi_farm_sell_crystal`、`cgi_farm_pickup_crystal`、`cgi_farm_hpage_beast`、`cgi_farm_beast_getnick` | WILD-01 至 WILD-09 |
| 已实现/部分 | `chat_clearchat`、`chat_getallinfo`、`chat_sendchat`、`friend`、`cgi_get_user_info`、`cgi_clear_log`、`cgi_get_exp` | 留言、好友和日志可用；好友状态提示仅返回空标志，见 PAST-31、SOC-01 至 SOC-14 |
| 已实现 | `cgi_pasture_login_home`、`cgi_pasture_login_click`、`cgi_signin`、`cgi_get_gifts`、`cgi_accept_gift`、`cgi_return_gift`、`cgi_up_task_1`、`cgi_up_task_2` | EVT-01 至 EVT-07 |
| 已实现/特殊 | `cgi_farm_halloween`、`cgi_farm_get_halloweenseed`、`cgi_farm_qixiflag`、`cgi_pasture_activity`、`cgi_putin` | EVT-09、EVT-10 |
| 已实现 | `cgi_pasture_create_animal`、`cgi_pasture_adopt_animal` | EVT-13 |
| 已实现/部分 | `cgi_pasture_chunjie`、`cgi_pasture_checkbitmap`、`cgi_fetch_package_flags`、`cgi_farm_ceremony_package` | EVT-11、EVT-12 |
| 部分实现 | `cgi_get_rep_history`、`cgi_farm_exchange`、`fcg_ws_get_costfeeds`、`sysmsg_select` | SOC-12、ECO-15 |
| 已实现 | `cgi_fetch_strategy_rules` | PAST-32 |
| 已实现 | `cgi_get_toollist` | PAST-33 |
| 未实现 | `cgi_animal_tips`、`cgi_get_notice`、`cgi_farm_get_common_notice` | PAST-29、PAST-30 |
| 未实现 | `cgi_pasture_crystal_blessing` | WILD-10 |
| 未实现 | `cgi_farm_activity`、`cgi_get_thanks_package` 及未被当前活动状态覆盖的旧节日分支 | EVT-14 至 EVT-28 |
| 特殊实现 | `cgi_ws_com` | 手动开通资格被自动初始化替代，见 PLAT-19 |
| 特殊实现/放弃 | `gb_buy`、`cgi_pasture_shop_pay`、`cgi_farm_shop_verify`、`shop_verify` | 商品改金币购买；充值/外部支付关闭，见 ECO-02、ECO-09 |
| 放弃 | QQ 餐厅、QQ 好友、QQ 秀、分享和外部活动入口 | EXT-02 至 EXT-09 |

### 14.3 源协议异常与占位桩

这些是授权源包自身的结构问题，不等同于当前项目缺陷。后续不能以“源文件存在”推断该功能在 V7 包里可用。

| 类型 | 数量 | 精确模块 | 当前判定 |
| --- | ---: | --- | --- |
| 农场允许但缺处理文件 | 7 | `cgi_farm_flower_del_msg`、`cgi_farm_housekeeper`、`cgi_farm_request_gift_recv`、`cgi_farm_sendrequest`、`cgi_return_gift`、`repertory_getseedinfo`、`tool_list` | 删除赠花记录、回归礼包和种子商店已由本站处理；管家活动放弃；请求礼包未实现；`tool_list` 视为残留别名。 |
| 牧场允许但缺处理文件 | 4 | `cgi_farm_get_halloweenseed`、`cgi_farm_halloween`、`cgi_putin`、`cgi_return_gift` | 前三项实际处理文件使用 `xiaoyou*` 别名，本站同时兼容两种名称；回归礼包由本站重构。 |
| 农场有文件但入口不允许 | 15 | `cgi_farm_shop_pay11`、`friend_1-3`、`item_buy`、`item_vip`、`pasture_checkbitmap`、`pasture_chunjie`、`repertory_getusercrop`、`seed_list`、`seed_sell`、`set_lock`、`user_card`、`user_del`、`user_exchange`、`user_send`、`user_upgrade` | 多为旧别名、备份版本或被新协议替换的处理文件，不能作为独立可达功能。 |
| 牧场有文件但入口不允许 | 5 | `xiaoyoucgi_farm_get_halloweenseed`、`xiaoyoucgi_farm_halloween`、`xiaoyoucgi_farm_qixiflag`、`xiaoyoucgi_pasture_activity`、`xiaoyoucgi_putin` | 属于校友平台别名；源入口声明与文件名不一致，本站按实际 SWF 请求兼容。 |
| 重复声明 | 5 | 农场 `cgi_farm_beast_getnick`、`cgi_farm_guang_gun`、`usertool_getseedinfo`；牧场 `cgi_farm_qixiflag`、`cgi_pasture_activity` | 只按一个唯一协议统计，不产生额外功能。 |

以下协议在源 PHP 中本来就是空值、固定关闭值、静态演示数据或统计桩：`cgi_ua_stat`、`request_get_count`、
`user_checkstatus`、`user_welcome`、`user_costfeeds`、`view_fcg`、`cgi_farm_newyear_getflag`、`fcg_ws_get_costfeeds`、
`sysmsg_select` 和 `cgi_farm_request_list`。其中消息中心已被本站部分重构；其余不应仅因返回了成功码就标成“已实现”。

## 15. 状态索引与剩余差异

本节是后续排期和复查入口。所有 ID 都能回到第 3–13 节的详细功能行；不得只看本节标题推断实现范围。

### 15.1 未实现（35 项）

| 分类 | 稳定 ID | 当前缺口 |
| --- | --- | --- |
| 平台运行 | PLAT-16 | 庄园全站维护开关和关闭原因。 |
| 农场 | FARM-28、FARM-30 | 好友操作自定义提示语；一次性土地扩建基金。 |
| 牧场与野生动物 | PAST-29、PAST-30、WILD-10 | 看守员台词/机器人提示；牧场公告；水晶祝福。 |
| 社交与经济 | SOC-16、ECO-12 | 站内召回/请求礼包；玩家自由市场。 |
| 节日与活动 | EVT-14、EVT-15、EVT-16、EVT-17、EVT-18、EVT-19、EVT-20、EVT-21、EVT-22、EVT-23、EVT-24、EVT-25、EVT-27、EVT-32、EVT-33、EVT-34、EVT-35 | 水晶兑换、万圣夜抽奖、感恩节、卡片兑换、送福、牧场中秋、秋季、爆竹、月初/月末、单身节、免费礼物、翻牌、召回、植树节、小丑寻宝和年末本地奖。 |
| 玩家工具页 | TOOL-03、TOOL-04、TOOL-06、TOOL-07 | 独立帮助中心、提示语设置、农场市场和牧场市场。 |
| 运营能力 | ADMIN-01、ADMIN-03、ADMIN-05、ADMIN-07、ADMIN-09、ADMIN-14 | 运营统计、公告编辑、存档管理、全服留言、批量数据处理和维护模式。 |

### 15.2 待确认（3 项）

| 稳定 ID | 能力 | 需要确认的证据或决定 |
| --- | --- | --- |
| FARM-29 | 健康模式 | 是否需要为自用站点保留游玩时段限制。 |
| FARM-31 | 飞机访问/分享动画 | 需要继续反编译或运行，确认是否只有动画，是否存在本地奖励规则。 |
| FARM-32 | “出售有机”窗口 | 需要继续反编译，确认它与普通售卖的真实差异和结算规则。 |

### 15.3 部分实现（12 项）

| 分类 | 稳定 ID | 尚未覆盖的主要差异 |
| --- | --- | --- |
| 活动素材 | CAT-11 | 未启用活动没有逐项运行验收。 |
| 农场与鱼塘 | FARM-27、FISH-11 | 公告不可运营编辑；鱼塘没有独立本站教程页。 |
| 牧场与野生动物 | PAST-28、PAST-31、WILD-09 | QQ 餐厅联动被排除；好友牧场状态提示和野生动物社交细节不完整。 |
| 消息与经济 | SOC-12、ECO-15 | 成果、消费、系统消息及所有历史记录类别没有完整复刻。 |
| 活动 | EVT-12 | 典礼礼包只接入团圆鱼 type 3。 |
| 工具与运营 | TOOL-01、ADMIN-02、ADMIN-18 | 缺金币/最近访问榜；没有运行时系统配置 UI；测试工具不能全服发完整目录物品。 |

### 15.4 特殊实现（23 项）

这些不是待修复的缺陷，而是已确认的本地化替代。修改前必须先复核第 2 节产品决策。

| 分类 | 稳定 ID | 本地化原则 |
| --- | --- | --- |
| 平台与运行时 | PLAT-03、PLAT-05、PLAT-08、PLAT-10、PLAT-13、PLAT-14、PLAT-15、PLAT-19 | SQLite 版本化存档、Ruffle、本地截图、owner 测试工具、本地 XML/桥接、确定性每日重置和自动开通。 |
| 社交 | SOC-01、SOC-19 | 平台账号全集作为好友；批量偷取仍逐块校验，不复刻固定活动时段。 |
| VIP 与经济 | ECO-04、ECO-05、ECO-06、ECO-09、ECO-14、ECO-16 | 全员固定 7 级年费 VIP；限次礼包免费；无限免费权益改金币；元宝价按规则折金币；兑换码为本站能力；不区分 VIP 偷取。 |
| 活动 | EVT-08、EVT-10 | Lovesday 长期开启；万圣协议别名按当前 SWF 实际行为兼容。 |
| 运营 | ADMIN-04、ADMIN-06、ADMIN-15、ADMIN-16、ADMIN-17 | 目录、初始资源、好友、活动和每日任务由版本化代码管理；只保留受控 owner 测试发放。 |

金币替代的统一规则见 D-08：原本无限免费的 VIP 商品不得继续免费；优先使用源金币价，只有元宝价时按
`元宝价 × 1000` 转金币。每日礼包、签到、升级、回归及节日限次礼包按 D-09 保留免费，但必须限制日、次或账号。

## 16. 已明确放弃（44 项）

| 分类 | 稳定 ID | 放弃边界 |
| --- | --- | --- |
| 平台与旧架构 | PLAT-01、PLAT-09、PLAT-11、PLAT-12、PLAT-17、PLAT-18 | Discuz 壳与登录、旧玩家数据迁移、外部上报、自绘旧场景、双编码模板及旧升级脚本。 |
| 旧素材 | CAT-12 | 旧经典版和早期自行拆图成果不再作为实现依据。 |
| 社交 | SOC-15、SOC-17、SOC-18 | 手动/QQ 好友、外部分享和论坛。 |
| 元宝与 VIP 生命周期 | ECO-02、ECO-03、ECO-07、ECO-08、ECO-13 | 元宝充值、VIP 开通续费、永久半价、VIP 经验生命周期和 Discuz 积分兑换。 |
| 外部活动 | EVT-26、EVT-29、EVT-30、EVT-31、EVT-37 | Qzone 礼包、股票、Intel、腾讯管家及腾讯账号权益奖励。 |
| 源工具页 | TOOL-02、TOOL-05 | Discuz 积分兑换和 VIP 管理页。 |
| 旧后台 | ADMIN-08、ADMIN-10、ADMIN-11、ADMIN-12、ADMIN-13 | PHP 缓存、旧数据修复、腾讯同步、模板/播放器切换和插件生命周期。 |
| 外部平台能力 | EXT-01、EXT-02、EXT-03、EXT-04、EXT-05、EXT-06、EXT-07、EXT-08、EXT-09、EXT-10、EXT-11、EXT-12、EXT-13、EXT-14、EXT-15、EXT-16、EXT-17 | QQ/Qzone、Discuz、腾讯支付与活动、外部同步、实物领奖、统计上报和第三方播放器全部排除。 |

统一边界：运行时不打开原 SWF 外部 URL，不采集邮寄资料，不发放元宝、黄钻、QQ 秀、实物或第三方券。
源活动中的本地虚拟奖励只有在另列稳定功能 ID、明确次数和经济规则后才能接入，不能因同一活动外部部分被放弃而默认启用。

## 17. 源残留（6 项）

| 稳定 ID | 源残留 | 判定 |
| --- | --- | --- |
| CAT-13 | 已关闭或过期配置能力 | 配置已关闭或时间窗失效，不能算当前 V7 可用功能。 |
| PAST-34 | 好友背包 | 配置关闭且缺少完整流程。 |
| PAST-35 | 牧场限时特价 | 仅有 2010 年时间窗，没有当前规则。 |
| EVT-28 | 七夕翻牌窗口 | XML 引用的 SWF 缺失，服务端规则也不完整。 |
| EVT-36 | 新年标志接口 | 固定返回关闭，素材片段不足以构成完整玩法。 |
| EVT-38 | 定时动态 NPC | 只有固定出现时刻和素材，没有可复核奖励处理。 |

源残留不是当前待办。只有补齐源证据或重新定义本站玩法后，才能改为“待确认”或“未实现”。

## 18. 后续决策队列

以下项目仍可能进入后续开发，但不代表已经承诺实现。后续可以直接按编号回复“要 / 弱化 / 不要 / 以后再说”：

1. **玩家自由市场（ECO-12、TOOL-06、TOOL-07）**：有完整源代码和独立数据表，能形成玩家间经济，但会扩大交易、并发和价格治理范围。建议：以后再说。
2. **健康模式（FARM-29）**：源项目可限制游玩时间，自用站点实际价值较低。建议：不要。
3. **独立帮助中心（TOOL-03）**：集中展示源规则、目录和当前本地化差异，能降低测试和使用成本。建议：要。
4. **欢迎语/提示语设置（FARM-28、TOOL-04）**：主要是个性化展示，对核心循环影响小。建议：以后再说。
5. **站内召回/请求礼包（SOC-16、EVT-25、EVT-32）**：需要按平台账号重做，不应照搬 QQ 请求。建议：以后再说。
6. **完整消息中心（SOC-12、ECO-15）**：留言和动态可用，但成果、消费、系统分类仍不完整。建议：要。
7. **水晶祝福（WILD-10、EVT-21）**：有素材和协议名，需要继续反编译规则与奖励。建议：确认素材后再决定。
8. **剩余节日活动（EVT-14 至 EVT-24、EVT-27、EVT-33 至 EVT-35）**：逐个做，不一次全部常开；优先规则和素材完整的活动。
9. **最小庄园运营能力（PLAT-16、ADMIN-01、ADMIN-03、ADMIN-05、ADMIN-07、ADMIN-09、ADMIN-14）**：先做维护开关、公告和存档查看/修复，不复刻旧后台全部能力。建议：弱化后要。
10. **土地扩建基金（FARM-30）**：源规则为每账号一次 200000 金币，会直接改变前期经济。建议：不要照搬；若保留则改为任务奖励。
11. **翻牌小游戏（EVT-27）**：素材和奖品目录较完整，但服务端规则残缺，需要重新定义次数、概率和防重复领取。建议：以后再说。
12. **飞机/出售有机窗口（FARM-31、FARM-32）**：当前只有素材证据，业务语义不完整。建议：先反编译，不承诺实现。
13. **旧 NPC 活动（EVT-33、EVT-34）**：规则可读，但奖励和长期开放方式需要重新平衡。建议：节日活动批次再决定。
VIP 经验成长已按 ECO-08 明确放弃，不再列入决策队列；源 `speed` 只影响会员等级经验，不影响作物或动物速度。

## 19. 维护规则

1. 新增庄园功能前，先在本矩阵增加或更新稳定 ID，再进入实现。
2. 状态改为“已实现”必须同时具备可用入口、真实持久化和自动测试，不以静态页面或空响应为准。
3. 发现源功能时先记录证据；未经用户决定，不把“未实现”直接改成“放弃”。
4. 特殊实现必须记录原行为、替代行为和经济影响，尤其是 VIP、元宝、活动时间窗和外部平台能力。
5. 目录数量变化时同步更新本文件、`rules-summary.csv` 和对应目录测试。
6. 源包版本或哈希变化时重新生成全部 source inventory，再重新审计本矩阵，而不是在旧结论上追加。
7. 每批实现完成后更新“当前实现基线”提交号，并把对应状态、测试证据和残留差异写回本文件。
8. “未实现”“待确认”“部分实现”“特殊实现”“放弃”和“源残留”的数量或 ID 变化时，同步更新第 0 节汇总、第 15–18 节索引和验证脚本。
