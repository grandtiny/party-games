# 怀旧庄园素材对应表

本目录是旧版 QQ 农场/牧场素材到当前 Party Games 庄园模块的可复核映射，不保存旧站部署配置、账号数据或聊天记录。

## 来源与生成

- 原仓库：`Boldcc/qqfarm`
- 原仓库提交：`9fe597cdcd57adba4abdb24f3d251c64e63621fb`
- 游戏根目录：`upload/home/qqfarm`
- 源台账生成：`pwsh -File scripts/build-manor-asset-map.ps1`
- 作物目录生成：`pwsh -File scripts/generate-manor-crop-catalog.ps1`
- 运行时作物导出：`pwsh -File scripts/export-manor-runtime-crops.ps1`
- SWF 解析：JPEXS `ffdec.jar`，由 `scripts/ManorSwfInventory.java` 在单个 JVM 内批量读取。

## 当前统计

| 范围 | 数量 | 当前状态 |
| --- | ---: | --- |
| 原版作物配置/SWF | 86 | 602 个七阶段角色已导出并人工复核；430 张五阶段运行时 PNG 已接入；结构解析错误 0 |
| 原版动物配置/SWF | 35 | 210 个六状态角色和 78 个内部辅助类已分离登记并人工复核；结构解析错误 0 |
| 原版装饰配置 | 172 | 162 件允许默认接入，8 件延后到场景验收，ID 21/402 不接入 |
| UI、动作及辅助素材 | 130 个源文件 | 830 个可见映射已复核；28 个空轮廓和 2 个二进制类已分类 |
| 原版牧场声音 | 60 个容器/60 条音轨 | 按真实 DefineSound 登记，总时长 75.121 秒；8 种动物存在原版变体缺口 |
| 原版 module 素材文件 | 828 | 已逐文件登记 SHA-256、分类和处理状态 |
| 原版 source 源码文件 | 124 | 已按功能域登记，用于后续规则对应 |
| 原版 module 完全重复文件组 | 4 | 仅表示二进制完全相同，删除或合并前仍需人工判断用途 |
| 当前 classic 基础 PNG | 103 | 当前项目已使用的场景、控件和首批兼容作物素材 |
| 作物运行时 PNG | 430 | 86 种作物各含种子、发芽、生长、成熟、枯萎五阶段 |
| 当前 classic PNG 完全重复组 | 13 | 已区分共享作物阶段、按钮状态复用和待复核项 |

## 文件说明

