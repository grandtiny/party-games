# 怀旧庄园素材对应表

本目录是旧版 QQ 农场/牧场素材到当前 Party Games 庄园模块的可复核映射，不保存旧站部署配置、账号数据或聊天记录。

## 来源与生成

- 原仓库：`Boldcc/qqfarm`
- 原仓库提交：`9fe597cdcd57adba4abdb24f3d251c64e63621fb`
- 游戏根目录：`upload/home/qqfarm`
- 生成命令：`pwsh -File scripts/build-manor-asset-map.ps1`
- SWF 解析：JPEXS `ffdec.jar`，由 `scripts/ManorSwfInventory.java` 在单个 JVM 内批量读取。

## 当前统计

| 范围 | 数量 | 当前状态 |
| --- | ---: | --- |
| 原版作物配置 | 86 | 12 种已接入四阶段 PNG，其余已映射未提取 |
| 原版作物 SWF | 86 | 结构解析错误 0 |
| 原版动物配置/SWF | 35 | 均已映射，结构解析错误 0，尚未接入玩法 |
| 原版装饰配置 | 172 | 背景、房屋、围栏、狗窝各 43 件，尚未接入切换玩法 |
| 原版 module 素材文件 | 828 | 已逐文件登记 SHA-256、分类和处理状态 |
| 原版 source 源码文件 | 124 | 已按功能域登记，用于后续规则对应 |
| 原版 module 完全重复文件组 | 4 | 仅表示二进制完全相同，删除或合并前仍需人工判断用途 |
| 当前 classic PNG | 99 | 当前项目已使用的场景、控件和作物素材 |
| 当前 classic PNG 完全重复组 | 13 | 已区分共享作物阶段、按钮状态复用和待复核项 |

## 文件说明

| 文件 | 用途 |
| --- | --- |
| `crops.csv` | 86 种作物的原版经济数据、SWF、七个状态角色和当前接入状态 |
| `animals.csv` | 35 种动物的原版经济数据、SWF SymbolClass 和接入状态 |
| `decorations.csv` | 172 件装饰的套装、类型、价格和可用源文件 |
| `files.csv` | `module` 下 828 个素材文件的完整文件级台账 |
| `source-modules.csv` | `source` 下 124 个 PHP 配置/业务模块及功能分类 |
| `duplicates.csv` | `module` 内 SHA-256 完全相同的文件组，用于定位重复素材，不代表可以直接删除 |
| `current-assets.csv` | 当前项目 99 个 classic PNG 的尺寸、哈希、业务对象和源文件对应状态 |
| `current-duplicates.csv` | 当前 classic PNG 的完全重复组及初步复核分类 |

## 状态定义

| 状态 | 含义 |
| --- | --- |
| `integrated-4-stage` | 已提取到当前项目并接入播种、生长、成熟显示 |
| `integrated-source` | 该源 SWF 已有当前项目目标素材，但仍需保留来源核验 |
| `mapped-not-extracted` | 已确定原版业务对象和源文件，尚未批量导出/视觉验收 |
| `inventoried` | 已登记文件，仍需在对应 UI、声音或装饰批次中细分用途 |

## SWF 状态口径

作物根精灵通常按深度放置七个状态角色。`crops.csv` 将它们记录为 seed、sprout、young、growing、pre-mature、mature、withered。当前只把这套顺序作为提取索引；每种作物仍需生成联系表并肉眼确认，不能仅按“倒数第二个精灵”批量认定成熟图。

动物 SWF 通常导出多个 `Animal_<id>_<state>` SymbolClass，不适合套用作物的七阶段规则。`animals.csv` 保存完整 SymbolClass 映射，后续按幼年、成长、生产、饥饿等原版状态单独验收。

## 已知缺口与重复

- 172 条装饰配置中，背景 ID 21 只有预览图和缩略图，原仓库没有对应 SWF；背景 ID 11 额外带一张 `11f.jpg`。其余 170 条均有 SWF、预览图和缩略图。
- 原版 `module` 有 4 组 SHA-256 完全重复文件。其中装饰 ID 95“浪漫栅栏”和 ID 402“新年围墙”的 SWF、预览图、缩略图三组文件分别完全相同；另有一组 36 字节牧场装饰 SWF 重复，疑似占位文件。这里只标记，不自动删除或合并。
- 当前 classic PNG 有 13 组完全重复：2 组为多种作物共享种子图，1 组为白萝卜/胡萝卜共享早期生长图，10 组为原版按钮 normal/down 状态本身相同；当前没有未分类的重复组。
- 当前 51 张场景/UI PNG 已全部追溯到 `farmui1_v_12.swf` 或 `farmui2_v_4.swf`：49 张与 JPEXS 导出文件哈希一致，`can-harvest.png` 对应 `138:canPickIcon` 且只有 1 个像素差异，背景对应 `1:DefaultBg` 内嵌图。
- 当前 12 种作物的成熟 PNG 已确认是单一成熟精灵。其余 36 张种子/幼苗/生长 PNG 已对应到作物 SWF，但仍应在下一轮联系表中逐张确认具体七阶段角色，不能把对象级映射当成状态级验收。

## 当前边界

本轮只建立素材与源码对应关系，不新增庄园玩法。后续素材处理应按“批量导出 -> 联系表 -> 人工验收 -> 写入目标清单”的顺序进行，原 PHP/Flash 不直接进入运行时，平台账号继续作为唯一账号体系。
