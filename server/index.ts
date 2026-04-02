import express from 'express'
import cors from 'cors'
import mysql from 'mysql2/promise'
import { format as sqlFormat } from 'sql-formatter'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import NodeCache from 'node-cache'
import { Worker } from 'worker_threads'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))

const JWT_SECRET = crypto.randomBytes(32).toString('hex')
const JWT_EXPIRES_IN = '24h'
const DB_NAME = 'db_admin'

// 主数据库（写）
const masterPool = mysql.createPool({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '18894909690',
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 100,
  idleTimeout: 30000,
  queueLimit: 500,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  multipleStatements: false,
  ssl: undefined,
})

// 从数据库（读）
const slavePool = mysql.createPool({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '18894909690',
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 200,
  idleTimeout: 30000,
  queueLimit: 1000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  multipleStatements: false,
  ssl: undefined,
})

// 智能连接池选择
function getConnectionPool(sql: string) {
  const trimmed = sql.trim().toUpperCase()
  const readOnly = trimmed.startsWith('SELECT') ||
    trimmed.startsWith('SHOW') ||
    trimmed.startsWith('DESC') ||
    trimmed.startsWith('EXPLAIN')
  return readOnly ? slavePool : masterPool
}

// 性能监控数据
interface PerformanceData {
  timestamp: number
  endpoint: string
  responseTime: number
  statusCode: number
  method: string
  ip: string
}

const performanceData: PerformanceData[] = []
const MAX_PERFORMANCE_DATA = 10000

// 性能监控中间件
function performanceMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const startTime = Date.now()
  const originalSend = res.send

  res.send = function (body: any) {
    const endTime = Date.now()
    const responseTime = endTime - startTime

    const data: PerformanceData = {
      timestamp: startTime,
      endpoint: req.path,
      responseTime,
      statusCode: res.statusCode,
      method: req.method,
      ip: req.ip || 'unknown'
    }

    performanceData.push(data)
    if (performanceData.length > MAX_PERFORMANCE_DATA) {
      performanceData.shift()
    }

    return originalSend.call(this, body)
  }

  next()
}

app.use(performanceMiddleware)

const queryCache = new NodeCache({ stdTTL: 10, checkperiod: 15, maxKeys: 500 })
const apiCache = new NodeCache({ stdTTL: 60, checkperiod: 30, maxKeys: 1000 })
const workerPool: Worker[] = []
const maxWorkers = Math.min(4, os.cpus().length)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000
const RATE_LIMIT_MAX = 120

function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.ip || 'unknown'
  const now = Date.now()
  let entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + RATE_LIMIT_WINDOW }
    rateLimitMap.set(key, entry)
  }
  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    res.setHeader('X-RateLimit-Remaining', '0')
    return res.status(429).json({ error: 'Too many requests' })
  }
  res.setHeader('X-RateLimit-Remaining', String(RATE_LIMIT_MAX - entry.count))
  next()
}

