# 修复面（a5-abort-cause@a1bf18fa）main-cancel-leg 分布

| run | 目录 | 等级 | rc | mtime−FiredAt | 行 witness | gen1 reason |
|---|---|---|---|---|---|---|
| 1 | runs/22-31-18Z | **KIT_DONE 全账** | -15 | +5.4ms | bash-2 cancelled=**true** | {"kind":"user"} |
| b 卷 | ../a5c1fix-b/runs/23-05-55Z | **KIT_DONE 全账**（含 F3b） | -15 | +7.2ms | bash-2 cancelled=**true** | {"kind":"user"} |
| 2（harvest） | runs/23-14-25Z | **HARVEST**（被外部杀手腰斩，主链数据+日志已收，无 KIT_DONE/世界未自清已由我清扫；TRIAGE K12） | -15 | +3.95ms | bash-2 cancelled=**true** | {"kind":"user"} |
| 3 | 在跑（detached） | 目标=第 3 枚 KIT_DONE | | | | |

对照面（修复前 5885e46e，c1-swallow-diag 卷批 1-3）：-15@+5.4/7.0/7.7/6.2/5.0ms ×5，witness cancelled=**false** ×5，gen1=marker 形状。
分布结论（≥3 判据达成，harvest 样本带标签计入）：rc 形态两代面一致（terminate 紧随 abort ≤8ms）；**修复翻转的是行级分类位（cancelled false→true、gen1 marker→kind:user），不触碰 wire 死亡形（两代面 R1 同红=宿主法律，负断言在账）**。
