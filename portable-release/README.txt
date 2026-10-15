Workplace Survival Capsule - Windows 便携版

使用方法：
1. 解压这个压缩包。
2. 双击 START.bat。
3. 浏览器会自动打开应用页面。
4. 使用应用时，请保持黑色命令窗口不要关闭。
5. 关闭该命令窗口即可停止应用。

这个便携包已经内置 Node 运行环境和本地 SQLite 数据库，目标电脑不需要提前安装 Node.js、npm，也不需要做项目配置。

默认模式：
- USE_MOCK_LLM=true
- 这表示应用可以离线运行，不需要 DeepSeek API Key。
- ADMIN_SECRET 默认留空；启动时会生成一次性的临时管理端密钥，并显示在命令窗口中。

如果要固定管理端密钥：
1. 打开 app\config.env。
2. 将 ADMIN_SECRET= 改为你自己的长随机字符串。
3. 保存文件后，重新运行 START.bat。

如果要使用真实 DeepSeek API：
1. 打开 app\config.env。
2. 将 USE_MOCK_LLM=true 改为 USE_MOCK_LLM=false。
3. 填入你自己的密钥：
   DEEPSEEK_API_KEY=your_key_here
4. 默认普通对话使用 DEEPSEEK_FAST_MODEL=deepseek-v4-flash；最终评分使用 DEEPSEEK_JUDGE_MODEL=deepseek-v4-flash，并只在 Judge 阶段开启 thinking。
5. 保存文件后，重新运行 START.bat。

本地访问地址：
- 默认地址：http://127.0.0.1:17863
- 如果端口被占用，启动器会自动尝试下一个端口，并在命令窗口中显示实际访问地址。

补充说明：
- START.bat：启动应用并自动打开浏览器。
- START_NO_BROWSER.bat：只启动应用，不自动打开浏览器。
