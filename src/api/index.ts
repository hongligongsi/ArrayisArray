import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})


api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }

    const errorMessage = error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      '网络请求失败，请稍后重试'

    return Promise.reject(new Error(errorMessage))
  }
)

export const authApi = {
  login: (data: { username: string; password: string; mfaCode?: string }) => api.post('/auth/login', data),
  verifyMfa: (data: { userId: number; mfaCode: string }) => api.post('/auth/verify-mfa', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (data: { oldPassword: string; newPassword: string }) => api.put('/auth/password', data),
  forgotPassword: (data: { email: string }) => api.post('/auth/forgot-password', data),
}

export const permissionApi = {
  getResources: () => api.get('/permissions/resources'),
  createResource: (data: { resourceName: string; resourceType: string; parentId?: number; description?: string }) => api.post('/permissions/resources', data),
  getRoles: () => api.get('/permissions/roles'),
  getRolePermissions: (roleName: string) => api.get(`/permissions/roles/${roleName}`),
  updateRolePermission: (roleName: string, data: { resourceId: number; permissionType: string; isEnabled: boolean }) => api.post(`/permissions/roles/${roleName}`, data),
  getUserPermissions: (userId: number) => api.get(`/permissions/users/${userId}`),
  updateUserPermission: (userId: number, data: { resourceId: number; permissionType: string; isEnabled: boolean }) => api.post(`/permissions/users/${userId}`, data),
  getAudit: (params?: any) => api.get('/permissions/audit', { params }),
}

export const analyticsApi = {
  getPerformance: (params: { timeRange?: string }) => api.get('/analytics/performance', { params }),
  getToolTrends: (params: { timeRange?: string }) => api.get('/analytics/tool-trends', { params }),
  getAnomalies: (params: { timeRange?: string }) => api.get('/analytics/anomalies', { params }),
}

export const membershipApi = {
  getPlans: () => api.get('/membership/plans'),
  createPlan: (data: any) => api.post('/membership/plans', data),
  updatePlan: (id: number, data: any) => api.put(`/membership/plans/${id}`, data),
  deletePlan: (id: number) => api.delete(`/membership/plans/${id}`),
  getUserMembership: (userId: number) => api.get(`/membership/user/${userId}`),
  purchaseMembership: (data: { userId: number; planId: number; autoRenew: boolean }) => api.post('/membership/purchase', data),
  cancelMembership: (data: { userId: number }) => api.post('/membership/cancel', data),
  getDiscounts: () => api.get('/membership/discounts'),
  createDiscount: (data: any) => api.post('/membership/discounts', data),
  getUsage: (params: { userId?: number; startDate?: string; endDate?: string }) => api.get('/membership/usage', { params }),
  recordUsage: (data: { userId: number; action: string; resource: string }) => api.post('/membership/usage', data),
}

export const adApi = {
  getAds: (params: { position?: string; isEnabled?: boolean }) => api.get('/ads', { params }),
  createAd: (data: any) => api.post('/ads', data),
  updateAd: (id: number, data: any) => api.put(`/ads/${id}`, data),
  deleteAd: (id: number) => api.delete(`/ads/${id}`),
  getAbTests: () => api.get('/ads/ab-tests'),
  createAbTest: (data: { name: string; description: string; startDate: string; endDate: string }) => api.post('/ads/ab-tests', data),
  addAbTestGroup: (testId: number, data: { adId: number; groupName: string; weight: number }) => api.post(`/ads/ab-tests/${testId}/groups`, data),
  getStats: (params: { adId?: number; startDate?: string; endDate?: string }) => api.get('/ads/stats', { params }),
  recordImpression: (data: any) => api.post('/ads/impression', data),
  recordClick: (data: any) => api.post('/ads/click', data),
}

export const mfaApi = {
  getStatus: () => api.get('/mfa/status'),
  enable: (data: { mfaCode: string }) => api.post('/mfa/enable', data),
  disable: () => api.post('/mfa/disable'),
}

export const securityApi = {
  getLoginAttempts: (params?: any) => api.get('/login/attempts', { params }),
  getBlacklist: () => api.get('/login/blacklist'),
  removeFromBlacklist: (id: number) => api.delete(`/login/blacklist/${id}`),
}

export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  chartData: () => api.get('/dashboard/chart-data'),
}

