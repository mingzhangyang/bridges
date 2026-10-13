# 部署与回滚

本仓库交付纯静态资源。`wrangler.jsonc` 配置 Workers Static Assets、`dist/` 资源目录和 SPA 回退，不需要服务端 Worker、数据库、鉴权或 secrets。

## 发布

1. 使用 Node.js 22+ 执行 `npm ci`、`npm run check`、`npm run test:browser`，确认 PR CI 全部通过。
2. 将 Cloudflare 的 Git 构建连接至本仓库：构建命令 `npm run build`，部署命令 `npx wrangler deploy`，Worker 名称 `bridges`。也可在已登录的本地环境执行相同命令。
3. 首次发布先使用预览域名验收。在 Cloudflare 为该 Worker 添加自定义域名 `bridges.orangely.xyz`；本仓库没有预先创建路由或修改 DNS。
4. 核对 `/`、`/?lang=zh&theme=dark`、`/#SB08`、`/#EC01`、每日深链和未知路径的 SPA 回退。主线深链遵循四站解锁约定；独立存档仅属于当前 origin，预览存档不会迁移到正式域名。
5. 验证 `og.png` 为 1200×630、favicon、canonical、sitemap、`_headers` 生效。未做内容哈希的模块使用 `max-age=0, must-revalidate`，避免 HTML 与模块版本错配。
6. 完成真机 Safari / Chrome、屏幕阅读器、减少动态和五位试玩者验收后，再在 games 的 `site.home.externalGames` 中添加正式 URL。

Cloudflare 配置参考：

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- https://developers.cloudflare.com/workers/static-assets/headers/

## 数据与内容版本

单快照键为 `seven-bridges.snapshot.v1`。读档按每个关卡的 revision 和 edgeId 回放，矛盾路线会重建为新旅程；经验证的独立完成记录保留。未来版本的快照不会被旧程序覆盖。写入失败时持续显示重试提示，界面不把内存中的进度称为已保存。

对已发布关卡改变桥 ID、目标、候选建设或预算时，需要增加该关 revision，并重新执行内容验证。每日挑战键和深链（`#daily/<日期>/<revision>/<题型>`）包含开始时冻结的日期、revision 和题型；同一挑战的辅助事实不能通过重开清除。每日清单只追加：修订已发布的某日题目时，追加同一日期、revision 加一的新条目，不修改或删除旧条目，这样已开始的挑战、存档和完成记录仍能解析；当天入口取最新 revision。此版清单覆盖至 2027-10-12，超出清单的日期显示明确提示，主线继续可玩。

## 回滚

保留 Cloudflare 已部署版本，异常时切回前一稳定版本，再验证缓存更新、根页和一个存档恢复流程。回滚代码不删除设备存档。若新版本已经引入不兼容快照版本，旧版本会停止写入并显示保存失败；先发布兼容修复，避免将新数据降级覆盖。
