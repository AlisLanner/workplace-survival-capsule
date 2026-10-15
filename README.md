# 基于LLM Multi-Agent的职场情境能力评估系统

基于LLM Multi-Agent的职场情境能力评估系统是一个职场情境行为观察与反馈原型。用户在高压职场场景中与多名角色对话，系统通过规则门控、追问调度、证据覆盖跟踪和 Judge Agent 多次采样，生成可追溯的行为观察报告。

当前版本适合原型演示、流程验证和研究数据采集。报告输出是情境行为观察反馈，不应单独用于招聘、晋升、淘汰、绩效处罚等高风险人事决策。

## 功能概览

- 五个内置评估情境：项目交付危机（周三下午的会议室）、客诉危机（8号桌的客人）、服务事故（零点大促的故障工单）、管理接盘（接手的第三周）、新人需求对接（入职第一周的需求对接）。
- Multi-Agent 对话流程：Response Quality Gate、Director、NPC 角色、Group Discussion、Judge Agent。
- SSE 流式聊天：NPC 回复逐 token 展示。
- 报告生成进度：报告阶段、Judge 采样进度、延迟等待提示。
- 心理测量学取向报告：参考指数、观察区间、维度证据、建议和人工复核状态。
- 管理后台：仪表盘、场景配置、提示词编辑、会话回放、群聊校验记录和报告查看。
- 本地 mock 模式：不需要大模型 API key，也不消耗 API 额度。
- SQLite 本地数据库：不需要 Docker 或 PostgreSQL。

## 应用场景与目标用户

MAAT 的情境按适用对象设计（详见 `docs/应用场景与目标用户.md`）：

1. **校招（应届生 → 执行/专业岗）**：执行层情境「入职第一周的需求对接」——受测者角色与应届生职级一致，观察需求澄清、边界表达、求助担当。
2. **中层选拔 / 管理者培训**：管理岗情境——「周三下午的会议室」「接手的第三周」（任务推进型，向上对齐、资源协调、团队管理）；「8号桌的客人」「零点大促的故障工单」（现场危机型，一线运营与危机指挥）。选拔直接使用与目标岗位层级一致的情境；培训配套发展建议，支持测评 → 教练面谈 → 复测闭环。
3. **高校教学**：组织行为学、人才测评课程教学工具，离线便携版 + 本地 mock 模式用于课堂角色扮演实训，管理后台可自定义任务卡与提示词。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6, Recharts |
| Backend | Node.js, Express, TypeScript, Prisma |
| Database | SQLite |
| Tests | Vitest |
| LLM | DeepSeek API 或本地 mock fallback |

## 项目结构

```text
workplace-survival-capsule/
  backend/                Express API, Prisma, agents, prompts, tests
  frontend/               React app, pages, components, styles
  docs/                   架构计划、研究报告、项目文档
  scripts/                本地安装和启动脚本
  setup-local.bat         Windows 一键初始化
  start-dev.bat           Windows 一键启动前后端
  tail-backend-log.bat    查看后端日志
```

## 本地快速启动

### Windows 便携版

