# 网页内容剪藏工具

一个简单的网页内容剪藏工具，可以将网页内容提取并保存到OneNote。

但目前使用的 API 无法很好处理反爬严格的网页。

## 功能特点

- 🔗 输入网页链接，自动提取主要内容
- 📝 可编辑的文章标题和内容
- 📥 一键保存到OneNote
- 📋 支持选择保存到哪个笔记本和分区
- 🎨 现代化的响应式界面
- 🔒 安全的Microsoft账户认证
- 📱 支持移动设备
- 🔍 自动处理长链接，避免溢出
- 🖼️ 支持提取和保存图片
- 🌐 内置CORS代理，解决跨域问题

## 技术栈

- **前端框架**: React 19 + Vite
- **内容提取**: @mozilla/readability
- **OneNote集成**: Microsoft Graph API
- **认证**: MSAL.js
- **样式**: CSS3

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 创建Microsoft应用注册

在使用OneNote保存功能之前，需要在Microsoft应用注册门户创建一个应用：

1. 访问 [Microsoft Azure 门户](https://portal.azure.com/)
2. 搜索并打开 "应用注册"
3. 点击 "新注册"
4. 填写应用名称
5. 选择 "任何组织目录中的账户和个人 Microsoft 账户"（支持微软个人账户和工作/学校账户）
6. 点击 "注册" 创建应用

**重要配置步骤：**

7. **添加平台配置**：
   - 在应用概览页面，点击 "添加平台"
   - 选择 "单页应用程序(SPA)"
   - 添加重定向URI: 本地开发使用 `http://localhost:5173` 或当前开发服务器的URL
   - 点击 "配置"

8. **添加API权限**：
   - 在 "API 权限" 中点击 "添加权限"
   - 选择 "Microsoft Graph"
   - 选择 "委托的权限"
   - 添加以下权限:
     - `Notes.ReadWrite.All` (OneNote读写权限)
     - `User.Read.Write` (用户信息读写权限)
     - `Notes.Create` (笔记创建权限)
   - 点击 "添加权限"

9. **无需客户端密码**：
   - 本项目使用MSAL.js的授权码流，**不需要**在"证书和密码"中生成客户端密码
   - 客户端类型已通过代码中的`clientCapabilities: ['CP1']`明确指定为SPA

10. **确保支持个人账户**：
    - 在 "认证" 页面，确保应用程序类型设置为 "单页应用程序(SPA)"
    - 确保已启用 "ID令牌" 和 "访问令牌" (隐式授权)

### 3. 配置应用

创建一个 `.env.local` 文件，用于存储环境变量：

```bash
# .env.local
# Microsoft Azure Application Configuration
VITE_CLIENT_ID="your-client-id-here"
# VITE_AUTHORITY="https://login.microsoftonline.com/common"  # 可选，默认使用common租户（支持微软个人账户和工作账户）
# VITE_REDIRECT_URI="http://localhost:5173"  # 可选，默认动态使用当前页面URL作为重定向URI
```

将 `your-client-id-here` 替换为你的Microsoft应用客户端ID。

**可用的环境变量**：
- `VITE_CLIENT_ID` (必填): 你的Microsoft应用客户端ID
- `VITE_AUTHORITY` (可选): 授权端点，默认使用 `https://login.microsoftonline.com/common`
  - 使用 `common` 租户可以同时支持微软个人账户（Outlook.com、Hotmail.com等）和工作/学校账户
  - 如需仅支持特定组织账户，可以使用组织的租户ID或域名
- `VITE_REDIRECT_URI` (可选): 重定向URI，默认动态使用当前页面的URL
  - 动态重定向URI可以自动适应开发服务器的不同端口（如http://localhost:5173、http://localhost:5174等）
  - 生产环境中建议明确指定重定向URI

**注意**：
- `.env.local` 文件已经被添加到 `.gitignore` 中，不会被提交到版本控制系统
- 在生产环境中，可以通过部署平台的环境变量配置来设置这些变量
- 所有以 `VITE_` 开头的环境变量都会被Vite自动暴露给前端代码

### 4. 启动应用

```bash
npm run dev
```

应用将在 `http://localhost:5173` 启动。

## 使用方法

1. 在输入框中粘贴要提取的网页链接
2. 点击 "提取内容" 按钮
3. 查看提取的内容预览
4. 编辑文章标题和内容（可选）
5. 选择要保存到的笔记本和分区
6. 点击 "保存到 OneNote" 按钮
7. 登录Microsoft账号（首次使用时）
8. 内容将自动保存到你选择的OneNote笔记本和分区

## 注意事项

- 本项目内置了CORS代理，解决了跨域问题
- 确保在Microsoft应用注册中正确配置了重定向URI
- 需要有有效的Microsoft账号才能使用OneNote保存功能
- 部分网站可能有防爬虫机制，导致内容提取失败
- 建议使用Chrome浏览器以获得最佳体验
- 首次使用时需要授权应用访问你的OneNote

## 项目结构

```
21note/
├── src/
│   ├── App.jsx          # 主应用组件
│   ├── App.css          # 应用样式
│   ├── index.css        # 全局样式
│   ├── main.jsx         # 应用入口
│   └── assets/          # 静态资源
├── index.html           # HTML模板
├── package.json         # 项目配置
├── vite.config.js       # Vite配置
├── jsconfig.json        # JavaScript配置
└── README.md            # 项目说明
```

## 开发说明

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

### 代码检查

```bash
npm run lint
```

## 许可证

MIT
