# Census 唯一真实 run 启动登记（实际启动前写定）
- registered_UTC: 2026-10-25T01:15:33Z
- counters_before_start: PoC 4/20→**5/20**，Host 4/12→**5/12**（本 run 即第 5 次，唯一一次，不自动重试）
- world: s1-census-20261025T011533Z（fresh，实测不存在）; port: 3183（fresh 空闲实测）
- preflight hash 吻合: runner aceddd542625862843d76a6d8814d0d1ed3dc33e29bd5336cafca39479384ff5 / probe 6e8f2acbf568bec79bc1c0c5283951029e327b33eaefce28fa1fbfe059eaee8a / seeds 2ce3e3e2b2c1f4a9682ccb554d75d50e55511ec7ff405d7d0efb8c705a5f9ae2
- watchdog: 30min 总（runner 内置）+ 原短观察窗（PROMPT_WAIT_MS 继承）+ owned 收尾；重试 0
- PRE-START host hashes: bin.js=1a03dee18683483ff6a1b27b2a1e650230da6bcca9a0f55f7d81b3308c3f307f tools-lib=40f47709337c3c205d4e09e647f8588f4977e66f6d52f019b3cc7ef81159d84f
- :3080 baseline=401（run 后须一致）