export const connectionApi = {
  status: () => api.get('/connections/status'),
}

export const databaseApi = {
  list: () => api.get('/databases'),
  use: (database: string) => api.post('/databases/use', { database }),
}

export const tableApi = {
  list: () => api.get('/tables'),
  columns: (tableName: string) => api.get(`/tables/${tableName}/columns`),
  create: (data: { tableName: string; columns: any[] }) => api.post('/tables/create', data),
  drop: (tableName: string) => api.delete(`/tables/${tableName}`),
  truncate: (tableName: string) => api.post(`/tables/${tableName}/truncate`),
  compare: (tableName: string, compareWith: string) => api.get(`/tables/${tableName}/compare`, { params: { compareWith } }),
  getIndexes: (tableName: string) => api.get(`/tables/${tableName}/indexes`),
  createIndex: (tableName: string, data: { indexName: string; columns: string[]; unique?: boolean }) => api.post(`/tables/${tableName}/indexes`, data),
  dropIndex: (tableName: string, indexName: string) => api.delete(`/tables/${tableName}/indexes/${indexName}`),
  backup: (tableName: string) => api.post(`/tables/${tableName}/backup`),
  restore: (sql: string) => api.post('/tables/restore', { sql }),
}

export const dataApi = {
  query: (tableName: string, params?: any) => api.get(`/data/${tableName}`, { params }),
  count: (tableName: string) => api.get(`/data/${tableName}/count`),
  insert: (tableName: string, data: Record<string, unknown>) => api.post(`/data/${tableName}`, data),
  update: (tableName: string, data: Record<string, unknown>, where: Record<string, unknown>) => api.put(`/data/${tableName}`, { data, where }),
  delete: (tableName: string, where: Record<string, unknown>) => api.delete(`/data/${tableName}`, { where }),
  createSnapshot: (tableName: string, snapshotName: string) => api.post(`/data/${tableName}/snapshot`, { snapshotName }),
  getSnapshots: (tableName: string) => api.get(`/data/${tableName}/snapshots`),
  restoreSnapshot: (tableName: string, snapshotId: number) => api.post(`/data/${tableName}/snapshots/${snapshotId}/restore`),
  deleteSnapshot: (tableName: string, snapshotId: number) => api.delete(`/data/${tableName}/snapshots/${snapshotId}`),
}

export const sqlApi = {
  execute: (sql: string) => api.post('/sql/execute', { sql }),
  format: (sql: string) => api.post('/sql/format', { sql }),
  validate: (sql: string) => api.post('/sql/validate', { sql }),
  explain: (sql: string) => api.post('/sql/explain', { sql }),
  batch: (sqls: string[]) => api.post('/sql/batch', { sqls }),
  getHistory: (params?: any) => api.get('/sql/history', { params }),
  getHistoryPlan: (id: number) => api.get(`/sql/history/${id}/plan`),
  clearHistory: (beforeDate?: string) => api.delete('/sql/history', { data: { beforeDate } }),
}

export const logApi = {
  operations: (params?: any) => api.get('/logs/operations', { params }),
  errors: (params?: any) => api.get('/logs/errors', { params }),
  clearOperations: (beforeDate?: string) => api.delete('/logs/operations', { data: { beforeDate } }),
  clearErrors: (beforeDate?: string) => api.delete('/logs/errors', { data: { beforeDate } }),
  getAlertRules: () => api.get('/logs/alert-rules'),
  createAlertRule: (data: any) => api.post('/logs/alert-rules', data),
  updateAlertRule: (id: number, data: any) => api.put(`/logs/alert-rules/${id}`, data),
  deleteAlertRule: (id: number) => api.delete(`/logs/alert-rules/${id}`),
  checkAlerts: () => api.post('/logs/check-alerts'),
  getAlerts: (params?: any) => api.get('/logs/alerts', { params }),
  archiveLogs: (data: { logType: string; archiveDate: string }) => api.post('/logs/archive', data),
  getArchives: () => api.get('/logs/archives'),
}

