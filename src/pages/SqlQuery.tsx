import { useState, useEffect, useRef } from 'react'
import { Card, Table, Button, Space, message, Tag, Tabs, Typography, Modal, Input, Alert, Drawer, Tooltip } from 'antd'
import { PlayCircleOutlined, FormatPainterOutlined, ClearOutlined, HistoryOutlined, CheckCircleOutlined, ThunderboltOutlined, CodeOutlined, CloseCircleOutlined, ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons'
import { format as sqlFormat } from 'sql-formatter'
import { sqlApi, connectionApi } from '../api'
import type { QueryResult } from '../types'

const { Text } = Typography

interface HistoryItem {
  sql: string
  time: string
  success: boolean
  affectedRows?: number
}

interface QueryHistory {
  id: number
  sql: string
  execution_time: number
  affected_rows: number
  row_count: number
  status: string
  error_message: string
  created_at: string
}

interface ExplainResult {
  plan: any[]
  executionTime: string
  message: string
}

export default function SqlQuery() {
  const [sql, setSql] = useState('SELECT * FROM ')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [activeTab, setActiveTab] = useState('result')
  const [connected, setConnected] = useState(false)
  const [validating, setValidating] = useState(false)
  const [explaining, setExplaining] = useState(false)
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(null)
  const [explainModalVisible, setExplainModalVisible] = useState(false)
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const [batchSqls, setBatchSqls] = useState('')
  const [batchResults, setBatchResults] = useState<any[]>([])
  const [batchExecuting, setBatchExecuting] = useState(false)
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false)
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [executionTime, setExecutionTime] = useState<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      const res: any = await connectionApi.status()
      setConnected(res.connected)
    } catch {
      setConnected(false)
    }
  }

  const handleExecute = async () => {
    if (!sql.trim()) {
      message.warning('请输入 SQL 语句')
      return
    }
    if (!connected) {
      message.warning('数据库未就绪')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setExecutionTime('')

    try {
      const res: any = await sqlApi.execute(sql)
      setResult(res)
      setActiveTab('result')
      setExecutionTime(res.executionTime || '0.000')
      setHistory((prev) => [
        {
          sql: sql.trim(),
          time: new Date().toLocaleTimeString(),
          success: true,
          affectedRows: res.affectedRows,
        },
        ...prev.slice(0, 49),
      ])
    } catch (err: any) {
      setError(err.error || err.message)
      setActiveTab('error')
      setHistory((prev) => [
        {
          sql: sql.trim(),
          time: new Date().toLocaleTimeString(),
          success: false,
        },
        ...prev.slice(0, 49),
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleFormat = () => {
    try {
      const formatted = sqlFormat(sql, { language: 'mysql', tabWidth: 2 })
      setSql(formatted)
      message.success('SQL 格式化成功')
    } catch {
      message.error('SQL 格式化失败，请检查语法')
    }
  }

  const handleValidate = async () => {
    if (!sql.trim()) {
      message.warning('请输入 SQL 语句')
      return
    }
    setValidating(true)
    try {
      const res: any = await sqlApi.validate(sql)
      if (res.valid) {
        message.success(res.message || 'SQL 语法校验通过')
      } else {
        message.error(res.error || 'SQL 语法校验失败')
      }
    } catch (err: any) {
      message.error(err.error || '校验失败')
    } finally {
      setValidating(false)
    }
  }

  const handleExplain = async () => {
    if (!sql.trim()) {
      message.warning('请输入 SQL 语句')
      return
    }
    setExplaining(true)
    try {
      const res: any = await sqlApi.explain(sql)
      setExplainResult(res)
      setExplainModalVisible(true)
    } catch (err: any) {
      message.error(err.error || 'EXPLAIN 分析失败')
    } finally {
      setExplaining(false)
    }
  }

  const handleBatchExecute = async () => {
    const sqls = batchSqls.split('\n').filter(s => s.trim())
    if (sqls.length === 0) {
      message.warning('请输入至少一条 SQL 语句')
      return
    }
    if (!connected) {
      message.warning('数据库未就绪')
      return
    }

    setBatchExecuting(true)
    setBatchResults([])

    try {
      const res: any = await sqlApi.batch(sqls)
      setBatchResults(res.results)
      message.success(`批量执行完成: 成功 ${res.summary.success} 条, 失败 ${res.summary.failed} 条`)
    } catch (err: any) {
      message.error(err.error || '批量执行失败')
    } finally {
      setBatchExecuting(false)
    }
  }

  const loadQueryHistory = async () => {
    setHistoryLoading(true)
    try {
      const res: any = await sqlApi.getHistory()
      setQueryHistory(res.rows)
      setHistoryDrawerVisible(true)
    } catch (err: any) {
      message.error(err.error || '加载历史记录失败')
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleExecute()
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.target as HTMLTextAreaElement
      const start = target.selectionStart
      const end = target.selectionEnd
      const newSql = sql.substring(0, start) + '  ' + sql.substring(end)
      setSql(newSql)
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2
      }, 0)
    }
  }

  const columns = result?.columns.map((col) => ({
    title: col,
    dataIndex: col,
    key: col,
    width: 150,
    ellipsis: true,
    render: (val: unknown) =>
      val === null || val === undefined ? (
        <span className="null-value">NULL</span>
      ) : (
        String(val)
      ),
  })) || []

  const explainColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: 'Select Type',
      dataIndex: 'select_type',
      key: 'select_type',
      width: 120,
    },
    {
      title: 'Table',
      dataIndex: 'table',
      key: 'table',
      width: 120,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
    },
    {
      title: 'Possible Keys',
      dataIndex: 'possible_keys',
      key: 'possible_keys',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: 100,
    },
    {
      title: 'Rows',
      dataIndex: 'rows',
      key: 'rows',
      width: 80,
    },
    {
      title: 'Extra',
      dataIndex: 'Extra',
      key: 'Extra',
      ellipsis: true,
    },
  ]

  const historyColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'SQL',
      dataIndex: 'sql',
      key: 'sql',
      ellipsis: true,
      render: (sql: string) => (
        <Tooltip title={sql}>
          <Text ellipsis style={{ maxWidth: 300 }}>{sql}</Text>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        status === 'success' ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>
        )
      ),
    },
    {
      title: '执行时间',
      dataIndex: 'execution_time',
      key: 'execution_time',
      width: 100,
      render: (time: number) => `${time.toFixed(3)}s`,
    },
    {
      title: '影响行数',
      dataIndex: 'affected_rows',
      key: 'affected_rows',
      width: 100,
    },
    {
      title: '返回行数',
      dataIndex: 'row_count',
      key: 'row_count',
      width: 100,
    },
    {
      title: '执行时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Card
        title="SQL 查询"
        size="small"
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Ctrl+Enter 执行 | Tab 缩进
            </Text>
            <Button icon={<CheckCircleOutlined />} onClick={handleValidate} loading={validating}>
              校验
            </Button>
            <Button icon={<ThunderboltOutlined />} onClick={handleExplain} loading={explaining}>
              EXPLAIN
            </Button>
            <Button icon={<CodeOutlined />} onClick={() => setBatchModalVisible(true)}>
              批量执行
            </Button>
            <Button icon={<FileTextOutlined />} onClick={loadQueryHistory}>
              历史记录
            </Button>
            <Button icon={<FormatPainterOutlined />} onClick={handleFormat}>
              格式化
            </Button>
            <Button icon={<ClearOutlined />} onClick={() => setSql('')}>
              清空
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              loading={loading}
            >
              执行
            </Button>
          </Space>
        }
      >
        <textarea
          ref={textareaRef}
          className="sql-editor"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="在此输入 SQL 语句..."
          spellCheck={false}
        />
      </Card>

      <Card
        title="查询结果"
        size="small"
        style={{ flex: 1 }}
        extra={
          <Space>
            {executionTime && (
              <Tag icon={<ClockCircleOutlined />} color="blue">
                执行时间: {executionTime}s
              </Tag>
            )}
            {result && result.rows && (
              <Tag color="blue">{result.rows.length} 行</Tag>
            )}
            {result && result.affectedRows !== undefined && (
              <Tag color="green">影响 {result.affectedRows} 行</Tag>
            )}
            {result && result.message && (
              <Tag color="orange">{result.message}</Tag>
            )}
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'result',
              label: '结果',
              children: result && result.rows ? (
                <Table
                  columns={columns}
                  dataSource={result.rows.map((row, i) => ({ ...row, _key: i }))}
                  rowKey="_key"
                  size="small"
                  scroll={{ x: 'max-content' }}
                  pagination={{ pageSize: 100, showSizeChanger: true, showTotal: (t) => `共 ${t} 行` }}
                />
              ) : (
                <Text type="secondary">暂无结果</Text>
              ),
            },
            {
              key: 'error',
              label: '错误信息',
              children: error ? (
                <pre style={{ color: '#ff4d4f', background: '#fff2f0', padding: 12, borderRadius: 6, maxHeight: 300, overflow: 'auto' }}>
                  {error}
                </pre>
              ) : (
                <Text type="secondary">无错误</Text>
              ),
            },
            {
              key: 'history',
              label: (
                <span>
                  <HistoryOutlined /> 本地历史
                </span>
              ),
              children: history.length > 0 ? (
                <div style={{ maxHeight: 400, overflow: 'auto' }}>
                  {history.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #f0f0f0',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSql(item.sql)}
                    >
                      <Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.time}
                        </Text>
                        {item.success ? (
                          <Tag color="success" style={{ fontSize: 11 }}>
                            成功
                            {item.affectedRows !== undefined && ` (${item.affectedRows}行)`}
                          </Tag>
                        ) : (
                          <Tag color="error" style={{ fontSize: 11 }}>失败</Tag>
                        )}
                      </Space>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {item.sql}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary">暂无历史记录</Text>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="EXPLAIN 分析结果"
        open={explainModalVisible}
        onCancel={() => setExplainModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setExplainModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={1000}
      >
        {explainResult && (
          <>
            <Alert
              message={explainResult.message}
              type="info"
              style={{ marginBottom: 16 }}
            />
            <Table
              columns={explainColumns}
              dataSource={explainResult.plan}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </>
        )}
      </Modal>

      <Modal
        title="批量执行 SQL"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setBatchModalVisible(false)}>
            取消
          </Button>,
          <Button key="execute" type="primary" onClick={handleBatchExecute} loading={batchExecuting}>
            执行
          </Button>,
        ]}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">每行一条 SQL 语句，按顺序执行</Text>
        </div>
        <Input.TextArea
          value={batchSqls}
          onChange={(e) => setBatchSqls(e.target.value)}
          placeholder="在此输入多条 SQL 语句，每行一条..."
          rows={10}
          style={{ fontFamily: 'monospace' }}
        />
        {batchResults.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong>执行结果:</Text>
            <div style={{ marginTop: 8, maxHeight: 300, overflow: 'auto' }}>
              {batchResults.map((r, i) => (
                <div key={i} style={{ marginBottom: 8, padding: 8, background: r.success ? '#f6ffed' : '#fff2f0', borderRadius: 4 }}>
                  <Space>
                    {r.success ? (
                      <Tag color="success">成功</Tag>
                    ) : (
                      <Tag color="error">失败</Tag>
                    )}
                    <Text code style={{ fontSize: 12 }}>{r.sql}</Text>
                  </Space>
                  {r.success && r.message && (
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary">{r.message}</Text>
                    </div>
                  )}
                  {r.error && (
                    <div style={{ marginTop: 4, color: '#ff4d4f' }}>
                      <Text type="danger">{r.error}</Text>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Drawer
        title="查询历史记录"
        placement="right"
        size="large"
        open={historyDrawerVisible}
        onClose={() => setHistoryDrawerVisible(false)}
      >
        <Table
          columns={historyColumns}
          dataSource={queryHistory}
          rowKey="id"
          loading={historyLoading}
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 'max-content' }}
          onRow={(record) => ({
            onClick: () => {
              setSql(record.sql)
              setHistoryDrawerVisible(false)
            },
            style: { cursor: 'pointer' },
          })}
        />
      </Drawer>
    </div>
  )
}