| 文件 | 用途 |
| --- | --- |
| `crops.csv` | 86 种作物的原版经济数据、SWF、七个状态角色和当前接入状态 |
| `animals.csv` | 35 种动物的原版经济数据、SWF SymbolClass 和接入状态 |
| `decorations.csv` | 172 件装饰的套装、类型、价格、源完整性、提取策略、接入策略和可用源文件 |
| `files.csv` | `module` 下 828 个素材文件的完整文件级台账 |
| `source-modules.csv` | `source` 下 124 个 PHP 配置/业务模块及功能分类 |
| `duplicates.csv` | `module` 内 SHA-256 完全相同的文件组，用于定位重复素材，不代表可以直接删除 |
| `current-assets.csv` | 当前项目 103 个 classic PNG 的尺寸、哈希、业务对象和源文件对应状态 |
| `current-duplicates.csv` | 当前 classic PNG 的完全重复组及初步复核分类 |
| `crop-state-assets.csv` | 86 种作物七阶段的 602 行角色、导出 PNG、尺寸、哈希和当前素材比对结果 |
| `crop-current-assets.csv` | 当前 48 张作物 PNG 到七阶段、实际源角色、导出文件和哈希的逐张映射 |
| `crop-runtime-assets.csv` | 86 种作物的 430 张运行时 PNG、源角色、阶段、哈希和视觉复核状态 |
| `crop-contact-review.csv` | 每种作物的联系表、角色复用数量和自动校验结果 |
| `crop-visual-review.csv` | 86 种作物联系表的人工视觉复核结论和专项备注，生成器只读取、不覆盖 |
| `decoration-assets.csv` | 172 件装饰的实际选源、导出图、可见范围、哈希和视觉复核状态 |
| `decoration-contact-review.csv` / `decoration-visual-review.csv` | 装饰自动检查与人工视觉结论 |
| `animal-state-assets.csv` | 35 种动物六个运行时状态的 210 行角色、导出图、尺寸和哈希 |
| `animal-symbol-classes.csv` | 288 个动物 SymbolClass，明确区分 210 个运行时状态和 78 个内部辅助类 |
| `animal-contact-review.csv` / `animal-visual-review.csv` | 动物联系表自动检查与人工视觉结论 |
| `interface-media-assets.csv` | UI、动作、花束、留言板、入口和声音等 130 个源文件的分类汇总 |
| `interface-symbol-assets.csv` | 860 个根舞台、SymbolClass 和 ExportAssets 映射及 830 个渲染结果 |
| `sound-assets.csv` | 60 个真实 DefineSound 音轨的格式、采样率、声道、样本数和时长 |
| `animal-audio-policy.csv` | 35 种动物的可用声音变体和运行时接入策略 |
| `asset-review-issues.csv` | 当前全部阻断项、接入前复核项和原版声音缺口的统一问题清单 |
| `contact-sheets/crops/index.html` | 86 份作物七阶段视觉联系表入口 |
| `contact-sheets/decorations/index.html` | 172 件装饰视觉联系表入口 |
| `contact-sheets/animals/index.html` | 35 种动物六状态视觉联系表入口 |
| `contact-sheets/interface-media/index.html` | 38 份 UI、动作和辅助素材联系表入口 |

## 状态定义

| 状态 | 含义 |
| --- | --- |
| `integrated-4-stage` | 首批 12 种兼容素材已提取到 classic 根目录；完整运行时状态以 `crop-runtime-assets.csv` 为准 |
| `integrated-source` | 该源 SWF 已有当前项目目标素材，但仍需保留来源核验 |
| `mapped-not-extracted` | 已确定原版业务对象和源文件，尚未批量导出/视觉验收 |
| `inventoried` | 已登记文件，仍需在对应 UI、声音或装饰批次中细分用途 |

## 接入策略

| 策略 | 含义 |
| --- | --- |
| `default` | 已有完整且验收通过的源素材，可以进入后续默认接入批次 |
| `deferred-validation` | 源素材存在，但必须先在实际场景验证裁剪、锚点、遮罩或层级，不进入默认批次 |
| `available-only` | 只接入台账明确列出的现有变体，不为缺失变体建立替代映射 |
| `excluded` | 当前没有可信可用源或存在身份冲突，不接入运行时 |

## SWF 状态口径

作物根精灵通常按深度放置七个状态角色。`crops.csv` 将它们记录为 seed、sprout、young、growing、pre-mature、mature、withered。当前只把这套顺序作为提取索引；每种作物仍需生成联系表并肉眼确认，不能仅按“倒数第二个精灵”批量认定成熟图。

动物 SWF 每种都有 `Animal_<id>_1` 至 `Animal_<id>_6` 六个运行时状态，依次对应幼年、成长、成熟待生产、生产阶段一、生产阶段二、生命周期结束。该语义来自原 PHP 的状态跳转；联系表仍保留数字状态作为运行时契约。兔子、羊、袋鼠等额外内部类只登记在 `animal-symbol-classes.csv`，不混入六状态。

UI 素材库的根舞台常为空，实际可见资源挂在 SymbolClass 或 ExportAssets 上。联系表同时记录空根舞台、运行时容器和不可视二进制配置，不把它们误报为丢图。`action-effect-candidate` 仅是类名启发式分类，接入时仍应根据联系表和业务调用点确认。