export const routeApi = {
  list: () => api.get('/routes'),
}

export const contentApi = {
  getCategories: () => api.get('/content/categories'),
  createCategory: (data: { name: string; description?: string; sort_order?: number }) => api.post('/content/categories', data),
  updateCategory: (id: number, data: { name: string; description?: string; sort_order?: number }) => api.put(`/content/categories/${id}`, data),
  deleteCategory: (id: number) => api.delete(`/content/categories/${id}`),
  getArticles: (params?: any) => api.get('/content/articles', { params }),
  getArticle: (id: number) => api.get(`/content/articles/${id}`),
  createArticle: (data: { title: string; content: string; category_id?: number; cover_image?: string; images?: string[] }) => api.post('/content/articles', data),
  updateArticle: (id: number, data: { title: string; content: string; category_id?: number; cover_image?: string; images?: string[] }) => api.put(`/content/articles/${id}`, data),
  deleteArticle: (id: number) => api.delete(`/content/articles/${id}`),
  submitArticle: (id: number) => api.post(`/content/articles/${id}/submit`),
  approveArticle: (id: number, data?: { comment?: string }) => api.post(`/content/articles/${id}/approve`, data),
  rejectArticle: (id: number, data: { reason: string }) => api.post(`/content/articles/${id}/reject`, data),
  getAuditLogs: (params?: any) => api.get('/content/audit-logs', { params }),
}

export const orderApi = {
  getOrders: (params?: any) => api.get('/orders', { params }),
  getOrder: (id: number) => api.get(`/orders/${id}`),
  updateStatus: (id: number, data: { status: string; remark?: string }) => api.put(`/orders/${id}/status`, data),
  getOrderItems: (id: number) => api.get(`/orders/${id}/items`),
  getStatusLogs: (id: number) => api.get(`/orders/${id}/status-logs`),
}

export const serviceApi = {
  getTickets: (params?: any) => api.get('/tickets', { params }),
  getTicket: (id: number) => api.get(`/tickets/${id}`),
  updateTicket: (id: number, data: { status?: string; priority?: string; assigned_to?: number }) => api.put(`/tickets/${id}`, data),
  getTicketMessages: (id: number) => api.get(`/tickets/${id}/messages`),
  replyTicket: (id: number, data: { message: string; is_internal?: boolean }) => api.post(`/tickets/${id}/messages`, data),
}

export const toolApi = {
  getTools: () => api.get('/tools'),
  createTool: (data: any) => api.post('/tools', data),
  updateTool: (id: number, data: any) => api.put(`/tools/${id}`, data),
  deleteTool: (id: number) => api.delete(`/tools/${id}`),
  getToolConfigs: (id: number) => api.get(`/tools/${id}/configs`),
  createToolConfig: (id: number, data: any) => api.post(`/tools/${id}/configs`, data),
  updateToolConfig: (id: number, configKey: string, data: any) => api.put(`/tools/${id}/configs/${configKey}`, data),
  deleteToolConfig: (id: number, configKey: string) => api.delete(`/tools/${id}/configs/${configKey}`),
  incrementToolUsage: (id: number) => api.post(`/tools/${id}/increment-usage`),
}