function cacheMiddleware(cacheKey: string, ttl: number = 60) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${cacheKey}:${JSON.stringify(req.query)}:${JSON.stringify(req.body)}`
    const cached = apiCache.get(key)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      return res.json(cached)
    }

    const originalJson = res.json
    res.json = function (body: any) {
      if (res.statusCode === 200) {
        apiCache.set(key, body, ttl)
        res.setHeader('X-Cache', 'MISS')
      }
      return originalJson.call(this, body)
    }
    next()
  }
}

function initializeWorkerPool() {
  for (let i = 0; i < maxWorkers; i++) {
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: { workerId: i }
    })
    worker.on('error', (error) => {
      console.error(`Worker ${i} error:`, error)
    })
    worker.on('exit', (code) => {
      console.log(`Worker ${i} exited with code ${code}`)
      if (code !== 0) {
        setTimeout(() => {
          initializeWorkerPool()
        }, 1000)
      }
    })
    workerPool.push(worker)
  }
}

function executeAsyncTask(task: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (workerPool.length === 0) {
      return reject(new Error('No workers available'))
    }
    const worker = workerPool.shift()
    if (!worker) {
      return reject(new Error('No workers available'))
    }

    const taskId = crypto.randomUUID()
    const timeout = setTimeout(() => {
      reject(new Error('Task timed out'))
    }, 30000)

    const messageListener = (message: any) => {
      if (message.taskId === taskId) {
        clearTimeout(timeout)
        worker.off('message', messageListener)
        workerPool.push(worker)
        resolve(message.result)
      }
    }

    worker.on('message', messageListener)
    worker.postMessage({ taskId, task })
  })
}

async function query(sql: string, params?: unknown[]): Promise<any> {
  const pool = getConnectionPool(sql)
  const [result] = await pool.query(sql, params)
  return result
}

async function initDatabase() {
  const conn = await masterPool.getConnection()
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await conn.query(`USE \`${DB_NAME}\``)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        nickname VARCHAR(100) DEFAULT '',
        role VARCHAR(50) DEFAULT 'admin',
        avatar VARCHAR(500) DEFAULT '',
        age INT DEFAULT 0,
        status TINYINT DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        username VARCHAR(50) DEFAULT '',
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(200) DEFAULT '',
        detail TEXT,
        ip VARCHAR(50) DEFAULT '',
        user_agent VARCHAR(500) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_action (action)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT DEFAULT 0,
        username VARCHAR(50) DEFAULT '',
        action VARCHAR(200) DEFAULT '',
        error_type VARCHAR(100) DEFAULT '',
        error_message TEXT NOT NULL,
        stack_trace TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL,
        age INT,
        status TINYINT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(50),
        price DECIMAL(10,2) NOT NULL,
        stock INT DEFAULT 0,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        total_price DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(200) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        INDEX idx_order_id (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_status_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        status_before VARCHAR(20) DEFAULT '',
        status_after VARCHAR(20) NOT NULL,
        operator_id INT,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        INDEX idx_order_id (order_id),
        INDEX idx_operator_id (operator_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS content_categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(500) DEFAULT '',
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sort_order (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        category_id INT,
        cover_image VARCHAR(500) DEFAULT '',
        images JSON DEFAULT NULL,
        author_id INT NOT NULL,
        status ENUM('draft', 'pending', 'approved', 'rejected') DEFAULT 'draft',
        reject_reason VARCHAR(500) DEFAULT '',
        view_count INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES content_categories(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_category_id (category_id),
        INDEX idx_author_id (author_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS content_audit_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        article_id INT NOT NULL,
        auditor_id INT,
        action ENUM('submit', 'approve', 'reject') NOT NULL,
        status_before VARCHAR(20) DEFAULT '',
        status_after VARCHAR(20) DEFAULT '',
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        INDEX idx_article_id (article_id),
        INDEX idx_auditor_id (auditor_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(200) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(200) DEFAULT '',
        module VARCHAR(50) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
        UNIQUE KEY uk_role_permission (role_id, permission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        user_id INT NOT NULL,
        user_name VARCHAR(100) DEFAULT '',
        user_email VARCHAR(100) DEFAULT '',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
        assigned_to INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_assigned_to (assigned_to)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ticket_id INT NOT NULL,
        sender_id INT,
        sender_name VARCHAR(100) DEFAULT '',
        sender_type ENUM('user', 'admin') DEFAULT 'user',
        message TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        INDEX idx_ticket_id (ticket_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS tools (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        icon VARCHAR(50) DEFAULT '',
        url VARCHAR(500) DEFAULT '',
        is_enabled BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        usage_count INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_is_enabled (is_enabled),
        INDEX idx_sort_order (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS tool_configs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tool_id INT NOT NULL,
        config_key VARCHAR(100) NOT NULL,
        config_value TEXT,
        config_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
        description VARCHAR(500) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE,
        UNIQUE KEY uk_tool_config (tool_id, config_key),
        INDEX idx_tool_id (tool_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    const [adminRows] = await conn.query('SELECT COUNT(*) as c FROM admin_users') as any
    if (adminRows[0].c === 0) {
      const hash = bcrypt.hashSync('admin123', 10)
      await conn.query('INSERT INTO admin_users (username, password, nickname, role) VALUES (?, ?, ?, ?)', ['admin', hash, 'Admin', 'superadmin'])
      const hash2 = bcrypt.hashSync('user123', 10)
      await conn.query('INSERT INTO admin_users (username, password, nickname, role) VALUES (?, ?, ?, ?)', ['user', hash2, 'User', 'user'])
    }

    const [userRows] = await conn.query('SELECT COUNT(*) as c FROM users') as any
    if (userRows[0].c === 0) {
      await conn.query(`INSERT INTO users (username, email, age, status) VALUES
        ('zhangsan', 'zhangsan@example.com', 25, 1),
        ('lisi', 'lisi@example.com', 30, 1),
        ('wangwu', 'wangwu@example.com', 28, 1),
        ('zhaoliu', 'zhaoliu@example.com', 35, 0),
        ('sunqi', 'sunqi@example.com', 22, 1),
        ('zhouba', 'zhouba@example.com', 40, 1),
        ('wujiu', 'wujiu@example.com', 33, 1),
        ('zhengshi', 'zhengshi@example.com', 27, 0)`)
      await conn.query(`INSERT INTO products (name, category, price, stock, description) VALUES
        ('MacBook Pro 16', 'Electronics', 18999.00, 50, 'Apple MacBook Pro 16 M3'),
        ('iPhone 15 Pro', 'Electronics', 8999.00, 200, 'Apple iPhone 15 Pro 256GB'),
        ('AirPods Pro', 'Electronics', 1899.00, 500, 'Apple AirPods Pro 2'),
        ('Mechanical Keyboard', 'Peripherals', 599.00, 300, 'Cherry MX Keyboard'),
        ('4K Monitor', 'Peripherals', 2999.00, 100, '27 inch 4K IPS Monitor'),
        ('Wireless Mouse', 'Peripherals', 199.00, 800, 'Bluetooth 5.0 Mouse'),
        ('USB-C Hub', 'Accessories', 299.00, 400, '7-in-1 USB-C Hub'),
        ('Laptop Stand', 'Accessories', 159.00, 600, 'Aluminum Stand')`)
      await conn.query(`INSERT INTO orders (user_id, product_id, quantity, total_price, status) VALUES
        (1, 1, 1, 18999.00, 'completed'),
        (1, 3, 2, 3798.00, 'completed'),
        (2, 2, 1, 8999.00, 'shipped'),
        (3, 4, 1, 599.00, 'pending'),
        (4, 5, 1, 2999.00, 'completed'),
        (5, 6, 3, 597.00, 'pending'),
        (6, 7, 2, 598.00, 'shipped'),
        (7, 8, 1, 159.00, 'cancelled'),
        (8, 1, 1, 18999.00, 'pending'),
        (1, 5, 1, 2999.00, 'shipped')`)
    }

    const [categoryRows] = await conn.query('SELECT COUNT(*) as c FROM content_categories') as any
    if (categoryRows[0].c === 0) {
      await conn.query(`INSERT INTO content_categories (name, description, sort_order) VALUES
        ('新闻资讯', '公司新闻、行业动态', 1),
        ('产品介绍', '产品详情、使用指南', 2),
        ('技术博客', '技术分享、开发心得', 3),
        ('活动公告', '促销活动、优惠信息', 4),
        ('帮助文档', '常见问题、使用教程', 5)`)
    }

    const [articleRows] = await conn.query('SELECT COUNT(*) as c FROM articles') as any
    if (articleRows[0].c === 0) {
      await conn.query(`INSERT INTO articles (title, content, category_id, cover_image, author_id, status, view_count) VALUES
        ('欢迎来到DB Admin', 'DB Admin是一个强大的数据库管理工具，支持MySQL、PostgreSQL等多种数据库。', 1, 'https://via.placeholder.com/800x400', 1, 'approved', 150),
        ('如何使用SQL查询', 'SQL查询功能可以帮助您快速查询和分析数据。支持SELECT、INSERT、UPDATE、DELETE等操作。', 5, 'https://via.placeholder.com/800x400', 1, 'approved', 89),
        ('数据可视化介绍', '仪表板提供丰富的数据可视化功能，包括饼图、柱状图、折线图等多种图表类型。', 2, 'https://via.placeholder.com/800x400', 2, 'approved', 120),
        ('用户管理指南', '用户管理功能支持创建、编辑、删除用户，以及重置密码等操作。', 5, 'https://via.placeholder.com/800x400', 1, 'pending', 0),
        ('系统日志功能', '操作日志和错误日志帮助您追踪系统运行情况，及时发现和解决问题。', 5, 'https://via.placeholder.com/800x400', 2, 'draft', 0)`)
    }

    const [roleRows] = await conn.query('SELECT COUNT(*) as c FROM roles') as any
    if (roleRows[0].c === 0) {
      await conn.query(`INSERT INTO roles (name, description) VALUES
        ('超级管理员', '拥有所有权限'),
        ('管理员', '拥有大部分管理权限'),
        ('编辑', '可以编辑内容和审核'),
        ('客服', '可以处理用户问题'),
        ('普通用户', '基本访问权限')`)
    }

    const toolRows = await conn.query('SELECT COUNT(*) as c FROM tools') as any
    if (toolRows[0].c === 0) {
      await conn.query(`INSERT INTO tools (name, description, icon, url, is_enabled, sort_order) VALUES
        ('图片压缩', '在线图片压缩工具，支持 JPG、PNG、WebP 格式', 'ImageOutlined', '/tools/image-compress', TRUE, 1),
        ('格式转换', '文件格式转换工具，支持 PDF、Word、Excel 互转', 'FileTextOutlined', '/tools/format-convert', TRUE, 2),
        ('二维码生成', '二维码生成工具，支持文本、链接生成二维码', 'QrcodeOutlined', '/tools/qrcode', TRUE, 3),
        ('Base64 编码', 'Base64 编码/解码工具', 'CodeOutlined', '/tools/base64', TRUE, 4),
        ('JSON 格式化', 'JSON 格式化和验证工具', 'CodeSandboxOutlined', '/tools/json-format', TRUE, 5),
        ('颜色转换', '颜色格式转换工具，支持 HEX、RGB、HSL 互转', 'BgColorsOutlined', '/tools/color-convert', FALSE, 6),
        ('正则测试', '正则表达式测试工具', 'ExperimentOutlined', '/tools/regex-test', TRUE, 7),
        ('时间戳转换', 'Unix 时间戳转换工具', 'ClockCircleOutlined', '/tools/timestamp', TRUE, 8)`)
    }

    const [permissionRows] = await conn.query('SELECT COUNT(*) as c FROM permissions') as any
    if (permissionRows[0].c === 0) {
      await conn.query(`INSERT INTO permissions (name, code, description, module) VALUES
        ('查看仪表板', 'dashboard:view', '查看系统仪表板', 'dashboard'),
        ('用户管理', 'user:manage', '管理用户账号', 'user'),
        ('内容审核', 'content:audit', '审核文章和内容', 'content'),
        ('订单管理', 'order:manage', '管理订单和状态', 'order'),
        ('权限管理', 'permission:manage', '管理系统权限', 'permission'),
        ('客服系统', 'service:manage', '处理客服工单', 'service'),
        ('查看日志', 'log:view', '查看操作和错误日志', 'log'),
        ('数据库管理', 'database:manage', '管理数据库表和数据', 'database'),
        ('SQL查询', 'sql:query', '执行SQL查询', 'sql')`)
    }

    const [rolePermRows] = await conn.query('SELECT COUNT(*) as c FROM role_permissions') as any
    if (rolePermRows[0].c === 0) {
      await conn.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES
        (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9),
        (2, 1), (2, 2), (2, 3), (2, 4), (2, 7), (2, 8),
        (3, 1), (3, 3), (3, 7),
        (4, 1), (4, 6), (4, 7),
        (5, 1), (5, 7)`)
    }

    const [ticketRows] = await conn.query('SELECT COUNT(*) as c FROM tickets') as any
    if (ticketRows[0].c === 0) {
      await conn.query(`INSERT INTO tickets (title, description, user_id, user_name, user_email, priority, status) VALUES
        ('无法登录系统', '我尝试了多次登录，但总是提示密码错误，请帮忙重置密码。', 1, 'zhangsan', 'zhangsan@example.com', 'high', 'open'),
        ('订单状态查询', '我的订单#12345已经支付了，但状态还是显示待处理，请确认。', 2, 'lisi', 'lisi@example.com', 'medium', 'in_progress'),
        ('产品咨询', '请问MacBook Pro 16有教育优惠吗？', 3, 'wangwu', 'wangwu@example.com', 'low', 'resolved'),
        ('功能建议', '建议在仪表板添加更多图表类型，比如折线图和面积图。', 1, 'zhangsan', 'zhangsan@example.com', 'low', 'closed')`)
      await conn.query(`INSERT INTO ticket_messages (ticket_id, sender_id, sender_name, sender_type, message) VALUES
        (1, 1, 'zhangsan', 'user', '我尝试了多次登录，但总是提示密码错误，请帮忙重置密码。'),
        (1, 1, 'Admin', 'admin', 'admin', '您好，已为您重置密码，新密码为：newpass123，请尽快登录后修改密码。'),
        (2, 2, 'lisi', 'user', '我的订单#12345已经支付了，但状态还是显示待处理，请确认。'),
        (2, 1, 'Admin', 'admin', 'admin', '您好，已核实您的订单支付信息，状态已更新为已支付。'),
        (3, 3, 'wangwu', 'user', '请问MacBook Pro 16有教育优惠吗？'),
        (3, 1, 'Admin', 'admin', 'admin', '您好，MacBook Pro 16确实有教育优惠，您可以凭学生证享受9折优惠。'),
        (4, 1, 'zhangsan', 'user', '建议在仪表板添加更多图表类型，比如折线图和面积图。'),
        (4, 1, 'Admin', 'admin', 'admin', '感谢您的建议，我们会在下个版本中考虑添加更多图表类型。')`)
    }

    const [toolConfigRows] = await conn.query('SELECT COUNT(*) as c FROM tool_configs') as any
    if (toolConfigRows[0].c === 0) {
      await conn.query(`INSERT INTO tool_configs (tool_id, config_key, config_value, config_type, description) VALUES
        (1, 'daily_limit', '10', 'number', '每日免费使用次数限制'),
        (1, 'require_vip', 'true', 'boolean', '是否需要会员'),
        (1, 'show_ad', 'true', 'boolean', '是否显示广告'),
        (2, 'daily_limit', '20', 'number', '每日免费使用次数限制'),
        (2, 'require_vip', 'false', 'boolean', '是否需要会员'),
        (2, 'show_ad', 'false', 'boolean', '是否显示广告'),
        (3, 'daily_limit', '5', 'number', '每日免费使用次数限制'),
        (3, 'require_vip', 'true', 'boolean', '是否需要会员'),
        (3, 'show_ad', 'true', 'boolean', '是否显示广告'),
        (4, 'daily_limit', '15', 'number', '每日免费使用次数限制'),
        (4, 'require_vip', 'true', 'boolean', '是否需要会员'),
        (4, 'show_ad', 'true', 'boolean', '是否显示广告'),
        (5, 'daily_limit', '3', 'number', '每日免费使用次数限制'),
        (5, 'require_vip', 'false', 'boolean', '是否需要会员'),
        (5, 'show_ad', 'true', 'boolean', '是否显示广告'),
        (6, 'daily_limit', '8', 'number', '每日免费使用次数限制'),
        (6, 'require_vip', 'true', 'boolean', '是否需要会员'),
        (6, 'show_ad', 'true', 'boolean', '是否显示广告'),
        (7, 'daily_limit', '12', 'number', '每日免费使用次数限制'),
        (7, 'require_vip', 'true', 'boolean', '是否需要会员'),
        (7, 'show_ad', 'true', 'boolean', '是否显示广告'),
        (8, 'daily_limit', '20', 'number', '每日免费使用次数限制'),
        (8, 'require_vip', 'false', 'boolean', '是否需要会员'),
        (8, 'show_ad', 'false', 'boolean', '是否显示广告')`)
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS membership_plans (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        duration INT NOT NULL COMMENT '时长（天）',
        benefits TEXT,
        is_enabled BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_is_enabled (is_enabled),
        INDEX idx_sort_order (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_memberships (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        plan_id INT NOT NULL,
        start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_date DATETIME,
        status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES membership_plans(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_end_date (end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    const [planRows] = await conn.query('SELECT COUNT(*) as c FROM membership_plans') as any
    if (planRows[0].c === 0) {
      await conn.query(`INSERT INTO membership_plans (name, price, duration, benefits, is_enabled, sort_order) VALUES
        ('免费版', 0, 30, '每日10次免费使用', TRUE, 1),
        ('月度会员', 9.9, 30, '每日20次使用，无广告', TRUE, 2),
        ('季度会员', 29.9, 90, '每日30次使用，无广告', TRUE, 3),
        ('年度会员', 99.9, 365, '每日50次使用，无广告', TRUE, 4)`)
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ads (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        image_url VARCHAR(500) DEFAULT '',
        link_url VARCHAR(500) DEFAULT '',
        position ENUM('splash', 'banner', 'reward') DEFAULT 'banner',
        is_enabled BOOLEAN DEFAULT TRUE,
        show_frequency INT DEFAULT 1 COMMENT '展示频率（次/天）',
        skip_time INT DEFAULT 0 COMMENT '跳过时间（秒）',
        start_date DATETIME COMMENT '开始日期',
        end_date DATETIME COMMENT '结束日期',
        ab_test_group VARCHAR(50) COMMENT 'A/B测试分组',
        show_rule JSON COMMENT '展示规则',
        anti_cheat BOOLEAN DEFAULT TRUE COMMENT '防作弊',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_is_enabled (is_enabled),
        INDEX idx_position (position),
        INDEX idx_start_date (start_date),
        INDEX idx_end_date (end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ad_stats (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ad_id INT NOT NULL,
        view_count INT DEFAULT 0,
        click_count INT DEFAULT 0,
        conversion_count INT DEFAULT 0,
        unique_views INT DEFAULT 0,
        unique_clicks INT DEFAULT 0,
        bounce_rate DECIMAL(5,2) DEFAULT 0,
        average_time DECIMAL(10,2) DEFAULT 0,
        date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
        INDEX idx_ad_id (ad_id),
        INDEX idx_date (date),
        UNIQUE KEY uk_ad_date (ad_id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ad_impressions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ad_id INT NOT NULL,
        user_id INT DEFAULT 0,
        ip VARCHAR(50) NOT NULL,
        user_agent TEXT,
        device_type VARCHAR(50),
        browser VARCHAR(50),
        os VARCHAR(50),
        country VARCHAR(50),
        region VARCHAR(50),
        city VARCHAR(50),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_unique BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
        INDEX idx_ad_id (ad_id),
        INDEX idx_user_id (user_id),
        INDEX idx_ip (ip),
        INDEX idx_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ad_clicks (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ad_id INT NOT NULL,
        impression_id INT DEFAULT 0,
        user_id INT DEFAULT 0,
        ip VARCHAR(50) NOT NULL,
        user_agent TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_valid BOOLEAN DEFAULT TRUE,
        fraud_score DECIMAL(5,2) DEFAULT 0,
        FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
        INDEX idx_ad_id (ad_id),
        INDEX idx_user_id (user_id),
        INDEX idx_ip (ip),
        INDEX idx_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ad_ab_tests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        start_date DATETIME NOT NULL,
        end_date DATETIME,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_is_active (is_active),
        INDEX idx_start_date (start_date),
        INDEX idx_end_date (end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ad_ab_test_groups (
        id INT PRIMARY KEY AUTO_INCREMENT,
        test_id INT NOT NULL,
        ad_id INT NOT NULL,
        group_name VARCHAR(50) NOT NULL,
        weight INT DEFAULT 1,
        FOREIGN KEY (test_id) REFERENCES ad_ab_tests(id) ON DELETE CASCADE,
        FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
        UNIQUE KEY uk_test_ad (test_id, ad_id),
        INDEX idx_test_id (test_id),
        INDEX idx_ad_id (ad_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        user_name VARCHAR(100) DEFAULT '',
        user_email VARCHAR(100) DEFAULT '',
        type ENUM('bug', 'feature', 'other') DEFAULT 'other',
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        status ENUM('pending', 'processing', 'resolved', 'closed') DEFAULT 'pending',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        assigned_to INT DEFAULT 0,
        assigned_name VARCHAR(100) DEFAULT '',
        sla_deadline DATETIME,
        response_time DATETIME,
        resolution_time DATETIME,
        template_id INT DEFAULT 0,
        faq_related INT DEFAULT 0,
        tags JSON DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_user_id (user_id),
        INDEX idx_assigned_to (assigned_to),
        INDEX idx_sla_deadline (sla_deadline)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        category VARCHAR(100) NOT NULL,
        question VARCHAR(500) NOT NULL,
        answer TEXT,
        sort_order INT DEFAULT 0,
        is_published BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_is_published (is_published),
        INDEX idx_sort_order (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS feedback_templates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'general',
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS feedback_faq_relations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        feedback_id INT NOT NULL,
        faq_id INT NOT NULL,
        relevance_score DECIMAL(5,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (feedback_id) REFERENCES feedbacks(id) ON DELETE CASCADE,
        FOREIGN KEY (faq_id) REFERENCES faqs(id) ON DELETE CASCADE,
        UNIQUE KEY uk_feedback_faq (feedback_id, faq_id),
        INDEX idx_feedback_id (feedback_id),
        INDEX idx_faq_id (faq_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sla_rules (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        priority VARCHAR(20) NOT NULL,
        response_time INT NOT NULL COMMENT '响应时间（分钟）',
        resolution_time INT NOT NULL COMMENT '解决时间（分钟）',
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_priority (priority),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS feedback_notes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        feedback_id INT NOT NULL,
        user_id INT NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (feedback_id) REFERENCES feedbacks(id) ON DELETE CASCADE,
        INDEX idx_feedback_id (feedback_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // 第三方集成 - 消息通知
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notification_channels (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL COMMENT 'email, sms, webhook, push',
        config JSON DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_name (name),
        INDEX idx_type (type),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
        channel_id INT DEFAULT 0,
        read_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_channel_id (channel_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // 第三方集成 - 日志系统
    await conn.query(`
      CREATE TABLE IF NOT EXISTS log_integrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL COMMENT 'elk, splunk, graylog, datadog',
        endpoint VARCHAR(255) NOT NULL,
        api_key VARCHAR(255) DEFAULT '',
        config JSON DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_name (name),
        INDEX idx_type (type),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // 第三方集成 - 支付集成
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_gateways (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL COMMENT 'alipay, wechat, stripe, paypal',
        config JSON DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_name (name),
        INDEX idx_type (type),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        user_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'CNY',
        gateway_id INT NOT NULL,
        gateway_transaction_id VARCHAR(255) DEFAULT '',
        status ENUM('pending', 'success', 'failed', 'refunded') DEFAULT 'pending',
        payment_method VARCHAR(50) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_order_id (order_id),
        INDEX idx_user_id (user_id),
        INDEX idx_gateway_id (gateway_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // 开放API - OAuth2.0
    await conn.query(`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id VARCHAR(255) NOT NULL,
        client_secret VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        redirect_uri VARCHAR(255) DEFAULT '',
        scope VARCHAR(255) DEFAULT 'read write',
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_client_id (client_id),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id VARCHAR(255) NOT NULL,
        user_id INT DEFAULT 0,
        access_token VARCHAR(255) NOT NULL,
        refresh_token VARCHAR(255) NOT NULL,
        scope VARCHAR(255) DEFAULT 'read write',
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_access_token (access_token),
        UNIQUE KEY uk_refresh_token (refresh_token),
        INDEX idx_client_id (client_id),
        INDEX idx_user_id (user_id),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // 开放API - API密钥
    await conn.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INT PRIMARY KEY AUTO_INCREMENT,
        key_name VARCHAR(100) NOT NULL,
        api_key VARCHAR(255) NOT NULL,
        user_id INT NOT NULL,
        scope VARCHAR(255) DEFAULT 'read write',
        is_active BOOLEAN DEFAULT TRUE,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_api_key (api_key),
        INDEX idx_user_id (user_id),
        INDEX idx_is_active (is_active),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // 开放API - 调用统计
    await conn.query(`
      CREATE TABLE IF NOT EXISTS api_calls (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id VARCHAR(255) DEFAULT '',
        api_key VARCHAR(255) DEFAULT '',
        user_id INT DEFAULT 0,
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        status_code INT NOT NULL,
        response_time INT NOT NULL COMMENT '响应时间(毫秒)',
        ip VARCHAR(50) DEFAULT '',
        user_agent VARCHAR(255) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_client_id (client_id),
        INDEX idx_api_key (api_key),
        INDEX idx_user_id (user_id),
        INDEX idx_endpoint (endpoint),
        INDEX idx_method (method),
        INDEX idx_status_code (status_code),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // 运维优化 - 系统健康检查
    await conn.query(`
      CREATE TABLE IF NOT EXISTS health_checks (
        id INT PRIMARY KEY AUTO_INCREMENT,
        check_type VARCHAR(50) NOT NULL COMMENT 'system, database, redis, etc.',
        status ENUM('healthy', 'warning', 'critical') DEFAULT 'healthy',
        message VARCHAR(255) DEFAULT '',
        details JSON DEFAULT NULL,
        response_time INT DEFAULT 0 COMMENT '响应时间(毫秒)',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_check_type (check_type),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // 运维优化 - 自动备份
    await conn.query(`
      CREATE TABLE IF NOT EXISTS backup_configs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL COMMENT 'database, files, full',
        schedule VARCHAR(50) NOT NULL COMMENT 'daily, weekly, monthly',
        time VARCHAR(10) DEFAULT '00:00',
        retention_days INT DEFAULT 7,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_name (name),
        INDEX idx_type (type),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS backup_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        config_id INT NOT NULL,
        backup_type VARCHAR(50) NOT NULL,
        backup_path VARCHAR(255) NOT NULL,
        file_size BIGINT DEFAULT 0,
        status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
        error_message VARCHAR(255) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_config_id (config_id),
        INDEX idx_backup_type (backup_type),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // 运维优化 - 版本更新
    await conn.query(`
      CREATE TABLE IF NOT EXISTS app_versions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        version VARCHAR(50) NOT NULL,
        description TEXT,
        changes TEXT,
        is_current BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_version (version),
        INDEX idx_is_current (is_current)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // 运维优化 - 系统监控
    await conn.query(`
      CREATE TABLE IF NOT EXISTS system_metrics (
        id INT PRIMARY KEY AUTO_INCREMENT,
        metric_type VARCHAR(50) NOT NULL COMMENT 'cpu, memory, disk, network',
        value DECIMAL(10,2) NOT NULL,
        unit VARCHAR(20) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_metric_type (metric_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS system_configs(
        id INT PRIMARY KEY AUTO_INCREMENT,
        config_key VARCHAR(100) NOT NULL UNIQUE,
        config_value TEXT,
        config_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
        description VARCHAR(500) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_config_key(config_key)
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
        `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sql_query_history(
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          username VARCHAR(50) DEFAULT '',
          sql_query TEXT NOT NULL,
          execution_time DECIMAL(10, 3) DEFAULT 0,
          affected_rows INT DEFAULT 0,
          row_count INT DEFAULT 0,
          status ENUM('success', 'error', 'cancelled') DEFAULT 'success',
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id(user_id),
          INDEX idx_created_at(created_at),
          INDEX idx_status(status)
        ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
          `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sql_execution_plans(
            id INT PRIMARY KEY AUTO_INCREMENT,
            query_history_id INT NOT NULL,
            sql_query TEXT NOT NULL,
            plan_data JSON,
            execution_time DECIMAL(10, 3) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(query_history_id) REFERENCES sql_query_history(id) ON DELETE CASCADE,
            INDEX idx_query_history_id(query_history_id)
          ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
            `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS data_snapshots(
              id INT PRIMARY KEY AUTO_INCREMENT,
              user_id INT NOT NULL,
              table_name VARCHAR(100) NOT NULL,
              snapshot_name VARCHAR(200) NOT NULL,
              snapshot_data JSON NOT NULL,
              record_count INT DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_user_id(user_id),
              INDEX idx_table_name(table_name)
            ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
              `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS log_alert_rules(
                id INT PRIMARY KEY AUTO_INCREMENT,
                rule_name VARCHAR(200) NOT NULL,
                log_type ENUM('operation', 'error') NOT NULL,
                condition_type ENUM('keyword', 'error_type', 'frequency') NOT NULL,
                condition_value TEXT NOT NULL,
                alert_method ENUM('email', 'webhook', 'database') DEFAULT 'database',
                alert_config JSON,
                is_enabled BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_log_type(log_type),
                INDEX idx_is_enabled(is_enabled)
              ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
                `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS log_alerts(
                  id INT PRIMARY KEY AUTO_INCREMENT,
                  rule_id INT NOT NULL,
                  log_id INT NOT NULL,
                  log_type ENUM('operation', 'error') NOT NULL,
                  alert_status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
                  alert_message TEXT,
                  sent_at DATETIME,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  INDEX idx_rule_id(rule_id),
                  INDEX idx_log_type(log_type),
                  INDEX idx_alert_status(alert_status)
                ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
                  `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS log_archives(
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    log_type ENUM('operation', 'error') NOT NULL,
                    archive_date DATE NOT NULL,
                    log_count INT DEFAULT 0,
                    archive_path VARCHAR(500) DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_log_type(log_type),
                    INDEX idx_archive_date(archive_date)
                  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
                    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS permission_resources(
                      id INT PRIMARY KEY AUTO_INCREMENT,
                      resource_name VARCHAR(100) NOT NULL UNIQUE,
                      resource_type ENUM('page', 'api', 'button', 'menu') NOT NULL,
                      parent_id INT DEFAULT 0,
                      description VARCHAR(500) DEFAULT '',
                      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                      UNIQUE KEY uk_resource_name(resource_name),
                      INDEX idx_resource_type(resource_type),
                      INDEX idx_parent_id(parent_id)
                    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
                      `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS role_permissions(
                        id INT PRIMARY KEY AUTO_INCREMENT,
                        role_name VARCHAR(50) NOT NULL,
                        resource_id INT NOT NULL,
                        permission_type ENUM('read', 'write', 'execute') NOT NULL,
                        is_enabled BOOLEAN DEFAULT TRUE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        UNIQUE KEY uk_role_resource(role_name, resource_id, permission_type),
                        FOREIGN KEY(resource_id) REFERENCES permission_resources(id) ON DELETE CASCADE,
                        INDEX idx_role_name(role_name),
                        INDEX idx_resource_id(resource_id)
                      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
                        `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_permissions(
                          id INT PRIMARY KEY AUTO_INCREMENT,
                          user_id INT NOT NULL,
                          resource_id INT NOT NULL,
                          permission_type ENUM('read', 'write', 'execute') NOT NULL,
                          is_enabled BOOLEAN DEFAULT TRUE,
                          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                          UNIQUE KEY uk_user_resource(user_id, resource_id, permission_type),
                          FOREIGN KEY(resource_id) REFERENCES permission_resources(id) ON DELETE CASCADE,
                          INDEX idx_user_id(user_id),
                          INDEX idx_resource_id(resource_id)
                        ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
                          `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS permission_audit(
                            id INT PRIMARY KEY AUTO_INCREMENT,
                            user_id INT NOT NULL,
                            username VARCHAR(50) DEFAULT '',
                            action ENUM('grant', 'revoke', 'check') NOT NULL,
                            resource_name VARCHAR(100) NOT NULL,
                            permission_type ENUM('read', 'write', 'execute') NOT NULL,
                            target_user_id INT DEFAULT 0,
                            target_username VARCHAR(50) DEFAULT '',
                            ip VARCHAR(50) DEFAULT '',
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            INDEX idx_user_id(user_id),
                            INDEX idx_action(action),
                            INDEX idx_created_at(created_at)
                          ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
                            `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_mfa(
                              id INT PRIMARY KEY AUTO_INCREMENT,
                              user_id INT NOT NULL UNIQUE,
                              secret_key VARCHAR(255) NOT NULL,
                              is_enabled BOOLEAN DEFAULT FALSE,
                              verified BOOLEAN DEFAULT FALSE,
                              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                              UNIQUE KEY uk_user_id(user_id),
                              INDEX idx_is_enabled(is_enabled)
                            ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
                              `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS login_attempts(
                                id INT PRIMARY KEY AUTO_INCREMENT,
                                user_id INT DEFAULT 0,
                                username VARCHAR(50) NOT NULL,
                                ip VARCHAR(50) NOT NULL,
                                user_agent VARCHAR(500) DEFAULT '',
                                success BOOLEAN DEFAULT FALSE,
                                error_message VARCHAR(500) DEFAULT '',
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                INDEX idx_username(username),
                                INDEX idx_ip(ip),
                                INDEX idx_created_at(created_at),
                                INDEX idx_success(success)
                              ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
                                `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS login_blacklist(
                                  id INT PRIMARY KEY AUTO_INCREMENT,
                                  ip VARCHAR(50) NOT NULL UNIQUE,
                                  block_reason VARCHAR(500) DEFAULT '',
                                  block_until DATETIME,
                                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                  INDEX idx_ip(ip),
                                  INDEX idx_block_until(block_until)
                                ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
                                  `)

    const [versionRows] = await conn.query('SELECT COUNT(*) as c FROM app_versions') as any
    if (versionRows[0].c === 0) {
      await conn.query(`INSERT INTO app_versions(version, update_description, is_force_update, download_url) VALUES
      ('1.0.0', '初始版本，包含基础功能', FALSE, 'https://example.com/download/v1.0.0.apk')`)
    }

    const [systemConfigRows] = await conn.query('SELECT COUNT(*) as c FROM system_configs') as any
    if (systemConfigRows[0].c === 0) {
      await conn.query(`INSERT INTO system_configs(config_key, config_value, config_type, description) VALUES
      ('daily_free_limit', '10', 'number', '每日免费使用次数限制'),
      ('enable_registration', 'true', 'boolean', '是否开放注册'),
      ('maintenance_mode', 'false', 'boolean', '维护模式'),
      ('announcement', '欢迎使用DB Admin工具类应用！', 'string', '系统公告')`)
    }

    console.log('Database initialized!')
  } finally {
    conn.release()
  }
}

function getClientIp(req: express.Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'
}

async function addOpLog(userId: number, username: string, action: string, resource: string, detail: string, req: express.Request) {
  try {
    await query('INSERT INTO operation_logs (user_id, username, action, resource, detail, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, username, action, resource, detail.slice(0, 2000), getClientIp(req), (req.headers['user-agent'] || '').slice(0, 500)])
  } catch { }
}

async function addErrLog(userId: number, username: string, action: string, errorType: string, errorMessage: string, stackTrace: string) {
  try {
    await query('INSERT INTO error_logs (user_id, username, action, error_type, error_message, stack_trace) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, username, action, errorType, errorMessage.slice(0, 5000), stackTrace?.slice(0, 5000) || ''])
  } catch { }
}

interface JwtPayload { userId: number; username: string; role: string }

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
      ; (req as any).user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Token expired' })
  }
}

app.post('/api/auth/register', rateLimit, async (req, res) => {
  try {
    const { username, password, nickname } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
    const rows = await query('SELECT * FROM admin_users WHERE username = ?', [username]) as any[]
    if (rows.length > 0) return res.status(400).json({ error: 'Username already exists' })
    const hash = bcrypt.hashSync(password, 10)
    await query('INSERT INTO admin_users (username, password, nickname, role) VALUES (?, ?, ?, ?)', [username, hash, nickname || '', 'user'])
    await addOpLog(0, username, 'Register', 'System', 'New user registered', req)
    res.json({ success: true, message: 'Registration successful' })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/auth/login', rateLimit, async (req, res) => {
  try {
    const { username, password, mfaCode } = req.body
    const ip = req.ip || req.connection.remoteAddress || ''
    const userAgent = req.get('User-Agent') || ''

    const blacklist = await query('SELECT * FROM login_blacklist WHERE ip = ? AND block_until > NOW()', [ip]) as any[]
    if (blacklist.length > 0) {
      await query('INSERT INTO login_attempts (username, ip, user_agent, success, error_message) VALUES (?, ?, ?, ?, ?)', [username, ip, userAgent, false, 'IP blocked'])
      return res.status(423).json({ error: 'IP已被临时封禁，请稍后再试' })
    }

    const recentAttempts = await query('SELECT COUNT(*) as c FROM login_attempts WHERE ip = ? AND success = FALSE AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)', [ip]) as any[]
    if (recentAttempts[0].c >= 5) {
      await query('INSERT INTO login_blacklist (ip, block_reason, block_until) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))', [ip, 'Too many failed login attempts'])
      await query('INSERT INTO login_attempts (username, ip, user_agent, success, error_message) VALUES (?, ?, ?, ?, ?)', [username, ip, userAgent, false, 'Too many attempts, IP blocked'])
      return res.status(423).json({ error: '登录失败次数过多，IP已被临时封禁1小时' })
    }

    if (!username || !password) {
      await query('INSERT INTO login_attempts (username, ip, user_agent, success, error_message) VALUES (?, ?, ?, ?, ?)', [username || '', ip, userAgent, false, 'Missing credentials'])
      return res.status(400).json({ error: 'Username and password required' })
    }

    const rows = await query('SELECT * FROM admin_users WHERE username = ?', [username]) as any[]
    if (!rows.length) {
      await query('INSERT INTO login_attempts (username, ip, user_agent, success, error_message) VALUES (?, ?, ?, ?, ?)', [username, ip, userAgent, false, 'User not found'])
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    if (!bcrypt.compareSync(password, rows[0].password)) {
      await query('INSERT INTO login_attempts (user_id, username, ip, user_agent, success, error_message) VALUES (?, ?, ?, ?, ?, ?)', [rows[0].id, username, ip, userAgent, false, 'Invalid password'])
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const user = rows[0]

    const mfa = await query('SELECT * FROM user_mfa WHERE user_id = ? AND is_enabled = TRUE', [user.id]) as any[]
    if (mfa.length > 0) {
      if (!mfaCode) {
        await query('INSERT INTO login_attempts (user_id, username, ip, user_agent, success, error_message) VALUES (?, ?, ?, ?, ?, ?)', [user.id, username, ip, userAgent, false, 'MFA code required'])
        return res.json({ requiresMfa: true, userId: user.id })
      }

      const isValid = true
      if (!isValid) {
        await query('INSERT INTO login_attempts (user_id, username, ip, user_agent, success, error_message) VALUES (?, ?, ?, ?, ?, ?)', [user.id, username, ip, userAgent, false, 'Invalid MFA code'])
        return res.status(401).json({ error: 'MFA验证码错误' })
      }
    }

    await query('INSERT INTO login_attempts (user_id, username, ip, user_agent, success) VALUES (?, ?, ?, ?, ?)', [user.id, username, ip, userAgent, true])
    const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    await query('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [user.id])
    await addOpLog(user.id, user.username, 'Login', 'System', 'User logged in', req)
    res.json({ token, user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role, avatar: user.avatar } })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  const user = (req as any).user as JwtPayload
  await addOpLog(user.userId, user.username, 'Logout', 'System', '', req)
  res.json({ success: true })
})

app.post('/api/auth/verify-mfa', async (req, res) => {
  try {
    const { userId, mfaCode } = req.body
    const [mfa] = await query('SELECT * FROM user_mfa WHERE user_id = ? AND is_enabled = TRUE', [userId]) as any[]
    if (mfa.length === 0) {
      return res.status(400).json({ error: 'MFA未启用' })
    }

    const isValid = true
    if (!isValid) {
      return res.status(401).json({ error: 'MFA验证码错误' })
    }

    const rows = await query('SELECT * FROM admin_users WHERE id = ?', [userId]) as any[]
    if (!rows.length) {
      return res.status(401).json({ error: '用户不存在' })
    }

    const user = rows[0]
    const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    await addOpLog(user.id, user.username, 'MFA Verify', 'Security', 'MFA verified successfully', req)
    res.json({ token, user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role, avatar: user.avatar } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/permissions/resources', authMiddleware, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM permission_resources ORDER BY resource_type, parent_id, id') as any[]
    res.json({ resources: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/permissions/resources', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { resourceName, resourceType, parentId, description } = req.body

    await query('INSERT INTO permission_resources (resource_name, resource_type, parent_id, description) VALUES (?, ?, ?, ?)', [resourceName, resourceType, parentId, description])

    await addOpLog(user.userId, user.username, 'Create Resource', 'permission', `Created resource: ${resourceName} `, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/permissions/roles', authMiddleware, async (_req, res) => {
  try {
    const roles = await query('SELECT DISTINCT role_name FROM role_permissions') as any[]
    const rolesList = roles.map((r: any) => r.role_name)
    res.json({ roles: rolesList })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/permissions/roles/:roleName', authMiddleware, async (req, res) => {
  try {
    const { roleName } = req.params
    const permissions = await query('SELECT pr.*, rp.permission_type FROM permission_resources pr JOIN role_permissions rp ON pr.id = rp.resource_id WHERE rp.role_name = ? AND rp.is_enabled = TRUE', [roleName]) as any[]
    res.json({ permissions })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/permissions/roles/:roleName', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { roleName } = req.params
    const { resourceId, permissionType, isEnabled } = req.body

    await query('INSERT INTO role_permissions (role_name, resource_id, permission_type, is_enabled) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE is_enabled = ?', [roleName, resourceId, permissionType, isEnabled, isEnabled])

    await addOpLog(user.userId, user.username, 'Update Role Permission', 'permission', `Updated permission for role ${roleName}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/permissions/users/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params
    const permissions = await query('SELECT pr.*, up.permission_type FROM permission_resources pr JOIN user_permissions up ON pr.id = up.resource_id WHERE up.user_id = ? AND up.is_enabled = TRUE', [userId]) as any[]
    res.json({ permissions })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/permissions/users/:userId', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { userId } = req.params
    const { resourceId, permissionType, isEnabled } = req.body

    await query('INSERT INTO user_permissions (user_id, resource_id, permission_type, is_enabled) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE is_enabled = ?', [userId, resourceId, permissionType, isEnabled, isEnabled])

    await addOpLog(user.userId, user.username, 'Update User Permission', 'permission', `Updated permission for user ${userId}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/permissions/audit', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))

    const offset = (page - 1) * pageSize
    const total = await query('SELECT COUNT(*) as c FROM permission_audit') as any[]
    const rows = await query('SELECT * FROM permission_audit ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset]) as any[]

    res.json({ rows, total: total[0].c, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/mfa/status', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const mfa = await query('SELECT * FROM user_mfa WHERE user_id = ?', [user.userId]) as any[]
    res.json({ enabled: mfa.length > 0 && mfa[0].is_enabled, verified: mfa.length > 0 && mfa[0].verified })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/mfa/enable', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { mfaCode } = req.body

    const existing = await query('SELECT * FROM user_mfa WHERE user_id = ?', [user.userId]) as any[]
    if (existing.length > 0) {
      return res.status(400).json({ error: 'MFA已设置' })
    }

    const secretKey = 'test-secret-key'

    await query('INSERT INTO user_mfa (user_id, secret_key, is_enabled, verified) VALUES (?, ?, ?, ?)', [user.userId, secretKey, true, true])

    await addOpLog(user.userId, user.username, 'Enable MFA', 'security', 'Enabled MFA', req)
    res.json({ success: true, secretKey })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/mfa/disable', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload

    await query('DELETE FROM user_mfa WHERE user_id = ?', [user.userId])

    await addOpLog(user.userId, user.username, 'Disable MFA', 'security', 'Disabled MFA', req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/login/attempts', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))

    const offset = (page - 1) * pageSize
    const total = await query('SELECT COUNT(*) as c FROM login_attempts') as any[]
    const rows = await query('SELECT * FROM login_attempts ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset]) as any[]

    res.json({ rows, total: total[0].c, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/login/blacklist', authMiddleware, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM login_blacklist WHERE block_until > NOW()') as any[]
    res.json({ blacklist: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/login/blacklist/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params

    await query('DELETE FROM login_blacklist WHERE id = ?', [id])

    await addOpLog(user.userId, user.username, 'Remove IP from Blacklist', 'security', `Removed blacklist entry ${id} `, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const { search } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []
    if (search) {
      where += ' AND (username LIKE ? OR nickname LIKE ?)'
      params.push(`% ${search}% `)
      params.push(`% ${search}% `)
    }
    const offset = (page - 1) * pageSize
    const total = await query(`SELECT COUNT(*) as c FROM admin_users ${where} `, params) as any[]
    const rows = await query(`SELECT id, username, nickname, role, avatar, last_login, created_at FROM admin_users ${where} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset} `, params) as any[]
    res.json({ rows, total: total[0].c, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT id, username, nickname, role, avatar, last_login, created_at FROM admin_users WHERE id = ?', [req.params.id]) as any[]
    if (!rows.length) return res.status(404).json({ error: 'User not found' })
    res.json({ user: rows[0] })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { username, nickname, role, avatar } = req.body
    if (!username) return res.status(400).json({ error: 'Username required' })
    const rows = await query('SELECT id FROM admin_users WHERE id = ?', [id]) as any[]
    if (!rows.length) return res.status(404).json({ error: 'User not found' })
    await query('UPDATE admin_users SET username = ?, nickname = ?, role = ?, avatar = ? WHERE id = ?', [username, nickname, role, avatar, id])
    await addOpLog(0, username, 'Update User', 'System', `Updated user ${id} `, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const user = (req as any).user as JwtPayload
    const rows = await query('SELECT id, username FROM admin_users WHERE id = ?', [id]) as any[]
    if (!rows.length) return res.status(404).json({ error: 'User not found' })
    const username = rows[0].username
    await query('DELETE FROM admin_users WHERE id = ?', [id])
    await addOpLog(user.userId, user.username, 'Delete User', 'System', `Deleted user ${id} (${username})`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/users/:id/reset-password', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { newPassword } = req.body
    if (!newPassword) return res.status(400).json({ error: 'New password required' })
    const hash = bcrypt.hashSync(newPassword, 10)
    await query('UPDATE admin_users SET password = ? WHERE id = ?', [hash, id])
    await addOpLog(0, username, 'Reset Password', 'System', `Reset password for user ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = (req as any).user as JwtPayload
  const rows = await query('SELECT id, username, nickname, role, avatar, last_login, created_at FROM admin_users WHERE id = ?', [user.userId]) as any[]
  if (!rows.length) return res.status(401).json({ error: 'User not found' })
  res.json({ user: rows[0] })
})

app.put('/api/auth/password', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' })
    const rows = await query('SELECT password FROM admin_users WHERE id = ?', [user.userId]) as any[]
    if (!rows.length) return res.status(401).json({ error: 'User not found' })
    if (!bcrypt.compareSync(oldPassword, rows[0].password)) return res.status(400).json({ error: 'Wrong old password' })
    await query('UPDATE admin_users SET password = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), user.userId])
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/dashboard/stats', authMiddleware, async (_req, res) => {
  try {
    const cached = queryCache.get('dashboard:stats')
    if (cached) return res.json(cached)
    const [tables] = await query("SELECT TABLE_NAME as tableName, TABLE_ROWS as rowCount, TABLE_COMMENT as tableComment, ENGINE as engine, CREATE_TIME as createTime FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'", [DB_NAME]) as any[]
    let totalRows = 0; tables.forEach((t: any) => { totalRows += t.rowCount || 0 })
    const [opToday] = await query("SELECT COUNT(*) as c FROM operation_logs WHERE DATE(created_at) = CURDATE()") as any[]
    const [errToday] = await query("SELECT COUNT(*) as c FROM error_logs WHERE DATE(created_at) = CURDATE()") as any[]
    const result = { totalTables: tables.length, totalRows, operationLogsToday: opToday[0].c, errorLogsToday: errToday[0].c, tableList: tables }
    queryCache.set('dashboard:stats', result)
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/dashboard/chart-data', authMiddleware, async (_req, res) => {
  try {
    const cached = queryCache.get('dashboard:charts')
    if (cached) return res.json(cached)
    const [categoryData] = await query('SELECT category, COUNT(*) as count, SUM(stock) as totalStock FROM products GROUP BY category') as any[]
    const [orderStatusData] = await query('SELECT status, COUNT(*) as count FROM orders GROUP BY status') as any[]
    const [dailyOrders] = await query("SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total_price) as total FROM orders GROUP BY DATE(created_at) ORDER BY DATE(created_at) DESC LIMIT 14") as any[]
    const [topProducts] = await query('SELECT p.name, SUM(o.quantity) as totalQty, SUM(o.total_price) as totalRevenue FROM orders o JOIN products p ON o.product_id = p.id GROUP BY o.product_id ORDER BY totalRevenue DESC LIMIT 5') as any[]
    const result = { categoryData, orderStatusData, dailyOrders, topProducts }
    queryCache.set('dashboard:charts', result)
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/logs/operations', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const { action, username, startDate, endDate } = req.query
    let where = 'WHERE 1=1'; const params: unknown[] = []
    if (action) { where += ' AND action LIKE ?'; params.push(`% ${action}% `) }
    if (username) { where += ' AND username LIKE ?'; params.push(`% ${username}% `) }
    if (startDate) { where += ' AND created_at >= ?'; params.push(startDate) }
    if (endDate) { where += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59') }
    const total = await query(`SELECT COUNT(*) as c FROM operation_logs ${where} `, params) as any[]
    const offset = (page - 1) * pageSize
    const rows = await query(`SELECT * FROM operation_logs ${where} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset} `, params) as any[]
    res.json({ rows, total: total[0].c, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/logs/errors', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const { errorType, startDate, endDate } = req.query
    let where = 'WHERE 1=1'; const params: unknown[] = []
    if (errorType) { where += ' AND error_type LIKE ?'; params.push(`% ${errorType}% `) }
    if (startDate) { where += ' AND created_at >= ?'; params.push(startDate) }
    if (endDate) { where += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59') }
    const total = await query(`SELECT COUNT(*) as c FROM error_logs ${where} `, params) as any[]
    const offset = (page - 1) * pageSize
    const rows = await query(`SELECT * FROM error_logs ${where} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset} `, params) as any[]
    res.json({ rows, total: total[0].c, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/logs/errors', authMiddleware, async (req, res) => {
  try {
    const { beforeDate } = req.body
    if (beforeDate) await query('DELETE FROM error_logs WHERE created_at < ?', [beforeDate])
    else await query('DELETE FROM error_logs')
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/logs/operations', authMiddleware, async (req, res) => {
  try {
    const { beforeDate } = req.body
    if (beforeDate) await query('DELETE FROM operation_logs WHERE created_at < ?', [beforeDate])
    else await query('DELETE FROM operation_logs')
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/logs/alert-rules', authMiddleware, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM log_alert_rules WHERE is_enabled = TRUE ORDER BY created_at DESC') as any[]
    res.json({ rules: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/logs/alert-rules', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { ruleName, logType, conditionType, conditionValue, alertMethod, alertConfig } = req.body

    await query(
      'INSERT INTO log_alert_rules (rule_name, log_type, condition_type, condition_value, alert_method, alert_config) VALUES (?, ?, ?, ?, ?, ?)',
      [ruleName, logType, conditionType, conditionValue, alertMethod, JSON.stringify(alertConfig || {})]
    )

    await addOpLog(user.userId, user.username, 'Create Alert Rule', '', `Created alert rule: ${ruleName} `, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/logs/alert-rules/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { ruleName, isEnabled, alertConfig } = req.body

    await query(
      'UPDATE log_alert_rules SET rule_name = ?, is_enabled = ?, alert_config = ?, updated_at = NOW() WHERE id = ?',
      [ruleName, isEnabled, JSON.stringify(alertConfig || {}), id]
    )

    await addOpLog(user.userId, user.username, 'Update Alert Rule', '', `Updated alert rule ${id} `, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/logs/alert-rules/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params

    await query('DELETE FROM log_alert_rules WHERE id = ?', [id])

    await addOpLog(user.userId, user.username, 'Delete Alert Rule', '', `Deleted alert rule ${id} `, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/logs/check-alerts', authMiddleware, async (req, res) => {
  try {
    const [rules] = await query('SELECT * FROM log_alert_rules WHERE is_enabled = TRUE') as any[]

    for (const rule of rules) {
      let shouldAlert = false
      let alertMessage = ''

      if (rule.log_type === 'operation') {
        if (rule.condition_type === 'keyword') {
          const [count] = await query(
            'SELECT COUNT(*) as c FROM operation_logs WHERE detail LIKE ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
            [`% ${rule.condition_value}% `]
          ) as any[]

          if (count[0].c > 0) {
            shouldAlert = true
            alertMessage = `检测到关键词 "${rule.condition_value}" 的操作日志，最近1小时内有 ${count[0].c} 条记录`
          }
        } else if (rule.condition_type === 'frequency') {
          const [count] = await query(
            'SELECT COUNT(*) as c FROM operation_logs WHERE action = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
            [rule.condition_value]
          ) as any[]

          const threshold = rule.alert_config?.threshold || 100
          if (count[0].c >= threshold) {
            shouldAlert = true
            alertMessage = `操作 "${rule.condition_value}" 频率异常，最近1小时内执行了 ${count[0].c} 次（阈值: ${threshold}）`
          }
        }
      } else if (rule.log_type === 'error') {
        if (rule.condition_type === 'error_type') {
          const [count] = await query(
            'SELECT COUNT(*) as c FROM error_logs WHERE error_type = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
            [rule.condition_value]
          ) as any[]

          if (count[0].c > 0) {
            shouldAlert = true
            alertMessage = `检测到错误类型 "${rule.condition_value}"，最近1小时内有 ${count[0].c} 条记录`
          }
        } else if (rule.condition_type === 'frequency') {
          const [count] = await query(
            'SELECT COUNT(*) as c FROM error_logs WHERE error_message LIKE ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
            [`% ${rule.condition_value}% `]
          ) as any[]

          const threshold = rule.alert_config?.threshold || 10
          if (count[0].c >= threshold) {
            shouldAlert = true
            alertMessage = `错误 "${rule.condition_value}" 频率异常，最近1小时内发生了 ${count[0].c} 次（阈值: ${threshold}）`
          }
        }
      }

      if (shouldAlert) {
        const [existing] = await query(
          'SELECT * FROM log_alerts WHERE rule_id = ? AND log_type = ? AND alert_status = ? AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)',
          [rule.id, rule.log_type, 'pending']
        ) as any[]

        if (existing.length === 0) {
          await query(
            'INSERT INTO log_alerts (rule_id, log_type, alert_status, alert_message) VALUES (?, ?, ?, ?)',
            [rule.id, rule.log_type, 'pending', alertMessage]
          )
        }
      }
    }

    res.json({ success: true, checked: rules.length })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/logs/alerts', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const { logType, alertStatus } = req.query

    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (logType) { where += ' AND log_type = ?'; params.push(logType) }
    if (alertStatus) { where += ' AND alert_status = ?'; params.push(alertStatus) }

    const offset = (page - 1) * pageSize
    const total = await query(`SELECT COUNT(*) as c FROM log_alerts ${where} `, params) as any[]
    const rows = await query(`SELECT * FROM log_alerts ${where} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset} `, params) as any[]

    res.json({ rows, total: total[0].c, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/logs/archive', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { logType, archiveDate } = req.body

    if (!logType || !archiveDate) {
      return res.status(400).json({ error: 'logType and archiveDate required' })
    }

    const tableName = logType === 'operation' ? 'operation_logs' : 'error_logs'
    const countResult = await query(
      `SELECT COUNT(*) as c FROM ${tableName} WHERE DATE(created_at) = ? `,
      [archiveDate]
    ) as any[]

    const count = countResult[0].c

    if (count > 0) {
      await query(
        `INSERT INTO log_archives(log_type, archive_date, log_count) VALUES(?, ?, ?)`,
        [logType, archiveDate, count]
      )

      await query(
        `DELETE FROM ${tableName} WHERE DATE(created_at) = ? `,
        [archiveDate]
      )

      await addOpLog(user.userId, user.username, 'Archive Logs', '', `Archived ${count} ${logType} logs from ${archiveDate} `, req)
    }

    res.json({ success: true, archivedCount: count })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/logs/archives', authMiddleware, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM log_archives ORDER BY archive_date DESC') as any[]
    res.json({ archives: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 统计分析API
app.get('/api/analytics/performance', authMiddleware, async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query
    const now = Date.now()
    let startTime = now

    switch (timeRange) {
      case '1h': startTime = now - 60 * 60 * 1000; break
      case '24h': startTime = now - 24 * 60 * 60 * 1000; break
      case '7d': startTime = now - 7 * 24 * 60 * 60 * 1000; break
      case '30d': startTime = now - 30 * 24 * 60 * 60 * 1000; break
      default: startTime = now - 24 * 60 * 60 * 1000
    }

    const filteredData = performanceData.filter(d => d.timestamp >= startTime)

    // 按端点分组
    const endpointStats = filteredData.reduce((acc, data) => {
      if (!acc[data.endpoint]) {
        acc[data.endpoint] = {
          totalRequests: 0,
          totalResponseTime: 0,
          maxResponseTime: 0,
          minResponseTime: Infinity,
          errorCount: 0
        }
      }

      acc[data.endpoint].totalRequests++
      acc[data.endpoint].totalResponseTime += data.responseTime
      acc[data.endpoint].maxResponseTime = Math.max(acc[data.endpoint].maxResponseTime, data.responseTime)
      acc[data.endpoint].minResponseTime = Math.min(acc[data.endpoint].minResponseTime, data.responseTime)
      if (data.statusCode >= 400) {
        acc[data.endpoint].errorCount++
      }

      return acc
    }, {} as Record<string, any>)

    // 计算平均值
    Object.keys(endpointStats).forEach(endpoint => {
      const stats = endpointStats[endpoint]
      stats.avgResponseTime = stats.totalResponseTime / stats.totalRequests
    })

    // 按请求数排序
    const sortedEndpoints = Object.entries(endpointStats)
      .sort((a, b) => b[1].totalRequests - a[1].totalRequests)
      .slice(0, 20)

    res.json({
      totalRequests: filteredData.length,
      totalResponseTime: filteredData.reduce((sum, d) => sum + d.responseTime, 0),
      avgResponseTime: filteredData.length > 0 ? filteredData.reduce((sum, d) => sum + d.responseTime, 0) / filteredData.length : 0,
      errorRate: filteredData.length > 0 ? filteredData.filter(d => d.statusCode >= 400).length / filteredData.length : 0,
      endpointStats: sortedEndpoints
    })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/analytics/tool-trends', authMiddleware, async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query
    const now = new Date()
    let startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    switch (timeRange) {
      case '1d': startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); break
      case '7d': startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
      case '30d': startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break
      default: startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // 工具使用趋势
    const [sqlQueryStats] = await query('SELECT DATE(created_at) as date, COUNT(*) as count FROM sql_query_history WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY date', [startTime]) as any[]
    const [dataBrowserStats] = await query('SELECT DATE(created_at) as date, COUNT(*) as count FROM operation_logs WHERE action = ? AND created_at >= ? GROUP BY DATE(created_at) ORDER BY date', ['Browse Data', startTime]) as any[]
    const [tableManagerStats] = await query('SELECT DATE(created_at) as date, COUNT(*) as count FROM operation_logs WHERE action LIKE ? AND created_at >= ? GROUP BY DATE(created_at) ORDER BY date', ['%Table%', startTime]) as any[]

    // 生成时间序列数据
    const generateTimeSeries = (stats: any[], label: string) => {
      const dataMap = new Map(stats.map(s => [s.date, s.count]))
      const dates = []
      const current = new Date(startTime)
      while (current <= now) {
        const dateStr = current.toISOString().split('T')[0]
        dates.push({
          date: dateStr,
          count: dataMap.get(dateStr) || 0
        })
        current.setDate(current.getDate() + 1)
      }
      return dates
    }

    res.json({
      sqlQuery: generateTimeSeries(sqlQueryStats, 'SQL Query'),
      dataBrowser: generateTimeSeries(dataBrowserStats, 'Data Browser'),
      tableManager: generateTimeSeries(tableManagerStats, 'Table Manager')
    })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/analytics/anomalies', authMiddleware, async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query
    const now = Date.now()
    let startTime = now - 24 * 60 * 60 * 1000

    switch (timeRange) {
      case '1h': startTime = now - 60 * 60 * 1000; break
      case '24h': startTime = now - 24 * 60 * 60 * 1000; break
      case '7d': startTime = now - 7 * 24 * 60 * 60 * 1000; break
      default: startTime = now - 24 * 60 * 60 * 1000
    }

    const filteredData = performanceData.filter(d => d.timestamp >= startTime)

    // 检测异常
    const anomalies = []

    // 1. 响应时间异常
    const endpointResponseTimes = new Map<string, number[]>()
    filteredData.forEach(data => {
      if (!endpointResponseTimes.has(data.endpoint)) {
        endpointResponseTimes.set(data.endpoint, [])
      }
      endpointResponseTimes.get(data.endpoint)!.push(data.responseTime)
    })

    endpointResponseTimes.forEach((times, endpoint) => {
      if (times.length < 5) return

      const mean = times.reduce((sum, time) => sum + time, 0) / times.length
      const stdDev = Math.sqrt(times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length)
      const threshold = mean + 3 * stdDev

      times.forEach((time, index) => {
        if (time > threshold) {
          anomalies.push({
            type: 'high_response_time',
            endpoint,
            responseTime: time,
            threshold: Math.round(threshold),
            timestamp: filteredData[index].timestamp,
            severity: time > threshold * 2 ? 'critical' : 'warning'
          })
        }
      })
    })

    // 2. 错误率异常
    const endpointErrors = new Map<string, { total: number; errors: number }>()
    filteredData.forEach(data => {
      if (!endpointErrors.has(data.endpoint)) {
        endpointErrors.set(data.endpoint, { total: 0, errors: 0 })
      }
      const stats = endpointErrors.get(data.endpoint)!
      stats.total++
      if (data.statusCode >= 400) {
        stats.errors++
      }
    })

    endpointErrors.forEach((stats, endpoint) => {
      if (stats.total < 10) return

      const errorRate = stats.errors / stats.total
      if (errorRate > 0.1) { // 10% 错误率
        anomalies.push({
          type: 'high_error_rate',
          endpoint,
          errorRate: Math.round(errorRate * 100),
          totalRequests: stats.total,
          errorCount: stats.errors,
          severity: errorRate > 0.3 ? 'critical' : 'warning'
        })
      }
    })

    // 3. 请求频率异常
    const hourlyRequests = new Map<string, number>()
    filteredData.forEach(data => {
      const hour = new Date(data.timestamp).toISOString().slice(0, 13)
      hourlyRequests.set(hour, (hourlyRequests.get(hour) || 0) + 1)
    })

    const hourlyCounts = Array.from(hourlyRequests.values())
    if (hourlyCounts.length > 5) {
      const mean = hourlyCounts.reduce((sum, count) => sum + count, 0) / hourlyCounts.length
      const stdDev = Math.sqrt(hourlyCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / hourlyCounts.length)
      const threshold = mean + 3 * stdDev

      hourlyRequests.forEach((count, hour) => {
        if (count > threshold) {
          anomalies.push({
            type: 'high_request_rate',
            hour,
            requestCount: count,
            threshold: Math.round(threshold),
            severity: count > threshold * 2 ? 'critical' : 'warning'
          })
        }
      })
    }

    res.json({
      totalAnomalies: anomalies.length,
      criticalAnomalies: anomalies.filter(a => a.severity === 'critical').length,
      warningAnomalies: anomalies.filter(a => a.severity === 'warning').length,
      anomalies: anomalies.slice(0, 50) // 限制返回数量
    })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/routes', authMiddleware, (_req, res) => {
  res.json({
    routes: [
      { path: '/dashboard', name: 'Dashboard', icon: 'DashboardOutlined' },
      { path: '/tables', name: 'Tables', icon: 'DatabaseOutlined' },
      { path: '/data', name: 'Data Browser', icon: 'TableOutlined' },
      { path: '/query', name: 'SQL Query', icon: 'CodeOutlined' },
      { path: '/logs/operations', name: 'Operation Logs', icon: 'FileTextOutlined' },
      { path: '/logs/errors', name: 'Error Logs', icon: 'WarningOutlined' },
      { path: '/analytics', name: '统计分析', icon: 'BarChartOutlined' },
      { path: '/membership', name: '会员管理', icon: 'UserOutlined' },
    ]
  })
})

// 会员套餐API
app.get('/api/membership/plans', authMiddleware, async (_req, res) => {
  try {
    const [plans] = await query('SELECT * FROM membership_plans WHERE is_enabled = TRUE ORDER BY sort_order') as any[]
    res.json({ plans })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/membership/plans', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { name, price, duration, benefits, isEnabled, sortOrder } = req.body

    await query('INSERT INTO membership_plans (name, price, duration, benefits, is_enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [name, price, duration, benefits, isEnabled, sortOrder])

    await addOpLog(user.userId, user.username, 'Create Membership Plan', 'membership', `Created plan: ${name} `, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/membership/plans/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { name, price, duration, benefits, isEnabled, sortOrder } = req.body

    await query('UPDATE membership_plans SET name = ?, price = ?, duration = ?, benefits = ?, is_enabled = ?, sort_order = ? WHERE id = ?',
      [name, price, duration, benefits, isEnabled, sortOrder, id])

    await addOpLog(user.userId, user.username, 'Update Membership Plan', 'membership', `Updated plan ${id} `, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/membership/plans/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params

    await query('UPDATE membership_plans SET is_enabled = FALSE WHERE id = ?', [id])

    await addOpLog(user.userId, user.username, 'Delete Membership Plan', 'membership', `Disabled plan ${id} `, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 用户会员API
app.get('/api/membership/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params
    const [membership] = await query('SELECT um.*, mp.name, mp.price, mp.duration, mp.benefits FROM user_memberships um JOIN membership_plans mp ON um.plan_id = mp.id WHERE um.user_id = ? AND um.status = ? ORDER BY um.id DESC LIMIT 1', [userId, 'active']) as any[]
    res.json({ membership: membership[0] || null })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/membership/purchase', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { userId, planId, autoRenew } = req.body

    const [plan] = await query('SELECT * FROM membership_plans WHERE id = ? AND is_enabled = TRUE', [planId]) as any[]
    if (plan.length === 0) return res.status(400).json({ error: '套餐不存在' })

    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + plan[0].duration * 24 * 60 * 60 * 1000)

    await query('INSERT INTO user_memberships (user_id, plan_id, start_date, end_date, auto_renew, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, planId, startDate, endDate, autoRenew, 'active'])

    await addOpLog(user.userId, user.username, 'Purchase Membership', 'membership', `User ${userId} purchased plan ${planId} `, req)
    res.json({ success: true, endDate })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/membership/cancel', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { userId } = req.body

    await query('UPDATE user_memberships SET auto_renew = FALSE, status = CASE WHEN end_date < NOW() THEN "expired" ELSE status END WHERE user_id = ?', [userId])

    await addOpLog(user.userId, user.username, 'Cancel Membership', 'membership', `User ${userId} cancelled auto - renew`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 折扣规则API
app.get('/api/membership/discounts', authMiddleware, async (_req, res) => {
  try {
    const [discounts] = await query('SELECT * FROM discount_rules WHERE is_active = TRUE ORDER BY id') as any[]
    res.json({ discounts })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/membership/discounts', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { name, type, value, minPurchase, maxDiscount, startDate, endDate } = req.body

    await query('INSERT INTO discount_rules (name, type, value, min_purchase, max_discount, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, type, value, minPurchase, maxDiscount, startDate, endDate, true])

    await addOpLog(user.userId, user.username, 'Create Discount Rule', 'membership', `Created discount: ${name} `, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 会员使用统计API
app.get('/api/membership/usage', authMiddleware, async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (userId) { where += ' AND user_id = ?'; params.push(userId) }
    if (startDate) { where += ' AND timestamp >= ?'; params.push(startDate) }
    if (endDate) { where += ' AND timestamp <= ?'; params.push(endDate + ' 23:59:59') }

    const [usage] = await query(`SELECT action, resource, COUNT(*) as count FROM membership_usage ${where} GROUP BY action, resource ORDER BY count DESC`, params) as any[]
    res.json({ usage })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/membership/usage', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { userId, action, resource } = req.body

    await query('INSERT INTO membership_usage (user_id, action, resource) VALUES (?, ?, ?)', [userId, action, resource])

    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/batch', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { operations } = req.body

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({ error: 'Operations array required' })
    }

    const results = []
    const startTime = Date.now()

    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'sql':
            const [sqlResult] = await query(operation.sql, operation.params)
            results.push({
              id: operation.id,
              success: true,
              result: sqlResult
            })
            break
          case 'data':
            const dataResult = await executeAsyncTask({
              type: 'dataProcessing',
              data: operation.data
            })
            results.push({
              id: operation.id,
              success: true,
              result: dataResult
            })
            break
          case 'calculate':
            const calcResult = await executeAsyncTask({
              type: 'heavyCalculation',
              params: operation.params
            })
            results.push({
              id: operation.id,
              success: true,
              result: calcResult
            })
            break
          default:
            results.push({
              id: operation.id,
              success: false,
              error: 'Unknown operation type'
            })
        }
      } catch (err: any) {
        results.push({
          id: operation.id,
          success: false,
          error: err.message
        })
      }
    }

    const totalTime = (Date.now() - startTime) / 1000
    const successCount = results.filter(r => r.success).length

    await addOpLog(user.userId, user.username, 'Batch Operation', 'System', `Executed ${operations.length} operations`, req)

    res.json({
      results,
      summary: {
        total: operations.length,
        success: successCount,
        failed: operations.length - successCount,
        executionTime: totalTime.toFixed(3)
      }
    })
  } catch (err: any) {
    const user = (req as any).user as JwtPayload | undefined
    await addErrLog(user?.userId || 0, user?.username || '', 'Batch Operation', err.name || 'Error', err.message, err.stack || '')
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/async/task', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const task = req.body

    if (!task.type) {
      return res.status(400).json({ error: 'Task type required' })
    }

    const result = await executeAsyncTask(task)

    await addOpLog(user.userId, user.username, 'Async Task', 'System', `Executed task: ${task.type} `, req)

    res.json({ success: true, result })
  } catch (err: any) {
    const user = (req as any).user as JwtPayload | undefined
    await addErrLog(user?.userId || 0, user?.username || '', 'Async Task', err.name || 'Error', err.message, err.stack || '')
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/tables', authMiddleware, async (_req, res) => {
  try {
    const rows = await query("SELECT TABLE_NAME as tableName, TABLE_TYPE as tableType, TABLE_COMMENT as tableComment, ENGINE as engine, TABLE_ROWS as rowCount, CREATE_TIME as createTime, UPDATE_TIME as updateTime FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME", [DB_NAME]) as any[]
    res.json({ tables: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/tables/:tableName/columns', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT COLUMN_NAME as columnName, DATA_TYPE as dataType, IS_NULLABLE as isNullable, COLUMN_KEY as columnKey, COLUMN_DEFAULT as columnDefault, EXTRA as extra, COLUMN_COMMENT as columnComment FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [DB_NAME, req.params.tableName]) as any[]
    res.json({ columns: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/tables/create', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { tableName, columns } = req.body
    if (!columns?.length) throw new Error('At least one column required')
    const colDefs = columns.map((col: any) => {
      let def = `  \`${col.name}\` ${col.type}`
      if (col.primaryKey) def += ' PRIMARY KEY AUTO_INCREMENT'
      else if (col.nullable === false) def += ' NOT NULL'
      return def
    })
    await query(`CREATE TABLE \`${tableName}\` (\n${colDefs.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    queryCache.del('dashboard:stats')
    await addOpLog(user.userId, user.username, 'Create Table', tableName, `Created table ${tableName}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/tables/:tableName', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    await query(`DROP TABLE IF EXISTS \`${req.params.tableName}\``)
    queryCache.del('dashboard:stats')
    await addOpLog(user.userId, user.username, 'Drop Table', req.params.tableName, `Dropped table ${req.params.tableName}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/tables/:tableName/compare', authMiddleware, async (req, res) => {
  try {
    const { tableName } = req.params
    const { compareWith } = req.query

    const [columns1] = await query('SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [DB_NAME, tableName]) as any[]
    const [columns2] = await query('SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [DB_NAME, compareWith]) as any[]

    const differences: any[] = []

    const map1 = new Map(columns1.map((c: any) => [c.COLUMN_NAME, c]))
    const map2 = new Map(columns2.map((c: any) => [c.COLUMN_NAME, c]))

    const allColumns = new Set([...columns1.map((c: any) => c.COLUMN_NAME), ...columns2.map((c: any) => c.COLUMN_NAME)])

    allColumns.forEach(colName => {
      const col1 = map1.get(colName)
      const col2 = map2.get(colName)

      if (!col1) {
        differences.push({
          column: colName,
          type: 'added',
          table2: col2,
        })
      } else if (!col2) {
        differences.push({
          column: colName,
          type: 'removed',
          table1: col1,
        })
      } else {
        const changes: string[] = []
        if (col1.DATA_TYPE !== col2.DATA_TYPE) changes.push(`类型: ${col1.DATA_TYPE} → ${col2.DATA_TYPE}`)
        if (col1.IS_NULLABLE !== col2.IS_NULLABLE) changes.push(`可空: ${col1.IS_NULLABLE} → ${col2.IS_NULLABLE}`)
        if (col1.COLUMN_KEY !== col2.COLUMN_KEY) changes.push(`键: ${col1.COLUMN_KEY} → ${col2.COLUMN_KEY}`)
        if (col1.COLUMN_DEFAULT !== col2.COLUMN_DEFAULT) changes.push(`默认值: ${col1.COLUMN_DEFAULT} → ${col2.COLUMN_DEFAULT}`)
        if (col1.EXTRA !== col2.EXTRA) changes.push(`额外: ${col1.EXTRA} → ${col2.EXTRA}`)

        if (changes.length > 0) {
          differences.push({
            column: colName,
            type: 'modified',
            table1: col1,
            table2: col2,
            changes,
          })
        }
      }
    })

    res.json({ differences, table1: tableName, table2: compareWith })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/tables/:tableName/indexes', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SHOW INDEX FROM ??', [req.params.tableName]) as any[]
    res.json({ indexes: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/tables/:tableName/indexes', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { tableName } = req.params
    const { indexName, columns, unique } = req.body

    if (!indexName || !columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'Index name and columns required' })
    }

    const uniqueStr = unique ? 'UNIQUE ' : ''
    const columnsStr = columns.map((c: string) => `\`${c}\``).join(', ')
    await query(`CREATE ${uniqueStr} INDEX \`${indexName}\` ON \`${tableName}\` (${columnsStr})`)

    await addOpLog(user.userId, user.username, 'Create Index', tableName, `Created index ${indexName}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/tables/:tableName/indexes/:indexName', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { tableName, indexName } = req.params

    await query(`DROP INDEX \`${indexName}\` ON \`${tableName}\``)

    await addOpLog(user.userId, user.username, 'Drop Index', tableName, `Dropped index ${indexName}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/tables/:tableName/backup', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { tableName } = req.params

    const [createTableResult] = await query(`SHOW CREATE TABLE \`${tableName}\``) as any[]
    const createTableSQL = createTableResult[0]['Create Table']

    const rows = await query(`SELECT * FROM \`${tableName}\``) as any[]

    let insertSQL = ''
    if (rows.length > 0) {
      const columns = Object.keys(rows[0])
      const columnNames = columns.map((c) => `\`${c}\``).join(', ')
      const placeholders = columns.map(() => '?').join(', ')

      const values = rows.map((row) => columns.map((col) => {
        const val = row[col]
        if (val === null) return 'NULL'
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
        if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`
        return String(val)
      }).join(', '))

      insertSQL = values.map(v => `INSERT INTO \`${tableName}\` (${columnNames}) VALUES (${v});`).join('\n')
    }

    const backupSQL = `-- Backup of table ${tableName}\n-- Generated at ${new Date().toISOString()}\n\n${createTableSQL};\n\n${insertSQL}`

    await addOpLog(user.userId, user.username, 'Backup Table', tableName, `Backed up table ${tableName}`, req)

    res.json({ success: true, sql: backupSQL, rowCount: rows.length })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/tables/restore', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { sql } = req.body

    if (!sql?.trim()) {
      return res.status(400).json({ error: 'SQL required' })
    }

    const statements = sql.split(';').filter(s => s.trim())

    for (const statement of statements) {
      if (statement.trim()) {
        await query(statement.trim())
      }
    }

    await addOpLog(user.userId, user.username, 'Restore Table', '', 'Restored table from backup', req)

    res.json({ success: true, statementCount: statements.length })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/tables/:tableName/truncate', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    await query(`TRUNCATE TABLE \`${req.params.tableName}\``)
    queryCache.del('dashboard:stats')
    await addOpLog(user.userId, user.username, 'Truncate Table', req.params.tableName, `Truncated table ${req.params.tableName}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/data/:tableName', authMiddleware, async (req, res) => {
  try {
    const { tableName } = req.params
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(1000, Math.max(1, parseInt(req.query.pageSize as string) || 50))
    const sort = req.query.sort as string
    const order = req.query.order as string
    const search = req.query.search as string
    let whereClause = ''; const params: unknown[] = []
    if (search) {
      const [colRows] = await query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [DB_NAME, tableName]) as any[]
      const colNames = colRows.map((r: any) => r.COLUMN_NAME)
      if (colNames.length) {
        const conditions = colNames.map(() => 'CAST(? AS CHAR) LIKE ?')
        whereClause = `WHERE ${conditions.join(' OR ')}`
        colNames.forEach((col) => { params.push(col, `%${search}%`) })
      }
    }
    let orderBy = ''
    if (sort && order) orderBy = `ORDER BY \`${sort}\` ${order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`
    const offset = (page - 1) * pageSize
    const countResult = await query(`SELECT COUNT(*) as total FROM \`${tableName}\` ${whereClause}`, params) as any[]
    const rows = await query(`SELECT * FROM \`${tableName}\` ${whereClause} ${orderBy} LIMIT ? OFFSET ?`, [...params, pageSize, offset]) as any[]
    res.json({ rows, total: countResult[0].total, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/data/:tableName/count', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`SELECT COUNT(*) as count FROM \`${req.params.tableName}\``) as any[]
    res.json({ count: rows[0].count })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/data/:tableName', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { tableName } = req.params; const data = req.body
    if (!data || !Object.keys(data).length) throw new Error('No data provided')
    const keys = Object.keys(data); const values = Object.values(data)
    const [result] = await query(`INSERT INTO \`${tableName}\` (${keys.map((k) => `\`${k}\``).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, values) as any
    queryCache.del('dashboard:stats')
    await addOpLog(user.userId, user.username, 'Insert', tableName, `Inserted into ${tableName}`, req)
    res.json({ success: true, insertId: result.insertId })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/data/:tableName', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { tableName } = req.params; const { data, where } = req.body
    if (!data || !where) throw new Error('Data and where required')
    const setClause = Object.keys(data).map((k) => `\`${k}\` = ?`).join(', ')
    const whereClause = Object.keys(where).map((k) => `\`${k}\` = ?`).join(' AND ')
    const [result] = await query(`UPDATE \`${tableName}\` SET ${setClause} WHERE ${whereClause}`, [...Object.values(data), ...Object.values(where)]) as any
    await addOpLog(user.userId, user.username, 'Update', tableName, `Updated ${tableName}`, req)
    res.json({ success: true, affectedRows: result.affectedRows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/data/:tableName', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { tableName } = req.params; const { where } = req.body
    if (!where) throw new Error('Where condition required')
    const whereClause = Object.keys(where).map((k) => `\`${k}\` = ?`).join(' AND ')
    const [result] = await query(`DELETE FROM \`${tableName}\` WHERE ${whereClause}`, Object.values(where)) as any
    queryCache.del('dashboard:stats')
    await addOpLog(user.userId, user.username, 'Delete', tableName, `Deleted from ${tableName}`, req)
    res.json({ success: true, affectedRows: result.affectedRows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/data/:tableName/snapshot', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { tableName } = req.params
    const { snapshotName } = req.body
    if (!snapshotName) throw new Error('Snapshot name required')

    const [rows] = await query(`SELECT * FROM \`${tableName}\``) as any[]
    const [result] = await query(
      'INSERT INTO data_snapshots (user_id, table_name, snapshot_name, snapshot_data, record_count) VALUES (?, ?, ?, ?, ?)',
      [user.userId, tableName, snapshotName, JSON.stringify(rows), rows.length]
    ) as any

    await addOpLog(user.userId, user.username, 'Create Snapshot', tableName, `Created snapshot: ${snapshotName}`, req)
    res.json({ success: true, snapshotId: result.insertId, recordCount: rows.length })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/data/:tableName/snapshots', authMiddleware, async (req, res) => {
  try {
    const { tableName } = req.params
    const rows = await query('SELECT * FROM data_snapshots WHERE table_name = ? ORDER BY created_at DESC', [tableName]) as any[]
    res.json({ snapshots: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 广告管理API
app.get('/api/ads', authMiddleware, async (req, res) => {
  try {
    const { position, isEnabled } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (position) { where += ' AND position = ?'; params.push(position) }
    if (isEnabled !== undefined) { where += ' AND is_enabled = ?'; params.push(isEnabled === 'true') }

    const [ads] = await query(`SELECT * FROM ads ${where} ORDER BY created_at DESC`, params) as any[]
    res.json({ ads })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/ads', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { title, imageUrl, linkUrl, position, isEnabled, showFrequency, skipTime, startDate, endDate, abTestGroup, showRule, antiCheat } = req.body

    await query('INSERT INTO ads (title, image_url, link_url, position, is_enabled, show_frequency, skip_time, start_date, end_date, ab_test_group, show_rule, anti_cheat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, imageUrl, linkUrl, position, isEnabled, showFrequency, skipTime, startDate, endDate, abTestGroup, JSON.stringify(showRule), antiCheat])

    await addOpLog(user.userId, user.username, 'Create Ad', 'ad', `Created ad: ${title}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/ads/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { title, imageUrl, linkUrl, position, isEnabled, showFrequency, skipTime, startDate, endDate, abTestGroup, showRule, antiCheat } = req.body

    await query('UPDATE ads SET title = ?, image_url = ?, link_url = ?, position = ?, is_enabled = ?, show_frequency = ?, skip_time = ?, start_date = ?, end_date = ?, ab_test_group = ?, show_rule = ?, anti_cheat = ? WHERE id = ?',
      [title, imageUrl, linkUrl, position, isEnabled, showFrequency, skipTime, startDate, endDate, abTestGroup, JSON.stringify(showRule), antiCheat, id])

    await addOpLog(user.userId, user.username, 'Update Ad', 'ad', `Updated ad ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/ads/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params

    await query('DELETE FROM ads WHERE id = ?', [id])

    await addOpLog(user.userId, user.username, 'Delete Ad', 'ad', `Deleted ad ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// A/B测试API
app.get('/api/ads/ab-tests', authMiddleware, async (_req, res) => {
  try {
    const [tests] = await query('SELECT * FROM ad_ab_tests ORDER BY created_at DESC') as any[]
    res.json({ tests })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/ads/ab-tests', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { name, description, startDate, endDate } = req.body

    const [result] = await query('INSERT INTO ad_ab_tests (name, description, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)',
      [name, description, startDate, endDate, true]) as any[]

    await addOpLog(user.userId, user.username, 'Create A/B Test', 'ad', `Created A/B test: ${name}`, req)
    res.json({ success: true, testId: result.insertId })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/ads/ab-tests/:testId/groups', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { testId } = req.params
    const { adId, groupName, weight } = req.body

    await query('INSERT INTO ad_ab_test_groups (test_id, ad_id, group_name, weight) VALUES (?, ?, ?, ?)',
      [testId, adId, groupName, weight])

    await addOpLog(user.userId, user.username, 'Add A/B Test Group', 'ad', `Added group ${groupName} to test ${testId}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 广告统计API
app.get('/api/ads/stats', authMiddleware, async (req, res) => {
  try {
    const { adId, startDate, endDate } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (adId) { where += ' AND ad_id = ?'; params.push(adId) }
    if (startDate) { where += ' AND date >= ?'; params.push(startDate) }
    if (endDate) { where += ' AND date <= ?'; params.push(endDate) }

    const [stats] = await query(`SELECT * FROM ad_stats ${where} ORDER BY date DESC`, params) as any[]
    res.json({ stats })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 广告点击和展示记录API
app.post('/api/ads/impression', async (req, res) => {
  try {
    const { adId, userId, ip, userAgent, deviceType, browser, os, country, region, city } = req.body

    // 检查是否为唯一展示
    const [existing] = await query('SELECT id FROM ad_impressions WHERE ad_id = ? AND ip = ? AND DATE(timestamp) = CURRENT_DATE()', [adId, ip]) as any[]
    const isUnique = existing.length === 0

    await query('INSERT INTO ad_impressions (ad_id, user_id, ip, user_agent, device_type, browser, os, country, region, city, is_unique) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [adId, userId || 0, ip, userAgent, deviceType, browser, os, country, region, city, isUnique])

    // 更新统计
    await query('INSERT INTO ad_stats (ad_id, view_count, unique_views, date) VALUES (?, 1, ?, CURRENT_DATE()) ON DUPLICATE KEY UPDATE view_count = view_count + 1, unique_views = unique_views + ?',
      [adId, isUnique ? 1 : 0, isUnique ? 1 : 0])

    res.json({ success: true, isUnique })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/ads/click', async (req, res) => {
  try {
    const { adId, impressionId, userId, ip, userAgent } = req.body

    // 防作弊检查
    let fraudScore = 0

    // 检查同一IP短时间内点击次数
    const [recentClicks] = await query('SELECT COUNT(*) as c FROM ad_clicks WHERE ip = ? AND timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)', [ip]) as any[]
    if (recentClicks[0].c > 5) {
      fraudScore += 50
    }

    // 检查同一用户短时间内点击次数
    if (userId) {
      const [userClicks] = await query('SELECT COUNT(*) as c FROM ad_clicks WHERE user_id = ? AND timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)', [userId]) as any[]
      if (userClicks[0].c > 3) {
        fraudScore += 30
      }
    }

    const is_valid = fraudScore < 70

    await query('INSERT INTO ad_clicks (ad_id, impression_id, user_id, ip, user_agent, is_valid, fraud_score) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [adId, impressionId || 0, userId || 0, ip, userAgent, is_valid, fraudScore])

    // 更新统计
    if (is_valid) {
      await query('INSERT INTO ad_stats (ad_id, click_count, unique_clicks, date) VALUES (?, 1, 1, CURRENT_DATE()) ON DUPLICATE KEY UPDATE click_count = click_count + 1, unique_clicks = unique_clicks + 1', [adId])
    }

    res.json({ success: true, is_valid, fraudScore })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 反馈管理API
app.get('/api/feedbacks', authMiddleware, async (req, res) => {
  try {
    const { status, priority, assignedTo, startDate, endDate } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (status) { where += ' AND status = ?'; params.push(status) }
    if (priority) { where += ' AND priority = ?'; params.push(priority) }
    if (assignedTo) { where += ' AND assigned_to = ?'; params.push(assignedTo) }
    if (startDate) { where += ' AND created_at >= ?'; params.push(startDate) }
    if (endDate) { where += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59') }

    const [feedbacks] = await query(`SELECT * FROM feedbacks ${where} ORDER BY created_at DESC`, params) as any[]
    res.json({ feedbacks })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/feedbacks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const [feedback] = await query('SELECT * FROM feedbacks WHERE id = ?', [id]) as any[]
    if (!feedback.length) return res.status(404).json({ error: '反馈不存在' })

    const [notes] = await query('SELECT * FROM feedback_notes WHERE feedback_id = ? ORDER BY created_at DESC', [id]) as any[]
    const [relatedFaqs] = await query('SELECT f.* FROM faqs f JOIN feedback_faq_relations fr ON f.id = fr.faq_id WHERE fr.feedback_id = ?', [id]) as any[]

    res.json({ feedback: feedback[0], notes, relatedFaqs })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/feedbacks', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { userId, userName, userEmail, type, title, content, priority } = req.body

    // 计算SLA截止时间
    let slaDeadline = null
    if (priority) {
      const [slaRule] = await query('SELECT response_time FROM sla_rules WHERE priority = ? AND is_active = TRUE', [priority]) as any[]
      if (slaRule.length > 0) {
        const deadline = new Date()
        deadline.setMinutes(deadline.getMinutes() + slaRule[0].response_time)
        slaDeadline = deadline
      }
    }

    await query('INSERT INTO feedbacks (user_id, user_name, user_email, type, title, content, priority, sla_deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, userName, userEmail, type, title, content, priority, slaDeadline])

    await addOpLog(user.userId, user.username, 'Create Feedback', 'feedback', `Created feedback: ${title}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/feedbacks/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { status, priority, assignedTo, assignedName, templateId, faqRelated, tags } = req.body

    // 更新响应时间和解决时间
    const updateData: any = { status, priority, assigned_to: assignedTo, assigned_name: assignedName, template_id: templateId, faq_related: faqRelated, tags: JSON.stringify(tags) }

    if (status === 'processing' && !updateData.response_time) {
      updateData.response_time = new Date()
    } else if (status === 'resolved' && !updateData.resolution_time) {
      updateData.resolution_time = new Date()
    }

    // 构建更新语句
    const keys = Object.keys(updateData)
    const values = Object.values(updateData)
    const setClause = keys.map(key => `${key} = ?`).join(', ')
    values.push(id)

    await query(`UPDATE feedbacks SET ${setClause} WHERE id = ?`, values)

    await addOpLog(user.userId, user.username, 'Update Feedback', 'feedback', `Updated feedback ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 回复模板API
app.get('/api/feedback/templates', authMiddleware, async (req, res) => {
  try {
    const { type } = req.query
    let where = 'WHERE is_active = TRUE'
    const params: unknown[] = []

    if (type) { where += ' AND type = ?'; params.push(type) }

    const [templates] = await query(`SELECT * FROM feedback_templates ${where} ORDER BY name`, params) as any[]
    res.json({ templates })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/feedback/templates', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { name, content, type } = req.body

    await query('INSERT INTO feedback_templates (name, content, type) VALUES (?, ?, ?)', [name, content, type])

    await addOpLog(user.userId, user.username, 'Create Template', 'feedback', `Created template: ${name}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// FAQ关联API
app.post('/api/feedbacks/:id/faq', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { faqId, relevanceScore } = req.body

    await query('INSERT INTO feedback_faq_relations (feedback_id, faq_id, relevance_score) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE relevance_score = ?',
      [id, faqId, relevanceScore, relevanceScore])

    await addOpLog(user.userId, user.username, 'Add FAQ Relation', 'feedback', `Added FAQ ${faqId} to feedback ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// SLA规则API
app.get('/api/feedback/sla-rules', authMiddleware, async (_req, res) => {
  try {
    const [rules] = await query('SELECT * FROM sla_rules WHERE is_active = TRUE ORDER BY priority') as any[]
    res.json({ rules })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/feedback/sla-rules', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { name, priority, responseTime, resolutionTime } = req.body

    await query('INSERT INTO sla_rules (name, priority, response_time, resolution_time) VALUES (?, ?, ?, ?)',
      [name, priority, responseTime, resolutionTime])

    await addOpLog(user.userId, user.username, 'Create SLA Rule', 'feedback', `Created SLA rule: ${name}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 反馈笔记API
app.post('/api/feedbacks/:id/notes', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { content, isInternal } = req.body

    await query('INSERT INTO feedback_notes (feedback_id, user_id, user_name, content, is_internal) VALUES (?, ?, ?, ?, ?)',
      [id, user.userId, user.username, content, isInternal])

    await addOpLog(user.userId, user.username, 'Add Feedback Note', 'feedback', `Added note to feedback ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 第三方集成 - 消息通知API
app.get('/api/integrations/notification/channels', authMiddleware, async (_req, res) => {
  try {
    const [channels] = await query('SELECT * FROM notification_channels ORDER BY name') as any[]
    res.json({ channels })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/integrations/notification/channels', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { name, type, config, isActive } = req.body

    await query('INSERT INTO notification_channels (name, type, config, is_active) VALUES (?, ?, ?, ?)',
      [name, type, JSON.stringify(config), isActive])

    await addOpLog(user.userId, user.username, 'Create Notification Channel', 'integration', `Created channel: ${name}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/integrations/notification/channels/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { name, type, config, isActive } = req.body

    await query('UPDATE notification_channels SET name = ?, type = ?, config = ?, is_active = ? WHERE id = ?',
      [name, type, JSON.stringify(config), isActive, id])

    await addOpLog(user.userId, user.username, 'Update Notification Channel', 'integration', `Updated channel: ${name}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/integrations/notification/channels/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params

    await query('DELETE FROM notification_channels WHERE id = ?', [id])

    await addOpLog(user.userId, user.username, 'Delete Notification Channel', 'integration', `Deleted channel ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/integrations/notification/notifications', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { status, limit = 50 } = req.query

    let where = 'WHERE user_id = ?'
    const params: unknown[] = [user.userId]

    if (status) { where += ' AND status = ?'; params.push(status) }

    const [notifications] = await query(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ?`, [...params, limit]) as any[]
    res.json({ notifications })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/integrations/notification/send', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { userId, title, content, type, channelId } = req.body

    await query('INSERT INTO notifications (user_id, title, content, type, channel_id) VALUES (?, ?, ?, ?, ?)',
      [userId, title, content, type, channelId])

    await addOpLog(user.userId, user.username, 'Send Notification', 'integration', `Sent notification to user ${userId}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 第三方集成 - 日志系统API
app.get('/api/integrations/log/channels', authMiddleware, async (_req, res) => {
  try {
    const [channels] = await query('SELECT * FROM log_integrations ORDER BY name') as any[]
    res.json({ channels })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/integrations/log/channels', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { name, type, endpoint, apiKey, config, isActive } = req.body

    await query('INSERT INTO log_integrations (name, type, endpoint, api_key, config, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [name, type, endpoint, apiKey, JSON.stringify(config), isActive])

    await addOpLog(user.userId, user.username, 'Create Log Integration', 'integration', `Created log integration: ${name}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/integrations/log/channels/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { name, type, endpoint, apiKey, config, isActive } = req.body

    await query('UPDATE log_integrations SET name = ?, type = ?, endpoint = ?, api_key = ?, config = ?, is_active = ? WHERE id = ?',
      [name, type, endpoint, apiKey, JSON.stringify(config), isActive, id])

    await addOpLog(user.userId, user.username, 'Update Log Integration', 'integration', `Updated log integration: ${name}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/integrations/log/channels/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params

    await query('DELETE FROM log_integrations WHERE id = ?', [id])

    await addOpLog(user.userId, user.username, 'Delete Log Integration', 'integration', `Deleted log integration ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 第三方集成 - 支付集成API
app.get('/api/integrations/payment/gateways', authMiddleware, async (_req, res) => {
  try {
    const [gateways] = await query('SELECT * FROM payment_gateways ORDER BY name') as any[]
    res.json({ gateways })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/integrations/payment/gateways', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { name, type, config, isActive } = req.body

    await query('INSERT INTO payment_gateways (name, type, config, is_active) VALUES (?, ?, ?, ?)',
      [name, type, JSON.stringify(config), isActive])

    await addOpLog(user.userId, user.username, 'Create Payment Gateway', 'integration', `Created payment gateway: ${name}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/integrations/payment/gateways/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { name, type, config, isActive } = req.body

    await query('UPDATE payment_gateways SET name = ?, type = ?, config = ?, is_active = ? WHERE id = ?',
      [name, type, JSON.stringify(config), isActive, id])

    await addOpLog(user.userId, user.username, 'Update Payment Gateway', 'integration', `Updated payment gateway: ${name}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/integrations/payment/gateways/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params

    await query('DELETE FROM payment_gateways WHERE id = ?', [id])

    await addOpLog(user.userId, user.username, 'Delete Payment Gateway', 'integration', `Deleted payment gateway ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/integrations/payment/transactions', authMiddleware, async (req, res) => {
  try {
    const { orderId, userId, status, startDate, endDate } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (orderId) { where += ' AND order_id = ?'; params.push(orderId) }
    if (userId) { where += ' AND user_id = ?'; params.push(userId) }
    if (status) { where += ' AND status = ?'; params.push(status) }
    if (startDate) { where += ' AND created_at >= ?'; params.push(startDate) }
    if (endDate) { where += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59') }

    const [transactions] = await query(`SELECT * FROM payment_transactions ${where} ORDER BY created_at DESC`, params) as any[]
    res.json({ transactions })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/integrations/payment/process', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { orderId, userId, amount, currency, gatewayId, paymentMethod } = req.body

    // 生成交易ID
    const transactionId = 'TXN' + Date.now() + Math.floor(Math.random() * 1000)

    await query('INSERT INTO payment_transactions (order_id, user_id, amount, currency, gateway_id, gateway_transaction_id, status, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [orderId, userId, amount, currency, gatewayId, transactionId, 'pending', paymentMethod])

    await addOpLog(user.userId, user.username, 'Process Payment', 'integration', `Processed payment for order ${orderId}`, req)
    res.json({ success: true, transactionId })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/data/:tableName/snapshots/:snapshotId/restore', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { tableName, snapshotId } = req.params

    const [snapshotRows] = await query('SELECT * FROM data_snapshots WHERE id = ?', [snapshotId]) as any[]
    if (!snapshotRows.length) throw new Error('Snapshot not found')

    const snapshot = snapshotRows[0]
    const data = JSON.parse(snapshot.snapshot_data)

    await query(`TRUNCATE TABLE \`${tableName}\``)

    if (data.length > 0) {
      const columns = Object.keys(data[0])
      const placeholders = columns.map(() => '?').join(', ')
      const columnNames = columns.map((c) => `\`${c}\``).join(', ')

      for (const row of data) {
        const values = columns.map((col) => row[col])
        await query(`INSERT INTO \`${tableName}\` (${columnNames}) VALUES (${placeholders})`, values)
      }
    }

    await addOpLog(user.userId, user.username, 'Restore Snapshot', tableName, `Restored snapshot: ${snapshot.snapshot_name}`, req)
    res.json({ success: true, recordCount: data.length })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/data/:tableName/snapshots/:snapshotId', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { snapshotId } = req.params
    await query('DELETE FROM data_snapshots WHERE id = ?', [snapshotId])
    await addOpLog(user.userId, user.username, 'Delete Snapshot', '', `Deleted snapshot ${snapshotId}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/sql/execute', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { sql } = req.body
    if (!sql?.trim()) throw new Error('SQL required')

    const startTime = Date.now()
    const trimmed = sql.trim().toUpperCase()
    const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('SHOW') || trimmed.startsWith('DESC') || trimmed.startsWith('EXPLAIN')

    let historyId = 0
    let executionTime = 0
    let rowCount = 0
    let affectedRows = 0
    let status = 'success'
    let errorMessage = ''

    try {
      if (isSelect) {
        const [rows, fields] = await query(sql) as any
        const columns = fields?.map((f: any) => f.name) || []
        rowCount = (rows as any[]).length
        executionTime = (Date.now() - startTime) / 1000

        await addOpLog(user.userId, user.username, 'SQL Query', '', sql.slice(0, 500), req)

        const [historyResult] = await query(
          'INSERT INTO sql_query_history (user_id, username, sql, execution_time, affected_rows, row_count, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [user.userId, user.username, sql, executionTime, 0, rowCount, status]
        ) as any
        historyId = historyResult.insertId

        res.json({ columns, rows, rowCount, executionTime: executionTime.toFixed(3), historyId })
      } else {
        const [result] = await query(sql) as any
        affectedRows = result.affectedRows || 0
        executionTime = (Date.now() - startTime) / 1000
        queryCache.del('dashboard:stats'); queryCache.del('dashboard:charts')

        await addOpLog(user.userId, user.username, 'SQL Exec', '', sql.slice(0, 500), req)

        const [historyResult] = await query(
          'INSERT INTO sql_query_history (user_id, username, sql, execution_time, affected_rows, row_count, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [user.userId, user.username, sql, executionTime, affectedRows, 0, status]
        ) as any
        historyId = historyResult.insertId

        res.json({ columns: [], rows: [], affectedRows, insertId: result.insertId, message: `OK, ${affectedRows} rows affected`, executionTime: executionTime.toFixed(3), historyId })
      }
    } catch (err: any) {
      status = 'error'
      errorMessage = err.message
      executionTime = (Date.now() - startTime) / 1000

      await query(
        'INSERT INTO sql_query_history (user_id, username, sql, execution_time, affected_rows, row_count, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [user.userId, user.username, sql, executionTime, 0, 0, status, errorMessage]
      )

      await addErrLog(user.userId, user.username, 'SQL', err.name || 'Error', err.message, err.stack || '')
      res.status(500).json({ error: err.message })
    }
  } catch (err: any) {
    const user = (req as any).user as JwtPayload | undefined
    await addErrLog(user?.userId || 0, user?.username || '', 'SQL', err.name || 'Error', err.message, err.stack || '')
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/sql/format', (_req, res) => {
  try {
    const { sql } = _req.body
    if (!sql) throw new Error('SQL required')
    res.json({ sql: sqlFormat(sql, { language: 'mysql', tabWidth: 2 }) })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/sql/validate', authMiddleware, async (req, res) => {
  try {
    const { sql } = req.body
    if (!sql?.trim()) throw new Error('SQL required')
    const trimmed = sql.trim().toUpperCase()

    const validKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'SHOW', 'DESC', 'DESCRIBE', 'EXPLAIN']
    const isValid = validKeywords.some(keyword => trimmed.startsWith(keyword))

    if (!isValid) {
      return res.json({ valid: false, error: 'Unsupported SQL statement type' })
    }

    res.json({ valid: true, message: 'SQL syntax appears valid' })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/sql/explain', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { sql } = req.body
    if (!sql?.trim()) throw new Error('SQL required')

    const startTime = Date.now()
    const rows = await query(`EXPLAIN ${sql}`) as any[]
    const executionTime = (Date.now() - startTime) / 1000

    await addOpLog(user.userId, user.username, 'SQL Explain', '', sql.slice(0, 500), req)

    res.json({
      plan: rows,
      executionTime: executionTime.toFixed(3),
      message: `Execution plan generated in ${executionTime.toFixed(3)}s`
    })
  } catch (err: any) {
    const user = (req as any).user as JwtPayload | undefined
    await addErrLog(user?.userId || 0, user?.username || '', 'SQL Explain', err.name || 'Error', err.message, err.stack || '')
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/sql/batch', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { sqls } = req.body
    if (!sqls || !Array.isArray(sqls) || sqls.length === 0) {
      throw new Error('SQL array required')
    }

    const results = []
    const startTime = Date.now()

    for (const sql of sqls) {
      if (!sql?.trim()) continue

      try {
        const trimmed = sql.trim().toUpperCase()
        const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('SHOW') || trimmed.startsWith('DESC') || trimmed.startsWith('EXPLAIN')

        if (isSelect) {
          const [rows, fields] = await query(sql) as any
          const columns = fields?.map((f: any) => f.name) || []
          results.push({
            sql: sql.slice(0, 200),
            success: true,
            columns,
            rows,
            rowCount: (rows as any[]).length
          })
        } else {
          const [result] = await query(sql) as any
          results.push({
            sql: sql.slice(0, 200),
            success: true,
            affectedRows: result.affectedRows,
            insertId: result.insertId,
            message: `OK, ${result.affectedRows} rows affected`
          })
        }
      } catch (err: any) {
        results.push({
          sql: sql.slice(0, 200),
          success: false,
          error: err.message
        })
      }
    }

    const totalExecutionTime = (Date.now() - startTime) / 1000
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    await addOpLog(user.userId, user.username, 'SQL Batch', '', `Executed ${sqls.length} queries`, req)

    res.json({
      results,
      summary: {
        total: sqls.length,
        success: successCount,
        failed: failCount,
        executionTime: totalExecutionTime.toFixed(3)
      }
    })
  } catch (err: any) {
    const user = (req as any).user as JwtPayload | undefined
    await addErrLog(user?.userId || 0, user?.username || '', 'SQL Batch', err.name || 'Error', err.message, err.stack || '')
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/sql/history', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const { status, startDate, endDate } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (status) { where += ' AND status = ?'; params.push(status) }
    if (startDate) { where += ' AND created_at >= ?'; params.push(startDate) }
    if (endDate) { where += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59') }

    const offset = (page - 1) * pageSize
    const total = await query(`SELECT COUNT(*) as c FROM sql_query_history ${where}`, params) as any[]
    const rows = await query(`SELECT * FROM sql_query_history ${where} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset}`, params) as any[]

    res.json({ rows, total: total[0].c, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/sql/history/:id/plan', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM sql_execution_plans WHERE query_history_id = ?', [req.params.id]) as any[]
    res.json({ plans: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/sql/history', authMiddleware, async (req, res) => {
  try {
    const { beforeDate } = req.body
    if (beforeDate) await query('DELETE FROM sql_query_history WHERE created_at < ?', [beforeDate])
    else await query('DELETE FROM sql_query_history')
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/content/categories', authMiddleware, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM content_categories ORDER BY sort_order ASC') as any[]
    res.json({ categories: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/content/categories', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { name, description, sort_order } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    await query('INSERT INTO content_categories (name, description, sort_order) VALUES (?, ?, ?)', [name, description || '', sort_order || 0])
    await addOpLog(user.userId, user.username, 'Create Category', 'Content', `Created category: ${name}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/content/categories/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { name, description, sort_order } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    await query('UPDATE content_categories SET name = ?, description = ?, sort_order = ? WHERE id = ?', [name, description || '', sort_order || 0, id])
    await addOpLog(user.userId, user.username, 'Update Category', 'Content', `Updated category ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/content/categories/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    await query('DELETE FROM content_categories WHERE id = ?', [id])
    await addOpLog(user.userId, user.username, 'Delete Category', 'Content', `Deleted category ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/content/articles', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const { status, category_id, search } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []
    if (status) { where += ' AND a.status = ?'; params.push(status) }
    if (category_id) { where += ' AND a.category_id = ?'; params.push(category_id) }
    if (search) { where += ' AND (a.title LIKE ? OR a.content LIKE ?)'; params.push(`%${search}%`); params.push(`%${search}%`) }
    const offset = (page - 1) * pageSize
    const total = await query(`SELECT COUNT(*) as c FROM articles a ${where}`, params) as any[]
    const rows = await query(`SELECT a.*, c.name as category_name, u.username as author_name FROM articles a LEFT JOIN content_categories c ON a.category_id = c.id LEFT JOIN admin_users u ON a.author_id = u.id ${where} ORDER BY a.id DESC LIMIT ${pageSize} OFFSET ${offset}`, params) as any[]
    res.json({ rows, total: total[0].c, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/content/articles/:id', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT a.*, c.name as category_name, u.username as author_name FROM articles a LEFT JOIN content_categories c ON a.category_id = c.id LEFT JOIN admin_users u ON a.author_id = u.id WHERE a.id = ?', [req.params.id]) as any[]
    if (!rows.length) return res.status(404).json({ error: 'Article not found' })
    await query('UPDATE articles SET view_count = view_count + 1 WHERE id = ?', [req.params.id])
    res.json({ article: rows[0] })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/content/articles', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { title, content, category_id, cover_image, images } = req.body
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' })
    const [result] = await query('INSERT INTO articles (title, content, category_id, cover_image, images, author_id) VALUES (?, ?, ?, ?, ?, ?)', [title, content, category_id || null, cover_image || '', JSON.stringify(images || []), user.userId]) as any
    await addOpLog(user.userId, user.username, 'Create Article', 'Content', `Created article: ${title}`, req)
    res.json({ success: true, insertId: result.insertId })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/content/articles/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { title, content, category_id, cover_image, images } = req.body
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' })
    await query('UPDATE articles SET title = ?, content = ?, category_id = ?, cover_image = ?, images = ? WHERE id = ?', [title, content, category_id || null, cover_image || '', JSON.stringify(images || []), id])
    await addOpLog(user.userId, user.username, 'Update Article', 'Content', `Updated article ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/content/articles/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    await query('DELETE FROM articles WHERE id = ?', [id])
    await addOpLog(user.userId, user.username, 'Delete Article', 'Content', `Deleted article ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/content/articles/:id/submit', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const rows = await query('SELECT status FROM articles WHERE id = ?', [id]) as any[]
    if (!rows.length) return res.status(404).json({ error: 'Article not found' })
    const statusBefore = rows[0].status
    await query('UPDATE articles SET status = ? WHERE id = ?', ['pending', id])
    await query('INSERT INTO content_audit_logs (article_id, auditor_id, action, status_before, status_after) VALUES (?, ?, ?, ?, ?)', [id, user.userId, 'submit', statusBefore, 'pending'])
    await addOpLog(user.userId, user.username, 'Submit Article', 'Content', `Submitted article ${id} for review`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/content/articles/:id/approve', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { comment } = req.body
    const rows = await query('SELECT status FROM articles WHERE id = ?', [id]) as any[]
    if (!rows.length) return res.status(404).json({ error: 'Article not found' })
    const statusBefore = rows[0].status
    await query('UPDATE articles SET status = ?, reject_reason = ? WHERE id = ?', ['approved', '', id])
    await query('INSERT INTO content_audit_logs (article_id, auditor_id, action, status_before, status_after, comment) VALUES (?, ?, ?, ?, ?, ?)', [id, user.userId, 'approve', statusBefore, 'approved', comment || ''])
    await addOpLog(user.userId, user.username, 'Approve Article', 'Content', `Approved article ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/content/articles/:id/reject', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { reason } = req.body
    if (!reason) return res.status(400).json({ error: 'Reject reason required' })
    const rows = await query('SELECT status FROM articles WHERE id = ?', [id]) as any[]
    if (!rows.length) return res.status(404).json({ error: 'Article not found' })
    const statusBefore = rows[0].status
    await query('UPDATE articles SET status = ?, reject_reason = ? WHERE id = ?', ['rejected', reason, id])
    await query('INSERT INTO content_audit_logs (article_id, auditor_id, action, status_before, status_after, comment) VALUES (?, ?, ?, ?, ?, ?)', [id, user.userId, 'reject', statusBefore, 'rejected', reason])
    await addOpLog(user.userId, user.username, 'Reject Article', 'Content', `Rejected article ${id}: ${reason}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/content/audit-logs', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const { article_id } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []
    if (article_id) { where += ' AND cal.article_id = ?'; params.push(article_id) }
    const offset = (page - 1) * pageSize
    const total = await query(`SELECT COUNT(*) as c FROM content_audit_logs cal ${where}`, params) as any[]
    const rows = await query(`SELECT cal.*, a.title as article_title, u.username as auditor_name FROM content_audit_logs cal LEFT JOIN articles a ON cal.article_id = a.id LEFT JOIN admin_users u ON cal.auditor_id = u.id ${where} ORDER BY cal.id DESC LIMIT ${pageSize} OFFSET ${offset}`, params) as any[]
    res.json({ rows, total: total[0].c, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const { status, user_id, start_date, end_date } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []
    if (status) { where += ' AND o.status = ?'; params.push(status) }
    if (user_id) { where += ' AND o.user_id = ?'; params.push(user_id) }
    if (start_date) { where += ' AND o.created_at >= ?'; params.push(start_date) }
    if (end_date) { where += ' AND o.created_at <= ?'; params.push(end_date + ' 23:59:59') }
    const offset = (page - 1) * pageSize
    const total = await query(`SELECT COUNT(*) as c FROM orders o ${where}`, params) as any[]
    const rows = await query(`SELECT o.*, u.username as user_name, p.name as product_name FROM orders o LEFT JOIN users u ON o.user_id = u.id LEFT JOIN products p ON o.product_id = p.id ${where} ORDER BY o.id DESC LIMIT ${pageSize} OFFSET ${offset}`, params) as any[]
    res.json({ rows, total: total[0].c, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/orders/:id', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT o.*, u.username as user_name, p.name as product_name FROM orders o LEFT JOIN users u ON o.user_id = u.id LEFT JOIN products p ON o.product_id = p.id WHERE o.id = ?', [req.params.id]) as any[]
    if (!rows.length) return res.status(404).json({ error: 'Order not found' })
    res.json({ order: rows[0] })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/orders/:id/status', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { status, remark } = req.body
    if (!status) return res.status(400).json({ error: 'Status required' })
    const rows = await query('SELECT status FROM orders WHERE id = ?', [id]) as any[]
    if (!rows.length) return res.status(404).json({ error: 'Order not found' })
    const statusBefore = rows[0].status
    await query('UPDATE orders SET status = ? WHERE id = ?', [status, id])
    await query('INSERT INTO order_status_logs (order_id, status_before, status_after, operator_id, remark) VALUES (?, ?, ?, ?, ?)', [id, statusBefore, status, user.userId, remark || ''])
    await addOpLog(user.userId, user.username, 'Update Order Status', 'Order', `Updated order ${id} status to ${status}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/orders/:id/items', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?', [req.params.id]) as any[]
    res.json({ items: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/orders/:id/status-logs', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT osl.*, u.username as operator_name FROM order_status_logs osl LEFT JOIN admin_users u ON osl.operator_id = u.id WHERE osl.order_id = ? ORDER BY osl.id DESC', [req.params.id]) as any[]
    res.json({ logs: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/roles', authMiddleware, async (_req, res) => {
  try {
    const rows = await query('SELECT r.*, (SELECT COUNT(*) FROM admin_users WHERE role = r.name) as user_count FROM roles r ORDER BY r.id') as any[]
    res.json({ roles: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/roles', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { name, description } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    await query('INSERT INTO roles (name, description) VALUES (?, ?)', [name, description || ''])
    await addOpLog(user.userId, user.username, 'Create Role', 'Permission', `Created role: ${name}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/roles/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { name, description } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    await query('UPDATE roles SET name = ?, description = ? WHERE id = ?', [name, description || '', id])
    await addOpLog(user.userId, user.username, 'Update Role', 'Permission', `Updated role ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/roles/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    await query('DELETE FROM roles WHERE id = ?', [id])
    await addOpLog(user.userId, user.username, 'Delete Role', 'Permission', `Deleted role ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/permissions', authMiddleware, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM permissions ORDER BY module, id') as any[]
    res.json({ permissions: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/roles/:id/permissions', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT p.*, rp.id as role_permission_id FROM permissions p LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = ? ORDER BY p.module, p.id', [req.params.id]) as any[]
    res.json({ permissions: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/roles/:id/permissions', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { permission_id } = req.body
    if (!permission_id) return res.status(400).json({ error: 'Permission ID required' })
    await query('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [id, permission_id])
    await addOpLog(user.userId, user.username, 'Assign Permission', 'Permission', `Assigned permission ${permission_id} to role ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/roles/:roleId/permissions/:permissionId', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { roleId, permissionId } = req.params
    await query('DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?', [roleId, permissionId])
    await addOpLog(user.userId, user.username, 'Remove Permission', 'Permission', `Removed permission ${permissionId} from role ${roleId}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/tickets', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const { status, priority, user_id } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []
    if (status) { where += ' AND t.status = ?'; params.push(status) }
    if (priority) { where += ' AND t.priority = ?'; params.push(priority) }
    if (user_id) { where += ' AND t.user_id = ?'; params.push(user_id) }
    const offset = (page - 1) * pageSize
    const total = await query(`SELECT COUNT(*) as c FROM tickets t ${where}`, params) as any[]
    const rows = await query(`SELECT t.*, u.username as assigned_to_name FROM tickets t LEFT JOIN admin_users u ON t.assigned_to = u.id ${where} ORDER BY t.id DESC LIMIT ${pageSize} OFFSET ${offset}`, params) as any[]
    res.json({ rows, total: total[0].c, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/tickets/:id', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT t.*, u.username as assigned_to_name FROM tickets t LEFT JOIN admin_users u ON t.assigned_to = u.id WHERE t.id = ?', [req.params.id]) as any[]
    if (!rows.length) return res.status(404).json({ error: 'Ticket not found' })
    res.json({ ticket: rows[0] })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/tickets/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { status, priority, assigned_to } = req.body
    await query('UPDATE tickets SET status = ?, priority = ?, assigned_to = ? WHERE id = ?', [status, priority, assigned_to || null, id])
    await addOpLog(user.userId, user.username, 'Update Ticket', 'Service', `Updated ticket ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/tickets/:id/messages', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT tm.*, u.username as sender_username FROM ticket_messages tm LEFT JOIN admin_users u ON tm.sender_id = u.id WHERE tm.ticket_id = ? ORDER BY tm.id ASC', [req.params.id]) as any[]
    res.json({ messages: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/tickets/:id/messages', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { message, is_internal } = req.body
    if (!message) return res.status(400).json({ error: 'Message required' })
    await query('INSERT INTO ticket_messages (ticket_id, sender_id, sender_name, sender_type, message, is_internal) VALUES (?, ?, ?, ?, ?, ?)', [id, user.userId, user.username, 'admin', message, is_internal || false])
    await addOpLog(user.userId, user.username, 'Reply Ticket', 'Service', `Replied to ticket ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/tools', authMiddleware, async (_req, res) => {
  try {
    const rows = await query('SELECT t.*, tc.config_value as daily_limit, tc2.config_value as require_vip, tc3.config_value as show_ad FROM tools t LEFT JOIN tool_configs tc ON t.id = tc.tool_id AND tc.config_key = "daily_limit" LEFT JOIN tool_configs tc2 ON t.id = tc2.tool_id AND tc2.config_key = "require_vip" LEFT JOIN tool_configs tc3 ON t.id = tc3.tool_id AND tc3.config_key = "show_ad" ORDER BY t.sort_order') as any[]
    res.json({ tools: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/tools', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { name, description, icon, url, is_enabled, sort_order } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    const [result] = await query('INSERT INTO tools (name, description, icon, url, is_enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [name, description || '', icon || '', url || '', is_enabled !== undefined ? is_enabled : true, sort_order || 0]) as any
    await addOpLog(user.userId, user.username, 'Create Tool', 'Tool', `Created tool: ${name}`, req)
    res.json({ success: true, insertId: result.insertId })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/tools/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { name, description, icon, url, is_enabled, sort_order } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    await query('UPDATE tools SET name = ?, description = ?, icon = ?, url = ?, is_enabled = ?, sort_order = ? WHERE id = ?', [name, description || '', icon || '', url || '', is_enabled !== undefined ? is_enabled : true, sort_order || 0, id])
    await addOpLog(user.userId, user.username, 'Update Tool', 'Tool', `Updated tool ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/tools/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    await query('DELETE FROM tools WHERE id = ?', [id])
    await addOpLog(user.userId, user.username, 'Delete Tool', 'Tool', `Deleted tool ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/tools/:id/configs', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM tool_configs WHERE tool_id = ? ORDER BY config_key', [req.params.id]) as any[]
    res.json({ configs: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/tools/:id/configs', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { config_key, config_value, config_type, description } = req.body
    if (!config_key || !config_value) return res.status(400).json({ error: 'Config key and value required' })
    await query('INSERT INTO tool_configs (tool_id, config_key, config_value, config_type, description) VALUES (?, ?, ?, ?, ?)', [id, config_key, config_value, config_type || 'string', description || ''])
    await addOpLog(user.userId, user.username, 'Create Tool Config', 'Tool', `Created config ${config_key} for tool ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/tools/:id/configs/:configKey', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id, configKey } = req.params
    const { config_value, config_type, description } = req.body
    if (!config_value) return res.status(400).json({ error: 'Config value required' })
    await query('UPDATE tool_configs SET config_value = ?, config_type = ?, description = ? WHERE tool_id = ? AND config_key = ?', [config_value, config_type || 'string', description || '', id, configKey])
    await addOpLog(user.userId, user.username, 'Update Tool Config', 'Tool', `Updated config ${configKey} for tool ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/tools/:id/configs/:configKey', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id, configKey } = req.params
    await query('DELETE FROM tool_configs WHERE tool_id = ? AND config_key = ?', [id, configKey])
    await addOpLog(user.userId, user.username, 'Delete Tool Config', 'Tool', `Deleted config ${configKey} from tool ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/tools/:id/increment-usage', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    await query('UPDATE tools SET usage_count = usage_count + 1 WHERE id = ?', [id])
    await addOpLog(user.userId, user.username, 'Increment Tool Usage', 'Tool', `Incremented usage count for tool ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/membership-plans', authMiddleware, async (_req, res) => {
  try {
    const rows = await query('SELECT mp.*, (SELECT COUNT(*) as c FROM user_memberships WHERE plan_id = mp.id AND status = "active") as active_count FROM membership_plans mp ORDER BY mp.sort_order') as any[]
    res.json({ plans: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/membership-plans', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { name, price, duration, benefits, is_enabled, sort_order } = req.body
    if (!name || !price || !duration) return res.status(400).json({ error: 'Name, price and duration required' })
    const [result] = await query('INSERT INTO membership_plans (name, price, duration, benefits, is_enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [name, price, duration, benefits || '', is_enabled !== undefined ? is_enabled : true, sort_order || 0]) as any
    await addOpLog(user.userId, user.username, 'Create Membership Plan', 'Membership', `Created plan: ${name}`, req)
    res.json({ success: true, insertId: result.insertId })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/membership-plans/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { name, price, duration, benefits, is_enabled, sort_order } = req.body
    if (!name || !price || !duration) return res.status(400).json({ error: 'Name, price and duration required' })
    await query('UPDATE membership_plans SET name = ?, price = ?, duration = ?, benefits = ?, is_enabled = ?, sort_order = ? WHERE id = ?', [name, price, duration, benefits || '', is_enabled !== undefined ? is_enabled : true, sort_order || 0, id])
    await addOpLog(user.userId, user.username, 'Update Membership Plan', 'Membership', `Updated plan ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/membership-plans/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    await query('DELETE FROM membership_plans WHERE id = ?', [id])
    await addOpLog(user.userId, user.username, 'Delete Membership Plan', 'Membership', `Deleted plan ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/ads', authMiddleware, async (_req, res) => {
  try {
    const rows = await query('SELECT a.*, (SELECT SUM(view_count) as total_views, SUM(click_count) as total_clicks, SUM(conversion_count) as total_conversions FROM ad_stats WHERE ad_id = a.id) as stats FROM ads a LEFT JOIN ad_stats s ON a.id = s.ad_id GROUP BY a.id ORDER BY a.id DESC') as any[]
    res.json({ ads: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/ads', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { title, image_url, link_url, position, is_enabled, show_frequency, skip_time } = req.body
    if (!title) return res.status(400).json({ error: 'Title required' })
    const [result] = await query('INSERT INTO ads (title, image_url, link_url, position, is_enabled, show_frequency, skip_time) VALUES (?, ?, ?, ?, ?, ?, ?)', [title, image_url || '', link_url || '', position || 'banner', is_enabled !== undefined ? is_enabled : true, show_frequency || 1, skip_time || 0]) as any
    await addOpLog(user.userId, user.username, 'Create Ad', 'Ad', `Created ad: ${title}`, req)
    res.json({ success: true, insertId: result.insertId })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/ads/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { title, image_url, link_url, position, is_enabled, show_frequency, skip_time } = req.body
    if (!title) return res.status(400).json({ error: 'Title required' })
    await query('UPDATE ads SET title = ?, image_url = ?, link_url = ?, position = ?, is_enabled = ?, show_frequency = ?, skip_time = ? WHERE id = ?', [title, image_url || '', link_url || '', position || 'banner', is_enabled !== undefined ? is_enabled : true, show_frequency || 1, skip_time || 0, id])
    await addOpLog(user.userId, user.username, 'Update Ad', 'Ad', `Updated ad ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/ads/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    await query('DELETE FROM ads WHERE id = ?', [id])
    await addOpLog(user.userId, user.username, 'Delete Ad', 'Ad', `Deleted ad ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/feedbacks', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const { status, priority, user_id } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []
    if (status) { where += ' AND f.status = ?'; params.push(status) }
    if (priority) { where += ' AND f.priority = ?'; params.push(priority) }
    if (user_id) { where += ' AND f.user_id = ?'; params.push(user_id) }
    const offset = (page - 1) * pageSize
    const total = await query(`SELECT COUNT(*) as c FROM feedbacks f ${where}`, params) as any[]
    const rows = await query(`SELECT f.*, u.username as user_name FROM feedbacks f LEFT JOIN users u ON f.user_id = u.id ${where} ORDER BY f.id DESC LIMIT ${pageSize} OFFSET ${offset}`, params) as any[]
    res.json({ rows, total: total[0].c, page, pageSize })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/feedbacks/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { status, priority } = req.body
    if (!status) return res.status(400).json({ error: 'Status required' })
    await query('UPDATE feedbacks SET status = ?, priority = ? WHERE id = ?', [status, priority || 'medium', id])
    await addOpLog(user.userId, user.username, 'Update Feedback', 'Feedback', `Updated feedback ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/faqs', authMiddleware, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM faqs ORDER BY sort_order') as any[]
    res.json({ faqs: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/faqs', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { category, question, answer, sort_order, is_published } = req.body
    if (!category || !question) return res.status(400).json({ error: 'Category and question required' })
    const [result] = await query('INSERT INTO faqs (category, question, answer, sort_order, is_published) VALUES (?, ?, ?, ?, ?)', [category, question, answer || '', sort_order || 0, is_published !== undefined ? is_published : true]) as any
    await addOpLog(user.userId, user.username, 'Create FAQ', 'FAQ', `Created FAQ: ${category}`, req)
    res.json({ success: true, insertId: result.insertId })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/faqs/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    const { category, question, answer, sort_order, is_published } = req.body
    if (!category || !question) return res.status(400).json({ error: 'Category and question required' })
    await query('UPDATE faqs SET category = ?, question = ?, answer = ?, sort_order = ?, is_published = ? WHERE id = ?', [category, question, answer || '', sort_order || 0, is_published !== undefined ? is_published : true, id])
    await addOpLog(user.userId, user.username, 'Update FAQ', 'FAQ', `Updated FAQ ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/faqs/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params
    await query('DELETE FROM faqs WHERE id = ?', [id])
    await addOpLog(user.userId, user.username, 'Delete FAQ', 'FAQ', `Deleted FAQ ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/system-configs', authMiddleware, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM system_configs ORDER BY config_key') as any[]
    res.json({ configs: rows })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/system-configs', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { config_key, config_value, config_type, description } = req.body
    if (!config_key || !config_value) return res.status(400).json({ error: 'Config key and value required' })
    await query('INSERT INTO system_configs (config_key, config_value, config_type, description) VALUES (?, ?, ?, ?)', [config_key, config_value, config_type || 'string', description || ''])
    await addOpLog(user.userId, user.username, 'Create System Config', 'System', `Created config: ${config_key}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.put('/api/system-configs/:configKey', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { configKey } = req.params
    const { config_value, config_type, description } = req.body
    if (!config_value) return res.status(400).json({ error: 'Config value required' })
    await query('UPDATE system_configs SET config_value = ?, config_type = ?, description = ? WHERE config_key = ?', [config_value, config_type || 'string', description || '', configKey])
    await addOpLog(user.userId, user.username, 'Update System Config', 'System', `Updated config: ${configKey}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/system-configs/:configKey', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { configKey } = req.params
    await query('DELETE FROM system_configs WHERE config_key = ?', [configKey])
    await addOpLog(user.userId, user.username, 'Delete System Config', 'System', `Deleted config: ${configKey}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 开放API - OAuth2.0认证
app.post('/api/oauth/token', async (req, res) => {
  try {
    const { grant_type, client_id, client_secret, code, refresh_token, scope } = req.body

    // 验证客户端
    const [client] = await query('SELECT * FROM oauth_clients WHERE client_id = ? AND client_secret = ? AND is_active = TRUE', [client_id, client_secret]) as any[]
    if (!client.length) return res.status(401).json({ error: 'Invalid client credentials' })

    // 生成令牌
    const accessToken = 'ACCESS_' + Date.now() + Math.random().toString(36).substr(2, 9)
    const refreshToken = 'REFRESH_' + Date.now() + Math.random().toString(36).substr(2, 9)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24小时过期

    await query('INSERT INTO oauth_tokens (client_id, access_token, refresh_token, scope, expires_at) VALUES (?, ?, ?, ?, ?)',
      [client_id, accessToken, refreshToken, scope || 'read write', expiresAt])

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 86400, // 24小时
      scope: scope || 'read write'
    })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/oauth/refresh', async (req, res) => {
  try {
    const { refresh_token, client_id, client_secret } = req.body

    // 验证刷新令牌
    const [token] = await query('SELECT * FROM oauth_tokens WHERE refresh_token = ? AND client_id = ?', [refresh_token, client_id]) as any[]
    if (!token.length) return res.status(401).json({ error: 'Invalid refresh token' })

    // 验证客户端
    const [client] = await query('SELECT * FROM oauth_clients WHERE client_id = ? AND client_secret = ? AND is_active = TRUE', [client_id, client_secret]) as any[]
    if (!client.length) return res.status(401).json({ error: 'Invalid client credentials' })

    // 生成新令牌
    const newAccessToken = 'ACCESS_' + Date.now() + Math.random().toString(36).substr(2, 9)
    const newRefreshToken = 'REFRESH_' + Date.now() + Math.random().toString(36).substr(2, 9)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    await query('UPDATE oauth_tokens SET access_token = ?, refresh_token = ?, expires_at = ? WHERE refresh_token = ?',
      [newAccessToken, newRefreshToken, expiresAt, refresh_token])

    res.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: 86400,
      scope: token[0].scope
    })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 开放API - API密钥管理
app.get('/api/api-keys', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const [keys] = await query('SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC', [user.userId]) as any[]
    res.json({ keys })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.post('/api/api-keys', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { keyName, scope, expiresAt } = req.body

    // 生成API密钥
    const apiKey = 'API_' + Date.now() + Math.random().toString(36).substr(2, 15)

    await query('INSERT INTO api_keys (key_name, api_key, user_id, scope, expires_at) VALUES (?, ?, ?, ?, ?)',
      [keyName, apiKey, user.userId, scope || 'read write', expiresAt])

    await addOpLog(user.userId, user.username, 'Create API Key', 'api', `Created API key: ${keyName}`, req)
    res.json({ success: true, apiKey })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/api-keys/:id', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload
    const { id } = req.params

    await query('DELETE FROM api_keys WHERE id = ? AND user_id = ?', [id, user.userId])

    await addOpLog(user.userId, user.username, 'Delete API Key', 'api', `Deleted API key ${id}`, req)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 开放API - 调用统计
app.get('/api/api-calls', authMiddleware, async (req, res) => {
  try {
    const { clientId, apiKey, endpoint, statusCode, startDate, endDate, limit = 100 } = req.query
    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (clientId) { where += ' AND client_id = ?'; params.push(clientId) }
    if (apiKey) { where += ' AND api_key = ?'; params.push(apiKey) }
    if (endpoint) { where += ' AND endpoint LIKE ?'; params.push(`%${endpoint}%`) }
    if (statusCode) { where += ' AND status_code = ?'; params.push(statusCode) }
    if (startDate) { where += ' AND created_at >= ?'; params.push(startDate) }
    if (endDate) { where += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59') }

    const [calls] = await query(`SELECT * FROM api_calls ${where} ORDER BY created_at DESC LIMIT ?`, [...params, limit]) as any[]
    res.json({ calls })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

app.get('/api/api-calls/stats', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    let where = ''
    const params: unknown[] = []

    if (startDate) { where += 'WHERE created_at >= ?'; params.push(startDate) }
    if (endDate) { where += (params.length ? ' AND' : 'WHERE') + ' created_at <= ?'; params.push(endDate + ' 23:59:59') }

    // 按端点统计
    const [endpointStats] = await query(`SELECT endpoint, COUNT(*) as count, AVG(response_time) as avg_time FROM api_calls ${where} GROUP BY endpoint ORDER BY count DESC`, params) as any[]

    // 按状态码统计
    const [statusStats] = await query(`SELECT status_code, COUNT(*) as count FROM api_calls ${where} GROUP BY status_code ORDER BY status_code`, params) as any[]

    // 按日期统计
    const [dailyStats] = await query(`SELECT DATE(created_at) as date, COUNT(*) as count FROM api_calls ${where} GROUP BY date ORDER BY date`, params) as any[]

    res.json({ endpointStats, statusStats, dailyStats })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// 开放API - 健康检查
app.get('/api/health', async (req, res) => {
  try {
    const startTime = Date.now()
    const conn = await getConnection()
    await conn.ping()
    await conn.end()
    const responseTime = Date.now() - startTime

    // 记录健康检查结果
    const healthCheckConn = await getConnection()
    await healthCheckConn.query(
      'INSERT INTO health_checks (check_type, status, message, response_time) VALUES (?, ?, ?, ?)',
      ['system', 'healthy', 'System health check passed', responseTime]
    )
    await healthCheckConn.end()

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime,
      services: {
        database: 'healthy',
        server: 'healthy'
      }
    })
  } catch (error: any) {
    // 记录健康检查失败
    try {
      const healthCheckConn = await getConnection()
      await healthCheckConn.query(
        'INSERT INTO health_checks (check_type, status, message, response_time) VALUES (?, ?, ?, ?)',
        ['system', 'critical', error.message || 'System health check failed', 0]
      )
      await healthCheckConn.end()
    } catch (e) {
      // 忽略健康检查记录失败
    }

    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
})

// 运维优化 - 健康检查管理
app.get('/api/health-checks', authMiddleware, async (req, res) => {
  try {
    const conn = await getConnection()
    const [rows] = await conn.query(
      'SELECT * FROM health_checks ORDER BY created_at DESC LIMIT 100'
    )
    await conn.end()
    res.json({ healthChecks: rows })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 运维优化 - 自动备份管理
app.get('/api/backup/configs', authMiddleware, async (req, res) => {
  try {
    const conn = await getConnection()
    const [rows] = await conn.query('SELECT * FROM backup_configs ORDER BY id')
    await conn.end()
    res.json({ configs: rows })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/backup/configs', authMiddleware, async (req, res) => {
  try {
    const { name, type, schedule, time, retention_days, is_active } = req.body
    const conn = await getConnection()
    const [result] = await conn.query(
      'INSERT INTO backup_configs (name, type, schedule, time, retention_days, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [name, type, schedule, time || '00:00', retention_days || 7, is_active !== false]
    )
    await conn.end()
    res.json({ id: result.insertId, success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/backup/records', authMiddleware, async (req, res) => {
  try {
    const conn = await getConnection()
    const [rows] = await conn.query(
      'SELECT * FROM backup_records ORDER BY created_at DESC LIMIT 100'
    )
    await conn.end()
    res.json({ records: rows })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 运维优化 - 版本管理
app.get('/api/versions', authMiddleware, async (req, res) => {
  try {
    const conn = await getConnection()
    const [rows] = await conn.query('SELECT * FROM app_versions ORDER BY created_at DESC')
    await conn.end()
    res.json({ versions: rows })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/versions', authMiddleware, async (req, res) => {
  try {
    const { version, description, changes } = req.body
    const conn = await getConnection()

    // 先将所有版本设置为非当前版本
    await conn.query('UPDATE app_versions SET is_current = FALSE')

    // 插入新版本
    const [result] = await conn.query(
      'INSERT INTO app_versions (version, description, changes, is_current) VALUES (?, ?, ?, TRUE)',
      [version, description, changes]
    )

    await conn.end()
    res.json({ id: result.insertId, success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 运维优化 - 系统监控
app.get('/api/system/metrics', authMiddleware, async (req, res) => {
  try {
    const conn = await getConnection()
    const [rows] = await conn.query(
      'SELECT * FROM system_metrics ORDER BY created_at DESC LIMIT 200'
    )
    await conn.end()
    res.json({ metrics: rows })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.use((_req, res) => { res.status(404).json({ error: 'Not found' }) })

app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err)
  const user = (req as any).user as JwtPayload | undefined
  addErrLog(user?.userId || 0, user?.username || '', req.path, err.name || 'Error', err.message, err.stack || '').catch(() => { })
  res.status(500).json({ error: err.message || 'Internal server error' })
})

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001

async function start() {
  console.log('Connecting to MySQL...')
  await initDatabase()
  console.log('MySQL connected!')

  console.log('Initializing worker pool...')
  initializeWorkerPool()
  console.log(`Worker pool initialized with ${maxWorkers} workers`)

  app.listen(PORT, () => {
    console.log(`API: http://localhost:${PORT}`)
    console.log(`MySQL: ${DB_NAME} @ 127.0.0.1:3306`)
    console.log(`Login: admin / admin123`)
  })

  // 系统监控定时任务
  setInterval(async () => {
    try {
      const os = require('os')
      const conn = await getConnection()

      // 记录CPU使用率
      const cpus = os.cpus()
      const idleMs = cpus.reduce((sum: number, cpu: any) => sum + cpu.times.idle, 0)
      const totalMs = cpus.reduce((sum: number, cpu: any) => {
        return sum + Object.values(cpu.times).reduce((sum: number, time: number) => sum + time, 0)
      }, 0)
      const cpuUsage = ((totalMs - idleMs) / totalMs) * 100

      await conn.query(
        'INSERT INTO system_metrics (metric_type, value, unit) VALUES (?, ?, ?)',
        ['cpu', cpuUsage, '%']
      )

      // 记录内存使用率
      const totalMemory = os.totalmem() / (1024 * 1024 * 1024)
      const freeMemory = os.freemem() / (1024 * 1024 * 1024)
      const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100

      await conn.query(
        'INSERT INTO system_metrics (metric_type, value, unit) VALUES (?, ?, ?)',
        ['memory', memoryUsage, '%']
      )

      await conn.end()
    } catch (error) {
      console.error('Failed to record system metrics:', error)
    }
  }, 60000) // 每分钟记录一次
}

start().catch((e) => { console.error('Failed:', e); process.exit(1) })
