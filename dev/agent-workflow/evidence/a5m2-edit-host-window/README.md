# A5M2 EDIT/SRE — 真实 Host 正负控小窗（准备卡；只准备、零 boot、零 pack）

状态：本目录是**准备包**，不是执行记录。截至本提交 EDIT/SRE 全部结论档位 =
**接线未测**（作者侧 278/278 battery + 竖线是 spec 证据，非 Host）。本卡应 CENTER
2026-10-28 排程令制作：**一切 Host 命令只写入脚本，不执行**；不新 tree/session/
install；不触碰 :3080。

## 1. 组合单 SHA（写死）

**组合 = 现 int 头 `161e4cd38185e0b6280a8d530ab07fbd7f9fba8c`**
（`git ls-remote origin refs/heads/feat/a5-m2-integration` 于本提交时实测取值；
内容复核：该树 dist 两臂 blob `5a6db608a4043793e8569998bbe1c8fa5a0695be` /
`6a1ec67f062dd77ee7110a6d4d6e3781376f4f35` 与 source 同 blob = EDIT/SRE A–E +
cd3f44f01 发布修复全在树内）。

pack 命令序列见 `scripts/01-pack-sequence.sh` —— **本窗口不执行**；pack 唯一
owner 另派（避免双跑）。脚本内的打包步骤引用既有 9c 资产（kit 打包链 +
`scripts/check-install-manifest.mjs`），本 lane 不复写、不修改。

## 2. 端口规划（3180 族，红线：禁 3080；durable 世界惯占 3180/3181 避让）

| 用途 | 端口 |
| --- | --- |
| 正控主实例（P1–P4） | **3183** |
| 负控实例（N1–N4） | **3184** |
| race inotify 窗口（R-A/R-B） | **3185** |
| 备用（并行拆分时） | 3497 / 3498 / 3499 |

窗口内启动前逐一 `ss -ltn "sport = :<port>"` 复核空闲并登记实测输出（第二实例
避 3080/3180 的登记义务在本表完成）。

## 3. 独立世界（tests/homes/，TEST_METHODS §7）

临时世界命名（`<line>-<UTC 时间戳>`，一世界一目录；锁文件 `<home>.lock` 同处）：

```
tests/homes/a5m2-edit-hw-pos-<UTCts>     # 正控
tests/homes/a5m2-edit-hw-neg-<UTCts>     # 负控
tests/homes/a5m2-edit-hw-race-<UTCts>    # race 窗口
```

teardown（窗口末执行并在此登记实测）：

```bash
rm -rf tests/homes/a5m2-edit-hw-pos-<UTCts> tests/homes/a5m2-edit-hw-pos-<UTCts>.lock
rm -rf tests/homes/a5m2-edit-hw-neg-<UTCts> tests/homes/a5m2-edit-hw-neg-<UTCts>.lock
rm -rf tests/homes/a5m2-edit-hw-race-<UTCts> tests/homes/a5m2-edit-hw-race-<UTCts>.lock
```

例外：任何作为证据保留的世界**不删**，并在本 README 追加登记路径。launch token
与世界状态**永不提交**。

## 4. 正/负控脚本（写入即止；执行只在获准窗口）

- `scripts/02-positive-controls.mjs` — 真实 PA 消费路径：edit 行与 SRE 行
  （str_replace/view/create 腿）的 exact-locator 效应、walk 全值进耐久行、真
  allow→一 consume→真字节重读、consumptions=1、日志零 append。
- `scripts/03-negative-controls.mjs` — deny lane→**零执行字节**断言（edit deny
  零 write、SRE deny 零 echo）；escalation/undeclared 在 classify 前 typed 拒
  于真 runtime 复现（零行断言）；token replay 拒。
- `scripts/04-race-inotify-harness.mjs` — 两件 UNVERIFIED race（write/create
  的 post-bind/pre-create cancel 与 post-create cancel）的 inotify 事件流
  harness；窗口内顺跑，输出 appends 到本目录。

脚本载体 = 既有真实-host kit 链（`tests/kits/alpha5-pr8-e2e/kit.mjs` 同族的
boot/驱动函数；启动形 = `dsh web --port <规划端口>`，DSH_HOME 指向上表世界）。
脚本 `node --check` 语法已在准备轮验过（纯语法，不触 Host）。

## 5. 就绪判据（一行）

组合 `161e4cd38185e0b6280a8d530ab07fbd7f9fba8c` 的 install-<sha> pack 产物就位 +
3183-3185 实测空闲 + 三个 `a5m2-edit-hw-*` 世界可新鲜新建（父目录可写）——三者
同时满足即窗口就绪。

## 6. 挂账对照

本方案即两 UNVERIFIED race（P2 卡命名，计数-getter 作者侧已钉检查序）的窗口
内验证准备；正/负控则把 EDIT/SRE 行从"接线未测"推进到真实 Host 实证。无新
PA/identity 卡（根 608b69 已签）。
