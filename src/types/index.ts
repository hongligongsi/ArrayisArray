// 数据库连接配置
export interface ConnectionConfig {
  id: string
  name: string
  host: string
  port: number
  user: string
  password: string
  database: string
}

// 数据库信息
export interface DatabaseInfo {
  schema: string
}

// 表信息
export interface TableInfo {
  tableName: string
  tableType: string
  tableComment: string
  engine: string
  rowCount: number
  createTime: string
  updateTime: string
}

// 列信息
export interface ColumnInfo {
  columnName: string
  dataType: string
  isNullable: string
  columnKey: string
  columnDefault: string | null
  extra: string
  columnComment: string
}

// 查询结果
export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  affectedRows?: number
  message?: string
}

// 用户信息
export interface User {
  id: number
  username: string
  email: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
}

// 认证响应
export interface AuthResponse {
  token: string
  user: User
}

// Dashboard统计数据
export interface DashboardStats {
  totalDatabases: number
  totalTables: number
  totalRecords: number
  activeUsers: number
  recentQueries: number
  systemStatus: 'healthy' | 'warning' | 'critical'
}

// Dashboard图表数据
export interface DashboardChartData {
  dailyQueries: Array<{ date: string; count: number }>
  tableSizes: Array<{ table: string; size: number }>
  userActivity: Array<{ user: string; actions: number }>
}

// 工具信息
export interface Tool {
  id: number
  name: string
  description: string
  category: string
  version: string
  isEnabled: boolean
  usageCount: number
  createdAt: string
}

// 工具配置
export interface ToolConfig {
  toolId: number
  configKey: string
  configValue: any
  description?: string
}

// 会员计划
export interface MembershipPlan {
  id: number
  name: string
  description: string
  price: number
  duration: string
  features: string[]
  isActive: boolean
}

// 会员使用记录
export interface MembershipUsage {
  id: number
  userId: number
  action: string
  resource: string
  timestamp: string
}

// 广告信息
export interface Ad {
  id: number
  title: string
  content: string
  position: string
  isEnabled: boolean
  clickCount: number
  impressionCount: number
  createdAt: string
}

// 广告统计
export interface AdStats {
  adId: number
  impressions: number
  clicks: number
  clickRate: number
  date: string
}

// 权限资源
export interface PermissionResource {
  id: number
  resourceName: string
  resourceType: string
  parentId?: number
  description?: string
}

// 角色权限
export interface RolePermission {
  roleName: string
  resourceId: number
  permissionType: string
  isEnabled: boolean
}

// 用户权限
export interface UserPermission {
  userId: number
  resourceId: number
  permissionType: string
  isEnabled: boolean
}

// 性能分析数据
export interface PerformanceData {
  responseTime: number
  throughput: number
  errorRate: number
  timestamp: string
}

// 工具使用趋势
export interface ToolTrend {
  toolId: number
  toolName: string
  usageCount: number
  date: string
}

// 异常检测
export interface Anomaly {
  id: number
  type: string
  severity: 'low' | 'medium' | 'high'
  description: string
  timestamp: string
  status: 'open' | 'resolved'
}

// SQL历史记录
export interface SqlHistory {
  id: number
  sql: string
  executionTime: number
  rowsAffected: number
  createdAt: string
  userId: number
}

// SQL执行计划
export interface SqlExecutionPlan {
  id: number
  historyId: number
  plan: string
  createdAt: string
}

// 操作日志
export interface OperationLog {
  id: number
  userId: number
  action: string
  resource: string
  details: string
  ipAddress: string
  userAgent: string
  timestamp: string
}

// 错误日志
export interface ErrorLog {
  id: number
  errorType: string
  message: string
  stackTrace: string
  timestamp: string
  userId?: number
}

// 告警规则
export interface AlertRule {
  id: number
  name: string
  condition: string
  threshold: number
  isEnabled: boolean
  createdAt: string
}

// 告警信息
export interface Alert {
  id: number
  ruleId: number
  message: string
  severity: 'info' | 'warning' | 'error'
  timestamp: string
  status: 'new' | 'acknowledged' | 'resolved'
}

