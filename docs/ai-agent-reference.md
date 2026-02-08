# AI Agent 命令与参数速查

> 更新时间: 2026-02-08
> 作用: 给后续 Agent 快速执行，不用反复读源码。

## 1. 最小可用流程（推荐）

```bash
folo-exporter check-auth --state ~/.folo-exporter/storage-state.json
folo-exporter fetch --format json --out /absolute/path/folo-export.json --state ~/.folo-exporter/storage-state.json
```

说明：
- 第一步失败时不要继续抓取。
- JSON 是下游自动处理最稳格式。

## 2. CLI 命令清单

### 2.1 登录（人工触发）

```bash
folo-exporter login --state ~/.folo-exporter/storage-state.json
```

参数：
- `--state <path>`: 会话文件路径
- `--headless <bool>`: 默认 `false`
- `--timeout <sec>`: 默认 `300`

依赖：
- `playwright`（未安装会报错）

### 2.2 鉴权检查

```bash
folo-exporter check-auth --state ~/.folo-exporter/storage-state.json
```

认证输入优先级：
1. `--cookie`
2. 环境变量 `FOLO_COOKIE`
3. `--state`

### 2.3 抓取导出

```bash
folo-exporter fetch --format json --out ./folo-export.json --state ~/.folo-exporter/storage-state.json
```

参数：
- `--format <type>`: `json | grouped | list`（默认 `json`）
- `--out <path>`: 输出文件；不传则 stdout
- `--batch-size <n>`: 默认 `100`，最大按 API 约束 `100`
- `--max-requests <n>`: 默认 `50`
- `--state <path>`
- `--cookie <string>`

## 3. 退出码（脚本分支依据）

- `0`: 成功
- `1`: 通用错误
- `2`: 仅 `check-auth` 的认证失败

脚本建议：
- `2` -> 标记为会话过期，走人工登录修复。
- `1` -> 可重试 1~2 次再告警。

## 4. 建议环境变量

- `FOLO_COOKIE`: 原始 Cookie Header（可替代 `--state`）
- `TZ`: 固定时区（建议和登录环境一致）

## 5. 典型自动化脚本

```bash
set -euo pipefail

STATE_PATH="${HOME}/.folo-exporter/storage-state.json"
OUT_PATH="/data/folo/folo-export-$(date +%F-%H%M).json"

folo-exporter check-auth --state "${STATE_PATH}"
folo-exporter fetch --format json --out "${OUT_PATH}" --state "${STATE_PATH}"
```

## 6. 常见报错对照

- `Storage state not found ...`
  - 原因: 状态文件不存在
  - 处理: 执行 `folo-exporter login ...`

- `Auth invalid ...` 或 `Auth check failed with status ...`
  - 原因: 会话过期/无效
  - 处理: 人工补登录

- `Fetch failed with status ...`
  - 原因: 临时网络/API 状态问题，或会话刚失效
  - 处理: 先重试，再 `check-auth`

## 7. 非目标（避免误用）

1. 不要让定时任务每次都自动登录。
2. 不要把 `storage-state.json` 提交到 Git。
3. 不要假设“标记已读一定可用”或“一定不可用”。
