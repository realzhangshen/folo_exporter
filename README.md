# Folo Exporter

一个 Chrome 扩展，用于将 [Folo](https://app.folo.is)（RSS 阅读器）中的未读文章导出为 Markdown 格式。

## 功能

- 获取 Folo 收件箱中的所有未读文章
- 支持两种导出格式：
  - **分类模式**：按分类组织文章
  - **列表模式**：按发布时间排序的时间线列表
- 复制到剪贴板或下载为 `.md` 文件
- 本地缓存，保留已获取的文章
- 获取过程中显示进度

## 安装

1. 克隆或下载此仓库
2. 打开 Chrome，访问 `chrome://extensions/`
3. 启用右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」，选择扩展文件夹

## 使用方法

1. 在浏览器中登录 [Folo](https://app.folo.is)
2. 点击 Folo Exporter 扩展图标
3. 点击「Fetch Unread Articles」获取未读文章
4. 选择导出格式（分类或列表）
5. 点击「Copy」或「Download」导出

## 要求

- Chrome 浏览器
- 已登录的 Folo 账户

## 限制

- 「标记为已读」功能已禁用（浏览器扩展无法访问该 API 端点）
- 需要在 app.folo.is 上保持登录状态

## API 文档

详见 [docs/folo-api-documentation.md](docs/folo-api-documentation.md)。

## 许可证

MIT
