import { useState, useEffect } from 'react'
import { Card, Table, Tag, Space, Button, DatePicker, Input, message, Popconfirm, Modal, Drawer, Form, Alert, Typography, Tooltip, Select } from 'antd'
import { ReloadOutlined, DeleteOutlined, SearchOutlined, BellOutlined, PlusOutlined, SettingOutlined, FileTextOutlined } from '@ant-design/icons'
import { logApi } from '../api'

const { RangePicker } = DatePicker
const { Text } = Typography

export default function OperationLogs() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [actionFilter, setActionFilter] = useState('')
  const [dateRange, setDateRange] = useState<any>(null)
  const [keywordSearch, setKeywordSearch] = useState('')
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false)
  const [alertRules, setAlertRules] = useState<any[]>([])
  const [alertRulesLoading, setAlertRulesLoading] = useState(false)
  const [createRuleModalOpen, setCreateRuleModalOpen] = useState(false)
  const [createRuleForm] = Form.useForm()
  const [archiveDrawerOpen, setArchiveDrawerOpen] = useState(false)
  const [archives, setArchives] = useState<any[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [checkingAlerts, setCheckingAlerts] = useState(false)

  const loadData = async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const params: any = { page, pageSize }
      if (actionFilter) params.action = actionFilter
      if (dateRange?.[0]) params.startDate = dateRange[0].format('YYYY-MM-DD')
      if (dateRange?.[1]) params.endDate = dateRange[1].format('YYYY-MM-DD')
      if (keywordSearch) params.keyword = keywordSearch
      const res: any = await logApi.operations(params)
      setData(res.rows || [])
      setPagination({ current: page, pageSize, total: res.total || 0 })
    } catch (err: any) {
      message.error(err.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleClear = async () => {
    try {
      await logApi.clearOperations()
      message.success('操作日志已清空')
      loadData(1, pagination.pageSize)
    } catch (err: any) {
      message.error(err.error || '清空失败')
    }
  }

  const handleKeywordSearch = () => {
    loadData(1, pagination.pageSize)
  }

  const loadAlertRules = async () => {
    setAlertRulesLoading(true)
    try {
      const res: any = await logApi.getAlertRules()
      setAlertRules(res.rules || [])
      setAlertDrawerOpen(true)
    } catch (err: any) {
      message.error(err.error || '加载告警规则失败')
    } finally {
      setAlertRulesLoading(false)
    }
  }

  const handleCreateRule = async () => {
    try {
      const values = await createRuleForm.validateFields()
      await logApi.createAlertRule(values)
      message.success('告警规则创建成功')
      setCreateRuleModalOpen(false)
      createRuleForm.resetFields()
      loadAlertRules()
    } catch (err: any) {
      if (err.message) message.error(err.message)
    }
  }

  const handleToggleRule = async (id: number, isEnabled: boolean) => {
    try {
      await logApi.updateAlertRule(id, { isEnabled })
      message.success(isEnabled ? '规则已启用' : '规则已禁用')
      loadAlertRules()
    } catch (err: any) {
      message.error(err.error || '更新失败')
    }
  }

  const handleDeleteRule = async (id: number) => {
    try {
      await logApi.deleteAlertRule(id)
      message.success('规则已删除')
      loadAlertRules()
    } catch (err: any) {
      message.error(err.error || '删除失败')
    }
  }

  const handleCheckAlerts = async () => {
    setCheckingAlerts(true)
    try {
      const res: any = await logApi.checkAlerts()
      message.success(`检查完成，共检查 ${res.checked} 条规则`)
    } catch (err: any) {
      message.error(err.error || '检查失败')
    } finally {
      setCheckingAlerts(false)
    }
  }

  const handleArchive = async (archiveDate: string) => {
    try {
      const res: any = await logApi.archiveLogs({ logType: 'operation', archiveDate })
      message.success(`归档成功，共归档 ${res.archivedCount} 条记录`)
      loadData(1, pagination.pageSize)
    } catch (err: any) {
      message.error(err.error || '归档失败')
    }
  }

  const loadArchives = async () => {
    setArchiveLoading(true)
    try {
      const res: any = await logApi.getArchives()
      setArchives(res.archives || [])
      setArchiveDrawerOpen(true)
    } catch (err: any) {
      message.error(err.error || '加载归档失败')
    } finally {
      setArchiveLoading(false)
    }
  }

  const actionColors: Record<string, string> = {
    '登录': 'green', '注销': 'default', 'SQL查询': 'blue', 'SQL执行': 'cyan',
    '创建表': 'purple', '删除表': 'red', '清空表': 'orange',
    '插入数据': 'green', '更新数据': 'blue', '删除数据': 'red', '修改密码': 'geekblue',
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '用户', dataIndex: 'username', width: 100 },
    {
      title: '操作',
      dataIndex: 'action',
      width: 100,
      render: (v: string) => <Tag color={actionColors[v] || 'default'}>{v}</Tag>,
    },
    { title: '资源', dataIndex: 'resource', width: 100, ellipsis: true },
    { title: '详情', dataIndex: 'detail', ellipsis: true },
    { title: 'IP', dataIndex: 'ip', width: 130 },
    { title: '时间', dataIndex: 'created_at', width: 170 },
  ]

  return (
    <div>
      <Card
        title="操作日志"
        extra={
          <Space wrap>
            <Input
              placeholder="关键词搜索"
              value={keywordSearch}
              onChange={(e) => setKeywordSearch(e.target.value)}
              onPressEnter={handleKeywordSearch}
              allowClear
              style={{ width: 150 }}
            />
            <Input
              placeholder="操作类型"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              onPressEnter={() => loadData(1, pagination.pageSize)}
              allowClear
              style={{ width: 140 }}
            />
            <RangePicker onChange={setDateRange} />
            <Button icon={<SearchOutlined />} onClick={() => loadData(1, pagination.pageSize)}>
              搜索
            </Button>
            <Button icon={<BellOutlined />} onClick={handleCheckAlerts} loading={checkingAlerts}>
              检查告警
            </Button>
            <Button icon={<SettingOutlined />} onClick={loadAlertRules}>
              告警规则
            </Button>
            <Button icon={<FileTextOutlined />} onClick={loadArchives}>
              归档管理
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => loadData(pagination.current, pagination.pageSize)}>
              刷新
            </Button>
            <Popconfirm title="确定清空所有操作日志？" onConfirm={handleClear}>
              <Button danger icon={<DeleteOutlined />}>清空</Button>
            </Popconfirm>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 900 }}
          onChange={(pag) => loadData(pag.current, pag.pageSize)}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
        />
      </Card>

      <Drawer
        title="告警规则"
        placement="right"
        width={800}
        open={alertDrawerOpen}
        onClose={() => setAlertDrawerOpen(false)}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateRuleModalOpen(true)}>
            新建规则
          </Button>
        }
      >
        <Table
          columns={[
            { title: '规则名称', dataIndex: 'rule_name', key: 'rule_name' },
            {
              title: '日志类型',
              dataIndex: 'log_type',
              key: 'log_type',
              render: (type: string) => (
                <Tag color={type === 'operation' ? 'blue' : 'red'}>{type === 'operation' ? '操作日志' : '错误日志'}</Tag>
              ),
            },
            {
              title: '条件类型',
              dataIndex: 'condition_type',
              key: 'condition_type',
              render: (type: string) => {
                if (type === 'keyword') return <Tag color="green">关键词</Tag>
                if (type === 'error_type') return <Tag color="orange">错误类型</Tag>
                if (type === 'frequency') return <Tag color="purple">频率</Tag>
                return type
              },
            },
            {
              title: '条件值',
              dataIndex: 'condition_value',
              key: 'condition_value',
              ellipsis: true,
            },
            {
              title: '告警方式',
              dataIndex: 'alert_method',
              key: 'alert_method',
              render: (method: string) => {
                if (method === 'email') return <Tag color="blue">邮件</Tag>
                if (method === 'webhook') return <Tag color="cyan">Webhook</Tag>
                if (method === 'database') return <Tag color="green">数据库</Tag>
                return method
              },
            },
            {
              title: '状态',
              dataIndex: 'is_enabled',
              key: 'is_enabled',
              width: 100,
              render: (enabled: boolean) => (
                <Tooltip title={enabled ? '点击禁用' : '点击启用'}>
                  <Button
                    size="small"
                    type={enabled ? 'primary' : 'default'}
                    onClick={() => handleToggleRule(enabled ? 0 : 1, enabled)}
                  >
                    {enabled ? '启用' : '禁用'}
                  </Button>
                </Tooltip>
              ),
            },
            {
              title: '操作',
              key: 'action',
              width: 100,
              render: (_: unknown, record: any) => (
                <Popconfirm
                  title="确定要删除此规则吗？"
                  onConfirm={() => handleDeleteRule(record.id)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ),
            },
          ]}
          dataSource={alertRules}
          rowKey="id"
          loading={alertRulesLoading}
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </Drawer>

      <Modal
        title="创建告警规则"
        open={createRuleModalOpen}
        onOk={handleCreateRule}
        onCancel={() => {
          setCreateRuleModalOpen(false)
          createRuleForm.resetFields()
        }}
        width={600}
      >
        <Form form={createRuleForm} layout="vertical">
          <Form.Item
            name="ruleName"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="请输入规则名称" />
          </Form.Item>
          <Form.Item
            name="logType"
            label="日志类型"
            rules={[{ required: true, message: '请选择日志类型' }]}
          >
            <Select placeholder="请选择日志类型">
              <Select.Option value="operation">操作日志</Select.Option>
              <Select.Option value="error">错误日志</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="conditionType"
            label="条件类型"
            rules={[{ required: true, message: '请选择条件类型' }]}
          >
            <Select placeholder="请选择条件类型">
              <Select.Option value="keyword">关键词匹配</Select.Option>
              <Select.Option value="error_type">错误类型</Select.Option>
              <Select.Option value="frequency">频率检测</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="conditionValue"
            label="条件值"
            rules={[{ required: true, message: '请输入条件值' }]}
          >
            <Input placeholder="请输入关键词、错误类型或阈值" />
          </Form.Item>
          <Form.Item
            name="alertMethod"
            label="告警方式"
            rules={[{ required: true, message: '请选择告警方式' }]}
          >
            <Select placeholder="请选择告警方式">
              <Select.Option value="database">数据库记录</Select.Option>
              <Select.Option value="email">邮件通知</Select.Option>
              <Select.Option value="webhook">Webhook</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="alertConfig"
            label="告警配置"
          >
            <Input.TextArea placeholder='JSON格式，例如: {"threshold": 100}' rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="归档管理"
        placement="right"
        width={800}
        open={archiveDrawerOpen}
        onClose={() => setArchiveDrawerOpen(false)}
      >
        <Alert
          message="归档说明"
          description="归档会将指定日期的日志移动到归档表，原表中的记录将被删除。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={[
            { title: '日志类型', dataIndex: 'log_type', key: 'log_type', render: (type: string) => type === 'operation' ? '操作日志' : '错误日志' },
            { title: '归档日期', dataIndex: 'archive_date', key: 'archive_date' },
            { title: '日志数量', dataIndex: 'log_count', key: 'log_count' },
            { title: '归档时间', dataIndex: 'created_at', key: 'created_at' },
          ]}
          dataSource={archives}
          rowKey="id"
          loading={archiveLoading}
          size="small"
          pagination={false}
        />
      </Drawer>
    </div>
  )
}