牧场声音按 SWF 内真实 `DefineSound` 标签清点，而不是按容器文件数推测。当前 60 个容器各含 1 条音轨；采样率使用 JPEXS 解析后的 Hz 值计算时长。

## 已知缺口与重复

- 172 条装饰配置中有 169 条带 SWF。背景 ID 26 和 31 虽然没有 SWF，但分别带 1034x806、1024x768 的 `f.jpg` 全尺寸图，可作为运行时回退；背景 ID 21 只有 60x60 预览和 120x120 缩略图，既缺 SWF 也缺全尺寸图，是唯一无法从当前仓库恢复的农场装饰。背景 ID 11 同时带 SWF 和 1028x789 全尺寸图。
- 原版 `module` 有 4 组 SHA-256 完全重复文件。其中装饰 ID 95“浪漫栅栏”和 ID 402“新年围墙”的 SWF、预览图、缩略图三组文件分别完全相同，但业务身份和所属套装不同，应保留两个业务 ID、阻止 402 进入默认提取批次，不能静默合并。另有一组 36 字节牧场装饰 SWF 是可解析的空白占位文件，不作为可见素材处理。
- `decorations.csv` 的 `extraction_policy` 控制如何提取，`integration_policy` 控制能否接入：162 件为 `default`，ID 14/54/66/76/89/93/213/409 为 `deferred-validation`，ID 21/402 为 `excluded`。被延后或排除的素材不得进入默认批次。
- 当前 classic PNG 有 13 组完全重复：2 组为多种作物共享种子图，1 组白萝卜/胡萝卜早期图已确认分别精确来自两个原 SWF 的同一角色 4，10 组为原版按钮 normal/down 状态本身相同；当前没有错误重复或未分类重复。
- 当前 54 张场景/UI PNG 已全部追溯到 `farmui1_v_12.swf` 或 `farmui2_v_4.swf`：52 张与 JPEXS 导出文件哈希一致，`can-harvest.png` 对应 `138:canPickIcon` 且只有 1 个像素差异，背景对应 `1:DefaultBg` 内嵌图。
- 当前 12 种作物的 48 张 PNG 均已通过 SHA-256 反查到各自 SWF 的实际导出角色：47 张直接对应七阶段角色；水稻当前阶段 1 使用七阶段“幼苗”角色 15 内的纯植株子角色 14，以避免把原版水田底图重复叠到网页土地上。水稻和小麦当前阶段 2 均对应“成熟前”角色，而不是通用作物采用的“生长”角色。具体关系见 `crop-current-assets.csv` 和联系表蓝字。
- 完整 86 种作物已按统一五阶段接入 430 张运行时 PNG；水稻纯植株子角色以及水稻、小麦成熟前角色的特殊映射继续保留，逐项来源见 `crop-runtime-assets.csv`。
- 35 种动物中有 8 种缺少一个或两个原版声音变体：乌龟、乌骨鸡、长颈鹿、美国短毛猫、穿山甲和貔貅只有变体 2，只允许接入现有变体；仓鼠和炫舞龟没有声音文件，声音保持 `excluded`。动物视觉素材不受声音缺口影响。
- 装饰的阻断项、黑/白耕地占位、远端同帧元素和声音缺口统一维护在 `asset-review-issues.csv`；正文不再复制易过期的分散待办。

## 当前边界

素材准备阶段已完成“批量导出 -> 联系表 -> 人工验收 -> 问题清单”。农场已消费作物台账并接入 86 种作物、原版生长阶段、多季、枯萎、照料收益/减产、三档化肥、土地开垦、新手礼包和升级奖励规则；三档化肥分别来自 `157:Fertilizer`、`164:FertilizerFast` 和 `170:FertilizerVeryFast`，开垦木牌来自 `261:Reclaim`。升级奖励中的装扮目前只记录权益，摆放界面尚未开放；牧场和好友仍不在当前功能边界。后续接入必须继续消费对应表并按 `integration_policy` 过滤，不直接把原 PHP/Flash 放进运行时，平台账号继续作为唯一账号体系。