// 内容分类
export interface ContentCategory {
  id: number
  name: string
  description?: string
  sortOrder?: number
}

// 文章信息
export interface Article {
  id: number
  title: string
  content: string
  categoryId?: number
  coverImage?: string
  images?: string[]
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  createdAt: string
  updatedAt: string
}

// 审核日志
export interface AuditLog {
  id: number
  articleId: number
  userId: number
  action: string
  comment?: string
  timestamp: string
}

// 订单信息
export interface Order {
  id: number
  userId: number
  totalAmount: number
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
  createdAt: string
  updatedAt: string
}

// 订单项
export interface OrderItem {
  id: number
  orderId: number
  productId: number
  quantity: number
  price: number
}

// 订单状态日志
export interface OrderStatusLog {
  id: number
  orderId: number
  status: string
  remark?: string
  timestamp: string
}

// 客服工单
export interface SupportTicket {
  id: number
  userId: number
  title: string
  content: string
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high'
  assignedTo?: number
  createdAt: string
  updatedAt: string
}

// 工单消息
export interface TicketMessage {
  id: number
  ticketId: number
  userId: number
  message: string
  isInternal: boolean
  timestamp: string
}

// 反馈信息
export interface Feedback {
  id: number
  userId: number
  type: string
  content: string
  status: 'new' | 'processing' | 'resolved' | 'closed'
  createdAt: string
  updatedAt: string
}

// 反馈模板
export interface FeedbackTemplate {
  id: number
  name: string
  content: string
  category: string
}

// FAQ信息
export interface FAQ {
  id: number
  question: string
  answer: string
  category: string
  isPublished: boolean
}

// 系统配置
export interface SystemConfig {
  configKey: string
  configValue: any
  description?: string
  type: 'string' | 'number' | 'boolean' | 'json'
}

// 通知渠道
export interface NotificationChannel {
  id: number
  name: string
  type: 'email' | 'sms' | 'webhook'
  config: any
  isEnabled: boolean
}

// 通知消息
export interface Notification {
  id: number
  channelId: number
  userId: number
  title: string
  content: string
  status: 'pending' | 'sent' | 'failed'
  timestamp: string
}

// 日志渠道
export interface LogChannel {
  id: number
  name: string
  type: 'file' | 'database' | 'external'
  config: any
  isEnabled: boolean
}

// 支付网关
export interface PaymentGateway {
  id: number
  name: string
  type: 'stripe' | 'paypal' | 'alipay'
  config: any
  isEnabled: boolean
}

// 支付交易
export interface PaymentTransaction {
  id: number
  gatewayId: number
  orderId: number
  amount: number
  status: 'pending' | 'success' | 'failed' | 'refunded'
  transactionId: string
  timestamp: string
}

// API密钥
export interface ApiKey {
  id: number
  name: string
  key: string
  permissions: string[]
  expiresAt?: string
  isActive: boolean
  createdAt: string
}

// API调用记录
export interface ApiCall {
  id: number
  apiKeyId: number
  endpoint: string
  method: string
  responseTime: number
  statusCode: number
  timestamp: string
}

// API调用统计
export interface ApiCallStats {
  totalCalls: number
  averageResponseTime: number
  successRate: number
  topEndpoints: Array<{ endpoint: string; count: number }>
}

// 健康检查
export interface HealthCheck {
  id: number
  name: string
  type: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  lastCheck: string
  responseTime: number
}

// 备份配置
export interface BackupConfig {
  id: number
  name: string
  type: 'full' | 'incremental'
  schedule: string
  retentionDays: number
  isEnabled: boolean
}

// 备份记录
export interface BackupRecord {
  id: number
  configId: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime: string
  endTime?: string
  size?: number
}

// 版本信息
export interface Version {
  id: number
  version: string
  description: string
  releaseDate: string
  isActive: boolean
}

// 系统指标
export interface SystemMetrics {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  networkTraffic: {
    incoming: number
    outgoing: number
  }
  timestamp: string
}

// 通用分页参数
export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// 通用分页响应
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 通用响应格式
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

// 环境变量
export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test'
  PORT: number
  DATABASE_URL: string
  JWT_SECRET: string
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'
}