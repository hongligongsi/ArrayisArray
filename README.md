# DB Admin - 数据库管理系统

一个功能强大、界面友好的数据库管理系统，提供全方位的数据库操作和监控能力。

![DB Admin](https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20database%20management%20dashboard%20interface%20with%20charts%20and%20tables&image_size=landscape_16_9)

## 🚀 技术栈

- **前端**: React + TypeScript + Vite
- **UI框架**: Ant Design
- **数据可视化**: Recharts
- **后端**: Node.js + Express
- **数据库**: MySQL
- **构建工具**: Vite
- **版本控制**: Git

## ✨ 核心功能

### 数据管理

- **表管理**: 创建、删除、清空表，查看表结构和索引管理
- **数据浏览**: 分页查看、编辑、删除数据记录
- **SQL查询**: 执行SQL语句，支持语法高亮和格式化
- **批量执行**: 批量执行多条SQL语句，支持事务处理
- **数据导入导出**: 支持CSV、JSON格式的数据导入导出

### 系统监控

- **操作日志**: 记录所有用户操作，支持日志归档和告警规则配置
- **错误日志**: 详细记录系统错误，提供错误堆栈和上下文信息
- **性能分析**: 通过EXPLAIN分析SQL执行计划，优化查询性能
- **系统状态**: 实时监控数据库连接状态和系统资源使用情况

### 用户管理

- **权限控制**: 基于角色的访问控制(RBAC)，细粒度权限管理
- **用户管理**: 创建、编辑、删除用户，支持批量操作
- **密码管理**: 密码重置、修改密码，支持密码强度验证
- **登录审计**: 记录用户登录日志，支持异常登录检测

### 工具集成

- **第三方集成**: 支持与外部系统集成，提供Webhook机制
- **API管理**: 开放API接口管理，支持API密钥认证
- **系统配置**: 系统参数配置管理，支持配置热更新
- **备份恢复**: 数据库备份和恢复功能

### 数据分析

- **数据可视化**: 丰富的图表展示系统运行状态和业务数据
- **趋势分析**: 查看工具使用趋势和数据浏览统计
- **报表导出**: 支持导出PDF、Excel格式的报表
- **自定义仪表盘**: 支持自定义数据展示面板

## 📦 安装和运行

### 环境要求

- Node.js >= 16.0.0
- MySQL >= 5.7
- npm >= 8.0.0

### 快速开始

1. **克隆项目**

```bash
git clone https://github.com/hongligongsi/ArrayisArray.git
cd ArrayisArray
```

2. **安装依赖**

```bash
npm install
```

3. **启动项目**

```bash
# 使用启动脚本（推荐）
start.bat

# 或手动启动
npm start
```

4. **访问系统**

- **前端**: http://localhost:3002
- **后端API**: http://localhost:3001

### 数据库配置

项目默认使用内置的SQLite数据库进行开发测试。生产环境建议配置MySQL数据库：

1. 修改 `server/.db-connections.json` 文件
2. 配置数据库连接信息
3. 重启服务

## 🔐 默认登录信息

- **用户名**: admin
- **密码**: admin123

> 注意：首次登录后请立即修改默认密码！

## 📁 项目结构

```
├── src/                    # 前端源代码
│   ├── api/               # API接口定义和请求封装
│   ├── components/        # 通用UI组件
│   ├── contexts/          # React上下文管理
│   ├── hooks/             # 自定义React Hooks
│   ├── layouts/           # 页面布局组件
│   ├── pages/             # 页面组件
│   └── types/             # TypeScript类型定义
├── server/                # 后端服务
│   ├── data/              # 数据库文件和初始数据
│   └── index.ts           # 服务入口和路由定义
├── public/                # 静态资源文件
├── docs/                  # 项目文档
└── scripts/               # 构建和部署脚本
```

## 🎨 特色功能

- **响应式设计**: 完美支持桌面端、平板和移动端
- **深色模式**: 支持亮色/深色主题切换，保护眼睛健康
- **全局错误处理**: 统一的错误处理机制，提升用户体验
- **组件化开发**: 高度模块化的组件设计，易于维护和扩展
- **类型安全**: 完整的TypeScript类型定义，减少运行时错误
- **性能优化**: 代码分割、懒加载、缓存策略等性能优化措施

## 🔧 开发命令

```bash
# 开发模式（热更新）
npm run dev

# 构建生产版本
npm run build

# 运行后端服务
npm run server

# 代码检查
npm run lint

# 类型检查
npm run typecheck

# 预览生产构建
npm run preview
```

## � 系统架构

### 前端架构

- **React组件**: 采用函数组件和Hooks
- **状态管理**: React Context API
- **路由管理**: React Router
- **UI组件**: Ant Design组件库
- **数据请求**: Axios

### 后端架构

- **Web框架**: Express.js
- **数据库**: MySQL/SQLite
- **ORM**: 原生SQL查询
- **认证**: JWT Token
- **日志**: 结构化日志记录

## �📝 版本信息

### 当前版本

- **版本号**: 2026.04.03
- **发布日期**: 2026年4月3日

### 更新日志

- **2026.04.03**: 修复antd静态message警告，更新README文档
- **2026.04.02**: 实现项目改进计划，添加TypeScript类型定义
- **2026.04.01**: 初始版本发布

## 🔒 安全特性

- **密码加密**: 使用bcrypt进行密码加密存储
- **JWT认证**: 基于JWT的无状态认证机制
- **CSRF保护**: 跨站请求伪造防护
- **输入验证**: 严格的输入验证和SQL注入防护
- **权限控制**: 细粒度的权限控制机制

## 🤝 贡献指南

欢迎参与项目开发！请遵循以下步骤：

1. Fork项目仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 📄 许可证

MIT License

## 📞 联系方式

- **项目地址**: https://github.com/hongligongsi/ArrayisArray
- **问题反馈**: https://github.com/hongligongsi/ArrayisArray/issues

---

**注意**: 本项目仅供学习和开发使用，生产环境部署请确保做好安全配置和性能优化。
