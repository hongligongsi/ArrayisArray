# 开发文档

## 项目概述

DataHub 是一个基于 React + TypeScript + Node.js 的全栈数据库管理系统。

## 技术栈

### 前端
- **框架**: React 18
- **语言**: TypeScript 5
- **构建工具**: Vite 6
- **UI组件库**: Ant Design 5
- **图表库**: Recharts
- **路由**: React Router 7
- **HTTP客户端**: Axios

### 后端
- **运行时**: Node.js 20
- **框架**: Express.js 4
- **数据库**: MySQL 8
- **连接池**: mysql2
- **认证**: JWT + bcryptjs
- **缓存**: NodeCache

## 项目结构

```
├── src/                       # 前端源代码
│   ├── api/                  # API接口定义
│   │   └── index.ts         # 所有API请求封装
│   ├── components/           # 通用组件
│   │   ├── dashboard/       # 仪表盘组件
│   │   ├── ErrorBoundary.tsx
│   │   └── Skeleton.tsx
│   ├── contexts/             # React上下文
│   │   └── ErrorContext.tsx
│   ├── hooks/                # 自定义Hooks
│   ├── layouts/              # 布局组件
│   │   └── MainLayout.tsx   # 主布局
│   ├── pages/                # 页面组件
│   ├── types/                # TypeScript类型定义
│   │   └── index.ts
│   ├── App.tsx              # 应用入口
│   └── main.tsx             # 渲染入口
├── server/                    # 后端服务
│   └── index.ts             # 服务入口
├── docs/                      # 文档
├── public/                    # 静态资源
└── package.json
```

## 开发规范

### 代码风格
- 使用 TypeScript 严格模式
- 组件使用函数式组件 + Hooks
- 使用 Ant Design 组件库
- 遵循 ESLint 规则

### 命名规范
- 组件名: PascalCase (如: UserManagement)
- 文件名: 与组件名一致
- 变量/函数: camelCase
- 常量: UPPER_SNAKE_CASE
- 接口: PascalCase + 后缀 (如: UserProps)

### 类型定义
所有类型定义放在 `src/types/index.ts`:

```typescript
export interface User {
  id: number
  username: string
  email: string
}
```

## API 开发指南

### 前端 API 调用

```typescript
// src/api/index.ts
export const authApi = {
  login: (data: LoginData) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
}
```

### 后端路由定义

```typescript
// server/index.ts
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    // 业务逻辑
    res.json({ token, user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
```

## 数据库设计

### 核心表结构

#### admin_users (管理员用户表)
```sql
CREATE TABLE admin_users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100) DEFAULT '',
  nickname VARCHAR(100) DEFAULT '',
  role VARCHAR(50) DEFAULT 'admin',
  avatar VARCHAR(500) DEFAULT '',
  status TINYINT DEFAULT 1,
  reset_token VARCHAR(255) DEFAULT NULL,
  reset_token_expiry DATETIME DEFAULT NULL,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
```

## 常见问题

### 1. 类型错误
**问题**: `tables.forEach is not a function`
**解决**: 确保后端返回的数据格式与前端类型定义一致

### 2. Ant Design 弃用警告
**问题**: `headerStyle is deprecated`
**解决**: 使用新的 `styles` 属性替代

```typescript
// 旧写法
<Drawer headerStyle={{...}} bodyStyle={{...}} />

// 新写法
<Drawer styles={{ header: {...}, body: {...} }} />
```

### 3. message 静态方法警告
**问题**: `Static function can not consume context`
**解决**: 使用 App.useApp() 获取 message 实例

```typescript
const { message } = App.useApp()
message.success('操作成功')
```

## 调试技巧

### 前端调试
1. 使用 React DevTools 检查组件状态
2. 使用浏览器 Network 面板查看 API 请求
3. 使用 VSCode 断点调试

### 后端调试
1. 查看控制台日志
2. 使用 `console.log` 输出变量
3. 检查 MySQL 查询日志

## 性能优化

### 前端优化
- 使用 React.memo 避免不必要的重渲染
- 使用 useMemo/useCallback 缓存计算结果
- 图片懒加载
- 代码分割

### 后端优化
- 使用数据库连接池
- 添加查询缓存
- 使用索引优化查询
- 分页查询大数据集

## 部署指南

### 开发环境
```bash
npm install
npm run dev      # 启动前端
npm run server   # 启动后端
```

### 生产环境
```bash
npm run build    # 构建前端
npm run server   # 启动后端服务
```

## 贡献指南

1. Fork 项目仓库
2. 创建功能分支: `git checkout -b feature/xxx`
3. 提交更改: `git commit -m "feat: xxx"`
4. 推送到分支: `git push origin feature/xxx`
5. 创建 Pull Request

## 更新日志

查看 [README.md](../README.md) 中的版本信息部分。