export const feedbackApi = {
  getFeedbacks: (params?: any) => api.get('/feedbacks', { params }),
  getFeedback: (id: number) => api.get(`/feedbacks/${id}`),
  createFeedback: (data: any) => api.post('/feedbacks', data),
  updateFeedback: (id: number, data: any) => api.put(`/feedbacks/${id}`, data),
  getTemplates: (params?: any) => api.get('/feedback/templates', { params }),
  createTemplate: (data: any) => api.post('/feedback/templates', data),
  addFaqRelation: (id: number, data: any) => api.post(`/feedbacks/${id}/faq`, data),
  getSlaRules: () => api.get('/feedback/sla-rules'),
  createSlaRule: (data: any) => api.post('/feedback/sla-rules', data),
  addNote: (id: number, data: any) => api.post(`/feedbacks/${id}/notes`, data),
}

export const faqApi = {
  getFaqs: () => api.get('/faqs'),
  createFaq: (data: any) => api.post('/faqs', data),
  updateFaq: (id: number, data: any) => api.put(`/faqs/${id}`, data),
  deleteFaq: (id: number) => api.delete(`/faqs/${id}`),
}

export const systemConfigApi = {
  getConfigs: () => api.get('/system-configs'),
  createConfig: (data: any) => api.post('/system-configs', data),
  updateConfig: (configKey: string, data: any) => api.put(`/system-configs/${configKey}`, data),
  deleteConfig: (configKey: string) => api.delete(`/system-configs/${configKey}`),
}

// 第三方集成API
export const integrationApi = {
  // 消息通知
  notification: {
    getChannels: () => api.get('/integrations/notification/channels'),
    createChannel: (data: any) => api.post('/integrations/notification/channels', data),
    updateChannel: (id: number, data: any) => api.put(`/integrations/notification/channels/${id}`, data),
    deleteChannel: (id: number) => api.delete(`/integrations/notification/channels/${id}`),
    getNotifications: (params?: any) => api.get('/integrations/notification/notifications', { params }),
    sendNotification: (data: any) => api.post('/integrations/notification/send', data),
  },
  // 日志系统
  log: {
    getChannels: () => api.get('/integrations/log/channels'),
    createChannel: (data: any) => api.post('/integrations/log/channels', data),
    updateChannel: (id: number, data: any) => api.put(`/integrations/log/channels/${id}`, data),
    deleteChannel: (id: number) => api.delete(`/integrations/log/channels/${id}`),
  },
  // 支付集成
  payment: {
    getGateways: () => api.get('/integrations/payment/gateways'),
    createGateway: (data: any) => api.post('/integrations/payment/gateways', data),
    updateGateway: (id: number, data: any) => api.put(`/integrations/payment/gateways/${id}`, data),
    deleteGateway: (id: number) => api.delete(`/integrations/payment/gateways/${id}`),
    getTransactions: (params?: any) => api.get('/integrations/payment/transactions', { params }),
    processPayment: (data: any) => api.post('/integrations/payment/process', data),
  },
}

// 开放API
export const openApi = {
  // OAuth2.0
  oauth: {
    getToken: (data: any) => api.post('/oauth/token', data),
    refreshToken: (data: any) => api.post('/oauth/refresh', data),
  },
  // API密钥
  apiKeys: {
    getKeys: () => api.get('/api-keys'),
    createKey: (data: any) => api.post('/api-keys', data),
    deleteKey: (id: number) => api.delete(`/api-keys/${id}`),
  },
  // 调用统计
  apiCalls: {
    getCalls: (params?: any) => api.get('/api-calls', { params }),
    getStats: (params?: any) => api.get('/api-calls/stats', { params }),
  },
  // 健康检查
  health: () => api.get('/health'),
}

// 运维优化API
export const operationsApi = {
  // 健康检查管理
  healthChecks: {
    getChecks: () => api.get('/health-checks'),
  },
  // 自动备份管理
  backup: {
    getConfigs: () => api.get('/backup/configs'),
    createConfig: (data: any) => api.post('/backup/configs', data),
    getRecords: () => api.get('/backup/records'),
  },
  // 版本管理
  versions: {
    getVersions: () => api.get('/versions'),
    createVersion: (data: any) => api.post('/versions', data),
  },
  // 系统监控
  system: {
    getMetrics: () => api.get('/system/metrics'),
  },
}

export default api