最新便携压缩包在 [GitHub Releases](https://github.com/xianghaoyu2001/workplace-survival-capsule/releases/latest) 下载。解压后双击 `START.bat`，无需安装 Node.js。默认使用离线 mock，API key 为空，管理密钥在每次启动时临时生成。发布包只包含五个默认场景和八个提示词，不包含本机测评数据。

源码包含便携启动器和 `scripts/build-portable.cjs`。重新打包前先运行下方构建与测试命令，并将 Windows Node.js 运行时放入 `portable-release/runtime/node.exe`（该二进制不提交到 Git）。执行：

```powershell
node scripts/build-portable.cjs windows-test
node scripts/test-portable.cjs portable-release/windows-test
node scripts/build-portable.cjs windows-release
Compress-Archive -Path portable-release/windows-release/* -DestinationPath portable-release/windows-release.zip
```

冒烟测试会写入测试会话，因此必须在独立测试目录中运行，正式发布时使用另一个全新目录。打包脚本不复制本机 `.env` 或已有数据库。

Windows 用户可以直接使用批处理脚本：

1. 双击项目根目录的 `setup-local.bat`。
2. 等待终端显示 `Setup completed.`。
3. 双击 `start-dev.bat`。
4. 浏览器打开 `http://localhost:5173`。

`setup-local.bat` 会自动完成：

- 创建 `backend/.env`。
- 安装依赖。
- 生成 Prisma Client。
- 创建 SQLite 数据库表。
- 写入默认场景和 Agent 提示词。

如果聊天卡住或报错，双击 `tail-backend-log.bat` 查看后端实时日志。

## 命令行启动

```powershell
cd D:\job_project\workplace-survival-capsule
npm run setup:local
```

分别启动后端和前端：

```powershell
npm run backend:dev
npm run frontend:dev
```

访问地址：

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health check: `http://localhost:3000/health`

## 环境变量

本地配置文件是 `backend/.env`。该文件被 `.gitignore` 忽略，不能提交到 GitHub。

默认 mock 模式：

```env
DATABASE_URL="file:./dev.db"
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_FAST_MODEL="deepseek-v4-flash"
DEEPSEEK_STRONG_MODEL="deepseek-v4-pro"
USE_MOCK_LLM="true"
PORT=3000
CORS_ORIGIN="*"
```

如需使用真实 DeepSeek API，在本机 `backend/.env` 中填写自己的 key，并关闭 mock：

```env
DEEPSEEK_API_KEY=""
USE_MOCK_LLM="false"
```

后台接口可选配置 `ADMIN_SECRET`。如果不设置，后端会允许本地后台无密钥访问；如果部署到公网，必须设置：

```env
ADMIN_SECRET=""
```

前端可选配置见 `frontend/.env.example`：

```env
VITE_API_BASE="http://localhost:3000"
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run setup:local` | 创建本地 `.env`、安装依赖、迁移 SQLite、写入种子数据 |
| `npm run backend:dev` | 构建并启动后端 |
| `npm run frontend:dev` | 启动 Vite 前端开发服务 |
| `npm run backend:build` | 后端 TypeScript 构建 |
| `npm run frontend:build` | 前端类型检查和生产构建 |
| `npm run test` | 运行后端 Vitest 测试 |

## 安全说明

- 不要提交 `backend/.env`、真实 API key、数据库文件或日志。
- `.gitignore` 已排除 `.env`、`node_modules`、`dist`、日志、SQLite 数据库、Word 临时文件和 TypeScript 构建缓存。
- 仓库中的 `backend/.env.example` 和 `frontend/.env.example` 只包含空值或公开默认值。
- 上传前建议运行一次 staged secret scan，确认没有 key/token 被加入提交。

## 验证

当前项目可通过以下命令做基础验证：

```powershell
npm run backend:build
npm run frontend:build
npm run test
```

后端测试覆盖 agent view、assessment design、Judge Agent、response quality、slot tracker 和 JSON 工具等关键逻辑。

## 研究与文档

`docs/` 下包含架构计划、整改计划、前端规格和 MAAT 心理测量学研究报告。最新整理版报告为：

```text
docs/MAAT_report_v5.2.docx
```

报告中的效度、常模和公平性验证路线属于后续研究规划；当前软件版本仍是原型系统。

## 部署备注

本地开发使用 SQLite，适合演示和小规模测试。正式部署时建议：

- 使用受控的生产数据库。
- 设置 `ADMIN_SECRET` 和严格的 `CORS_ORIGIN`。
- 使用 HTTPS 和服务端日志轮转。
- 固定 LLM 模型版本，记录提示词版本和评估批次。
- 在真实数据进入测量学分析前完成知情同意和隐私处理。
