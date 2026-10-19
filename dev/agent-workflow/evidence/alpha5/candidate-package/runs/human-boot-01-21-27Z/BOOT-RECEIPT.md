# 真人路径真 boot 收据（独审 a6a6e0d1 必办③；root 01:20Z 单）

对象 = 配置态真人世界 `tests/homes/candidate-human-2026-10-19T01-01-46-640Z`，
配置层 = `human-config-template.yml` 全键形（含门实跑中新发现的显式 `mcpServer: null`——
真实 validator 抓出的隐性必填，模板与门已同修）。启动命令 = README §3b 步骤 5 **逐字所用形**
（TEST_USE 自桥 INSTALLED.testUse；DSH_CLIENT_COMMIT_HASH 同记录）。

| 面 | 结果 |
| --- | --- |
| boot 行 | `boot1.log:2` `dsh web: http://127.0.0.1:3184/?token=[REDACTED]`（token 值已脱敏，raw 日志已删） |
| 无鉴权门 | `GET / -> 401`；`POST /api/session/list (no cookie) -> 401` |
| **token 鉴权门** | `GET /?token=[given] -> 303`（浏览器换 cookie 的跳转面） |
| 按 PID 停机 | `kill` exit=0；世界顶层条目 5 项一个不少（deployment/profiles/sessions/storages/workspace） |
| **同目录重开** | `boot2.log`（端口 3185）再现 boot 行；`GET / -> 401`、`?token -> 303`——**重开可用实证** |

诚实注：本次 `DEEPSEEK_BASE_URL` 指向关闭端口（boot/鉴权面不触模型；真模型对话轮**不在本收据范围**，
本收据覆盖=独审点名的"boot 行+token 门 401/303+按 PID kill+同目录重开可用"四面）。
门收据同目录：`check-oldlayer.out`（旧 7 键缺形被真 validator 连爆，含 realmId 键名门）、
`check-newlayer.out`（全键形 PASS rc=0）、`human-config-configured.yml`（所用配置）。
