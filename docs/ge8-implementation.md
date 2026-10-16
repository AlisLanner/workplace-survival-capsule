# 统一八维阶段候选版

本分支将 A、B、C、E 接入同一八维注册表、64个岗位观察点、固定事实与事件、冻结模板及逐点证据校验。D 与无版本的历史会话保留旧定义。当前版本 `ge8-20261016.2` 仍是工程候选版，未完成真实 API 验收或用户接受，不能称为稳定发布或新版测量效度验证。

## 已实现的路径

- `backend/src/assessment/definitions.ts` 与 `observations.json` 是新版内容入口。每维2点，单维0—20，缺失为 null。开发期发现任务卡出现评分提示后已另立 `.2` 内容版本；`.1` 仅保留于本地合成测试记录。
- `install.ts` 提供预演和事务安装，遇自定义旧情境冲突停止，不覆盖旧模板。旧场景正文存入私有安装记录，以便历史会话继续展示原任务卡。`seed` 仅允许空库初始化。
- `runtime.ts` 冻结实际模板正文、内容哈希、定义、模型参数及代码状态；`audit.ts` 保存真实请求、返回、哈希和接口提供的 usage。密钥不进入快照或请求正文。后台必须配置本机 `ADMIN_SECRET`。
- `session.ts` 使用 LangGraph，保留质量门控、导演、守护、角色和结束后独立 Judge；事件实际写入消息后才计送达。候选人接口仅返回公开状态。普通 GET 和重复结束不会重新开启五路收费评分。
- `judge.ts` 对每路最多2次请求，严格检查重复 JSON 键、8维顺序、16点、分值和候选人原话；不足5份合法样本为技术失败。五份均 rated 才逐维去极值并取整。缺失、分歧、模拟报告不写正式总分。
- 前端保留 null、按报告内冻结顺序展示、提供证据消息跳转；缺维不画闭合雷达。统计按情境、测量版本及实际模型配置分组。

## 本地构建与安装

需要 Node 24、锁定的 npm 依赖和可用 Git。Windows 路径作为独立参数传入，支持中文和空格。

```powershell
npm ci
npm exec -w backend -- prisma generate
npm run backend:build
npm run frontend:build
npm test
npm run test -w frontend
```

先一致性备份数据库，再在复制库设置 `DATABASE_URL`，执行 `prisma migrate deploy`。已有库不重新执行 seed。空库可使用已编译 `backend/dist/prisma/seed.js` 初始化，然后运行：

```powershell
node backend/dist/src/assessment/install.js
node backend/dist/src/assessment/install.js --apply
node scripts/local-server.cjs --database <复制库绝对路径> --mode mock --port 17861
```

第一次是预演，第二次才安装。对同一安装ID重复执行不改内容。真实模式必须显式选 real，并在本机配置 API key；不得用离线模拟入口代替真实测试。

## 验证及恢复

`backend/scripts/verify-ge8.cjs` 仅接受名称为 `verification-*.db` 的独立库，检查四场景模拟对话、SSE、事件、空值报告、模板修订、重复结束与D旧版运行。合成标记 `【A1】` 等只给 mock 回归使用，不是正式作答要求，也不用于关键词打分。

`scripts/checkpoint.cjs` 使用 SQLite Backup API，保存 Git bundle、未提交差异、未跟踪文件、配置、实际模板、构建及恢复器。备份目录必须在源码仓库外，不能上传公开仓库。

`scripts/restore-local.cjs` 支持 `--dry-run`；实际恢复先保存当前现场，随后检出到新目录，验证数据库、匹配迁移、锁定依赖和独立启动，再以 `--switch` 更新本地 `stable-launch.json`。不删除旧目录、不强推、不降低数据库结构。升级后新增会话保留在恢复前检查点，不承诺旧代码读取新数据。

## 尚未完成的验收

32个维度的低、中、高、缺失内容样例仍须补齐并逐项人工核对；目前的合成标签回归只能证明字段及流程。还需完成干净库复现、模板自定义冲突与进程中断/并发恢复等矩阵项目的完整留证，并复核前端与真实角色自然度。

真实 API 需按规划先做四场景小额链路探测，再做12份冻结对话各5次 Judge（60次），以及每场景至少1条真实整链路（另20次 Judge）。导演、角色、守护和重试另计；最保守上限约520次 HTTP 请求。执行前须明确批次数、实际调用/费用预算及连续失败停止条件；当前未启动任何真实调用。

阶段进度以本机项目索引和验证记录为准。候选版需完成剩余验收并由用户接受后，才能合入稳定 main。
