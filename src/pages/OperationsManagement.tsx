import { useState, useEffect } from 'react'
import { Card, Tabs, Button, Table, Space, Modal, Form, Input, Select, Switch, message, Tag, Badge, DatePicker, Descriptions, Statistic, Row, Col } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, HeartOutlined, DatabaseOutlined, HistoryOutlined, BarChartOutlined } from '@ant-design/icons'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { operationsApi } from '../api'
import AppSkeleton from '../components/Skeleton'

const { RangePicker } = DatePicker

export default function OperationsManagement() {
  const [healthChecks, setHealthChecks] = useState<any[]>([])
  const [backupConfigs, setBackupConfigs] = useState<any[]>([])
  const [backupRecords, setBackupRecords] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [currentTab, setCurrentTab] = useState('health')
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [currentTab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (currentTab === 'health') {
        const res = await operationsApi.healthChecks.getChecks()
        setHealthChecks(res.healthChecks || [])
      } else if (currentTab === 'backup') {
        const [configsRes, recordsRes] = await Promise.all([
          operationsApi.backup.getConfigs(),
          operationsApi.backup.getRecords()
        ])
        setBackupConfigs(configsRes.configs || [])
        setBackupRecords(configsRes.records || [])
      } else if (currentTab === 'versions') {
        const res = await operationsApi.versions.getVersions()
        setVersions(res.versions || [])
      } else if (currentTab === 'system') {
        const res = await operationsApi.system.getMetrics()
        setMetrics(res.metrics || [])
      }
    } catch (err: any) {
      message.error(err.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddBackupConfig = () => {
    form.resetFields()
    setModalOpen(true)
  }

  const handleSaveBackupConfig = async () => {
    try {
      const values = await form.validateFields()
      await operationsApi.backup.createConfig(values)
      message.success('备份配置创建成功')
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      message.error(err.error || '操作失败')
    }
  }

  const handleAddVersion = () => {
    form.resetFields()
    setModalOpen(true)
  }

  const handleSaveVersion = async () => {
    try {
      const values = await form.validateFields()
      await operationsApi.versions.createVersion(values)
      message.success('版本创建成功')
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      message.error(err.error || '操作失败')
    }
  }

  const healthChecksColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '检查类型', dataIndex: 'check_type', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        let color = 'default'
        if (v === 'healthy') color = 'green'
        else if (v === 'warning') color = 'orange'
        else if (v === 'critical') color = 'red'
        return <Tag color={color}>{v === 'healthy' ? '健康' : v === 'warning' ? '警告' : '严重'}</Tag>
      },
    },
    { title: '消息', dataIndex: 'message', ellipsis: true },
    { title: '响应时间(ms)', dataIndex: 'response_time', width: 120 },
    { title: '检查时间', dataIndex: 'created_at', width: 170 },
  ]

  const backupConfigsColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', width: 150 },
    { title: '类型', dataIndex: 'type', width: 100 },
    { title: '调度', dataIndex: 'schedule', width: 100 },
    { title: '时间', dataIndex: 'time', width: 100 },
    { title: '保留天数', dataIndex: 'retention_days', width: 100 },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', width: 170 },
  ]

  const backupRecordsColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '配置ID', dataIndex: 'config_id', width: 100 },
    { title: '备份类型', dataIndex: 'backup_type', width: 120 },
    { title: '备份路径', dataIndex: 'backup_path', ellipsis: true },
    { title: '文件大小', dataIndex: 'file_size', width: 100, render: (v: number) => `${(v / (1024 * 1024)).toFixed(2)} MB` },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        let color = 'default'
        if (v === 'success') color = 'green'
        else if (v === 'failed') color = 'red'
        return <Tag color={color}>{v === 'success' ? '成功' : v === 'failed' ? '失败' : '待处理'}</Tag>
      },
    },
    { title: '错误信息', dataIndex: 'error_message', ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', width: 170 },
  ]

  const versionsColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '版本号', dataIndex: 'version', width: 120 },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '变更内容', dataIndex: 'changes', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'is_current',
      width: 100,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '当前版本' : '历史版本'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', width: 170 },
  ]

  // 处理系统监控数据
  const cpuMetrics = metrics.filter(m => m.metric_type === 'cpu')
  const memoryMetrics = metrics.filter(m => m.metric_type === 'memory')

  const chartData = cpuMetrics.map((cpu, index) => ({
    time: cpu.created_at,
    cpu: cpu.value,
    memory: memoryMetrics[index]?.value || 0
  }))

  return (
    <AppSkeleton loading={loading}>
      <Card title="运维优化管理">
        <Tabs activeKey={currentTab} onChange={setCurrentTab} items={[
          {
            key: 'health',
            label: <Space><HeartOutlined />健康检查</Space>,
            children: (
              <Table
                columns={healthChecksColumns}
                dataSource={healthChecks}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 20 }}
              />
            ),
          },
          {
            key: 'backup',
            label: <Space><DatabaseOutlined />自动备份</Space>,
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddBackupConfig}>
                    添加备份配置
                  </Button>
                </div>
                <Tabs defaultActiveKey="configs" items={[
                  {
                    key: 'configs',
                    label: '备份配置',
                    children: (
                      <Table
                        columns={backupConfigsColumns}
                        dataSource={backupConfigs}
                        rowKey="id"
                        size="small"
                        pagination={{ pageSize: 20 }}
                      />
                    ),
                  },
                  {
                    key: 'records',
                    label: '备份记录',
                    children: (
                      <Table
                        columns={backupRecordsColumns}
                        dataSource={backupRecords}
                        rowKey="id"
                        size="small"
                        pagination={{ pageSize: 20 }}
                      />
                    ),
                  },
                ]} />
              </>
            ),
          },
          {
            key: 'versions',
            label: <Space><HistoryOutlined />版本管理</Space>,
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddVersion}>
                    添加版本
                  </Button>
                </div>
                <Table
                  columns={versionsColumns}
                  dataSource={versions}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 20 }}
                />
              </>
            ),
          },
          {
            key: 'system',
            label: <Space><BarChartOutlined />系统监控</Space>,
            children: (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={12}>
                    <Card>
                      <Statistic 
                        title="CPU使用率"
                        value={cpuMetrics[cpuMetrics.length - 1]?.value || 0}
                        suffix="%"
                        precision={2}
                      />
                    </Card>
                  </Col>
                  <Col xs={12}>
                    <Card>
                      <Statistic 
                        title="内存使用率"
                        value={memoryMetrics[memoryMetrics.length - 1]?.value || 0}
                        suffix="%"
                        precision={2}
                      />
                    </Card>
                  </Col>
                </Row>
                <Card title="系统资源使用趋势">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="cpu" stroke="#8884d8" name="CPU使用率(%)" />
                      <Line type="monotone" dataKey="memory" stroke="#82ca9d" name="内存使用率(%)" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </>
            ),
          },
        ]} />
      </Card>

      <Modal
        title={currentTab === 'backup' ? "添加备份配置" : "添加版本"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={currentTab === 'backup' ? handleSaveBackupConfig : handleSaveVersion}
        width={600}
      >
        <Form form={form} layout="vertical">
          {currentTab === 'backup' ? (
            <>
              <Form.Item name="name" label="配置名称" rules={[{ required: true }]}>
                <Input placeholder="请输入配置名称" />
              </Form.Item>
              <Form.Item name="type" label="备份类型" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'database', label: '数据库' },
                  { value: 'files', label: '文件' },
                  { value: 'full', label: '完整' },
                ]} />
              </Form.Item>
              <Form.Item name="schedule" label="调度频率" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'daily', label: '每日' },
                  { value: 'weekly', label: '每周' },
                  { value: 'monthly', label: '每月' },
                ]} />
              </Form.Item>
              <Form.Item name="time" label="执行时间">
                <Input placeholder="如: 00:00" />
              </Form.Item>
              <Form.Item name="retention_days" label="保留天数" initialValue={7}>
                <Input type="number" placeholder="默认7天" />
              </Form.Item>
              <Form.Item name="is_active" label="启用" initialValue={true}>
                <Switch />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="version" label="版本号" rules={[{ required: true }]}>
                <Input placeholder="如: 1.0.0" />
              </Form.Item>
              <Form.Item name="description" label="版本描述" rules={[{ required: true }]}>
                <Input placeholder="请输入版本描述" />
              </Form.Item>
              <Form.Item name="changes" label="变更内容">
                <Input.TextArea rows={4} placeholder="请输入变更内容" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </AppSkeleton>
  )
}
