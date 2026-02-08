# Folo Exporter

一个用于导出 [Folo](https://app.folo.is) 未读文章的工具，包含两种形态：
- Chrome 扩展（原有）
- 命令行工具 CLI（新增，适合服务器和 agent 调用）

## 功能

- 获取 Folo 收件箱中的所有未读文章
- 支持三种导出格式（默认 JSON）：
  - **JSON 格式**：导出完整结构化数据
  - **分类模式**：按分类组织文章
  - **列表模式**：按发布时间排序的时间线列表
- 扩展支持复制到剪贴板或下载为 `.md` / `.json`
- CLI 支持标准输出或写入文件，便于脚本和 agent 编排

## Chrome 扩展安装

1. 克隆或下载此仓库
2. 打开 Chrome，访问 `chrome://extensions/`
3. 启用右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」，选择扩展文件夹

## Chrome 扩展使用方法

1. 在浏览器中登录 [Folo](https://app.folo.is)
2. 点击 Folo Exporter 扩展图标
3. 点击「Fetch Unread Articles」获取未读文章
4. 选择导出格式（默认 JSON）
5. 可选：勾选「导出后自动标记为已读」
6. 点击「Copy」或「Download」导出
7. 或点击「Mark as Read」手动标记为已读

## CLI 快速开始

要求：
- Node.js 18+

安装依赖并链接本地命令：

```bash
npm install
npm link
```

查看帮助：

```bash
folo-exporter --help
```

## AI Agent 使用手册（重点）

本节是给自动化 Agent 的标准操作文档。目标是让 Agent 在无人值守环境中稳定调用本工具，最小化交互步骤与风控风险。

### 1. 设计原则

Agent 调用时请遵循以下原则：
1. 优先使用 `fetch --format json`，因为 JSON 结构最稳定、最适合下游处理。
2. 优先使用 `--state` 会话文件，不要每次自动化登录。
3. 先 `check-auth` 再 `fetch`，减少失败任务成本。
4. 只在会话失效时触发人工登录修复。

### 2. 标准命令协议

建议 Agent 按以下固定顺序执行：

```bash
folo-exporter check-auth --state ~/.folo-exporter/storage-state.json
folo-exporter fetch --format json --out /absolute/path/folo-export.json --state ~/.folo-exporter/storage-state.json
```

如果你希望直接通过 stdout 进入下一步处理：

```bash
folo-exporter fetch --format json --state ~/.folo-exporter/storage-state.json
```

### 3. 命令说明

#### 3.1 `login`

用途：人工完成一次登录，保存会话状态。

```bash
folo-exporter login --state ~/.folo-exporter/storage-state.json
```

常用参数：
- `--state <path>`：会话文件路径（默认 `~/.folo-exporter/storage-state.json`）
- `--headless <bool>`：是否无头启动（默认 `false`）
- `--timeout <sec>`：登录等待超时秒数（默认 `300`）

说明：
- 本命令依赖 `playwright`。
- 建议只在初次部署或会话过期时执行。

#### 3.2 `check-auth`

用途：验证当前会话是否有效。

```bash
folo-exporter check-auth --state ~/.folo-exporter/storage-state.json
```

成功输出示例：

```text
Auth OK (status 200, sample entries: 1)
```

#### 3.3 `fetch`

用途：导出收件箱未读文章。

```bash
folo-exporter fetch --format json --out ./folo-export.json --state ~/.folo-exporter/storage-state.json
```

参数：
- `--format <type>`：`json | grouped | list`，默认 `json`
- `--out <path>`：输出文件；不传则输出到 stdout
- `--batch-size <n>`：每次请求数量，最大 100，默认 100
- `--max-requests <n>`：分页安全上限，默认 50
- `--state <path>`：会话文件路径
- `--cookie <string>`：原始 Cookie Header（优先级高于 `--state`）

### 4. 认证输入优先级

`fetch` / `check-auth` 会按以下顺序取认证信息：
1. `--cookie`
2. 环境变量 `FOLO_COOKIE`
3. `--state` 对应的 `storage-state.json`

如果三者都不可用，会报错并退出。

### 5. 退出码约定（供 Agent 判断）

- `0`：成功
- `1`：通用错误（参数错误、文件缺失、网络异常、会话不可用等）
- `2`：`check-auth` 认证失败（HTTP 非成功状态）

建议：
1. `check-auth` 返回 2 时，转人工登录修复流程。
2. 其他非 0 失败可按重试策略处理（例如 1~2 次退避重试）。

### 6. 输出数据契约（JSON）

`--format json` 的顶层结构：

```json
{
  "exportTime": "ISO-8601",
  "exportTimeFormatted": "Locale String",
  "total": 123,
  "articles": [
    {
      "id": "entry-id",
      "title": "string",
      "url": "string",
      "publishedAt": "ISO-8601|null",
      "insertedAt": "ISO-8601|null",
      "summary": "string",
      "feedTitle": "string",
      "category": "string"
    }
  ]
}
```

Agent 处理建议：
1. 用 `id` 去重，不依赖 `title`。
2. 时间排序优先 `publishedAt`，缺失时再降级。
3. `summary` 可能为空字符串。

### 7. 云端无人值守运行方案

推荐流程：
1. 在云服务器部署 Node 环境和本仓库。
2. 通过一次人工登录生成 `storage-state.json`。
3. 定时运行 `check-auth` + `fetch`。
4. 会话失效时告警并转人工重新登录。

登录建议：
- 不要每次任务都跑自动登录流程。
- 保持同一台机器、同一运行环境，降低异常登录概率。

### 8. 推荐的 Agent 编排模板

```bash
set -euo pipefail

STATE_PATH="${HOME}/.folo-exporter/storage-state.json"
OUT_PATH="/data/folo/folo-export-$(date +%F-%H%M).json"

folo-exporter check-auth --state "${STATE_PATH}"
folo-exporter fetch --format json --out "${OUT_PATH}" --state "${STATE_PATH}"
```

如果你希望在认证失败时返回特定告警：

```bash
set +e
folo-exporter check-auth --state "${HOME}/.folo-exporter/storage-state.json"
CODE=$?
set -e

if [ "$CODE" -eq 2 ]; then
  echo "FOLO_AUTH_EXPIRED"
  exit 2
fi

folo-exporter fetch --format json --state "${HOME}/.folo-exporter/storage-state.json"
```

### 9. 常见失败与处理

1. `Storage state not found`  
原因：会话文件不存在。  
处理：执行 `login` 重新生成会话文件。

2. `Auth invalid` 或 `Auth check failed with status ...`  
原因：会话过期或无效。  
处理：人工补登录并更新会话文件。

3. `Fetch failed with status ...`  
原因：网络波动、服务端异常或认证状态变化。  
处理：先重试，再执行 `check-auth` 验证会话。

### 10. 安全建议

1. 不要把 `storage-state.json` 或 `--cookie` 明文提交到 Git。
2. 给会话文件设置最小权限（如 `chmod 600`）。
3. 在 CI/CD 使用机密管理系统注入 Cookie/状态文件。
4. 对导出结果做分级访问控制（内容可能包含敏感阅读信息）。

## 限制

- 需要有效登录会话（扩展和 CLI 都一样）
- 会话过期后需要重新登录

## API 文档

详见 [docs/folo-api-documentation.md](docs/folo-api-documentation.md)。

## 许可证

MIT
