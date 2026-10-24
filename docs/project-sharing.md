# 最新版项目查看与运行说明

更新日期：2026-10-24。

## 查看和下载完整项目

- 最新统一八维程序：[打开全部文件和文件夹](https://github.com/AlisLanner/workplace-survival-capsule/tree/feature/unified-ge8-20261016)。
- 在该页面点击 **Code → Download ZIP**，可下载该分支的完整源码。仅需查看代码时无需安装软件或配置模型。
- 默认 `main` 分支是修改前的稳定版本；新版代码、提示词、测量定义及本说明在 `feature/unified-ge8-20261016` 分支。打开项目时先确认分支名称。

| 目录 | 内容 |
| --- | --- |
| `frontend/` | 首页、情境选择、作答、八维报告和管理界面，含素材与样式 |
| `backend/src/` | 对话调度、角色、守护、评分、引用校验、审计及接口 |
| `backend/src/assessment/` | 统一八维、四正式情境、版本化定义和证据协议 |
| `backend/src/prompts/` | 角色与评分提示词，包含统一八维模板 |
| `backend/prisma/` | 数据结构、迁移和默认情境种子程序 |
| `backend/tests/`、前端测试文件 | 自动化验证 |
| `scripts/`、`backend/scripts/` | 初始化、启动、复制库验证、检查点和恢复工具 |
| `docs/` | 程序实现说明及历史文档；当前实现口径见 `ge8-implementation.md` 最后的版本记录 |
| `package.json`、`package-lock.json` | 工作区配置与锁定依赖 |

源码不包含个人 API 密钥、后台口令、本机环境文件、真实作答、数据库、请求日志、私有研究资料或本机路径启动配置。`node_modules` 和构建输出按锁文件重新生成；本机演示库、截图和视频也不作为默认程序数据发布。

## 新电脑离线运行统一八维版

需要 Node.js 24 或更高版本及其 npm。Git 仅在通过克隆下载时需要。下面以 Windows PowerShell 和全新目录为例；不要对正在使用的数据库重新执行初始化或种子程序。

若使用 Git 下载：

```powershell
git clone --branch feature/unified-ge8-20261016 --single-branch https://github.com/AlisLanner/workplace-survival-capsule.git
cd workplace-survival-capsule
```

若使用 ZIP，解压后在包含 `package.json` 的项目根目录打开 PowerShell，继续运行：

```powershell
Copy-Item backend/.env.example backend/.env
npm ci
npm run prisma:generate -w backend
npm run backend:build
npm run frontend:build
New-Item -ItemType Directory -Path .local-data -Force
$demoDatabase = Join-Path (Get-Location) '.local-data/ge8-demo.db'
node scripts/init-ge8.cjs $demoDatabase
node scripts/local-server.cjs --database $demoDatabase --mode mock --port 17861
```

`Copy-Item` 仅用于全新下载，没有已有配置的情形；已有 `backend/.env` 时保留自己的文件。新库初始化会创建结构、写入默认情境并安装统一八维 `.12`，遇到同名数据库会拒绝覆盖。已完成初始化时直接运行最后一条启动命令。

浏览器访问 **http://127.0.0.1:17861/scenarios**。终端需保持运行，按 Ctrl+C 停止。此服务仅监听本机。

离线 `mock` 模式不需要模型密钥，也不消耗模型 API 额度；它用于了解操作流程与验证界面，生成的模拟结果不能当作真实模型评分或人员测评数据。希望查看完整报告时，完成一场离线互动后进入报告页。

## 使用真实模型

先完成上述源码安装和新库初始化，在本机 `backend/.env` 配置自己的接口地址、密钥和模型。真实模式需显式启动：

```powershell
node scripts/local-server.cjs --database $demoDatabase --mode real --port 17861
```

真实互动和报告生成会调用配置的模型并可能产生费用。既有工程验收使用 Flash；自行更换提供者或型号后，应重新核对接口兼容性与输出质量。报告使用五份合法评分结果汇总，技术失败、真正没有作答和需要人工复核的情形不会被伪造成有效分数。

## 当前版本的范围

- 测量版本：`ge8-20261016.12`；八个维度，每维 0—20 分，完整可评分结果汇总为 0—160 分。
- 正式新版情境：A、B、C、E。D 是保留的旧版演示，新旧版本及跨情境分数不能直接比较。
- 支持多角色追问、最多 15 轮作答、报告进度、逐维分析、观察点依据、引文定位和完整对话回看。
- 表现未展开但已有实际提问与回应时，可以按冻结规则形成相应评分；真正未作答、必要条件未提供或技术失败仍有各自的状态。
- 已完成的工程检查和示范会话用于说明程序运行情况，不等于目标岗位人员的信效度研究，也不设置招聘淘汰线。
- 旧便携包、历史文档和旧情境保留各自版本；不能把旧包自动视为本分支的统一八维新程序。

## 开发检查

```powershell
npm test
npm run test -w frontend
npm run backend:build
npm run frontend:build
```

专项验证脚本的输入限制和版本安装、升级、恢复说明见 [统一八维实现记录](ge8-implementation.md)。只有显式运行真实模型验收脚本才应发出模型请求；查看源码、访问已保存报告和下载项目不需要调用模型。
