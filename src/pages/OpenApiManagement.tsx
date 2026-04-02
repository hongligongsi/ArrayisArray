import { useState, useEffect } from 'react'
import { Card, Tabs, Button, Table, Space, Modal, Form, Input, Select, Switch, message, Tag, Badge, DatePicker, Descriptions, Statistic, Row, Col } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, BarChartOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { openApi } from '../api'
import AppSkeleton from '../components/Skeleton'

const { RangePicker } = DatePicker

export default function OpenApiManagement() {
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [apiCalls, setApiCalls] = useState<any[]>([])
  const [apiStats, setApiStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [currentTab, setCurrentTab] = useState('apiKeys')
  const [currentKey, setCurrentKey] = useState<any>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [keysRes, callsRes, statsRes]: any = await Promise.all([
        openApi.apiKeys.getKeys(),
        openApi.apiCalls.getCalls({ limit: 50 }),
        openApi.apiCalls.getStats(),
      ])
      setApiKeys(keysRes.keys || [])
      setApiCalls(callsRes.calls || [])
      setApiStats(statsRes)
    } catch (err: any) {
      message.error(err.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddKey = () => {
    setCurrentKey(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleSaveKey = async () => {
    try {
      const values = await form.validateFields()
      await openApi.apiKeys.createKey(values)
      message.success('API密钥创建成功')
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      message.error(err.error || '操作失败')
    }
  }

  const handleDeleteKey = async (id: number) => {
    try {
      await openApi.apiKeys.deleteKey(id)
      message.success('API密钥已删除')
      loadData()
    } catch (err: any) {
      message.error(err.error || '删除失败')
    }
  }

  const apiKeysColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'key_name', width: 150 },
    { title: 'API密钥', dataIndex: 'api_key', ellipsis: true },
    { title: '作用域', dataIndex: 'scope', width: 120 },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
    { title: '过期时间', dataIndex: 'expires_at', width: 170 },
    { title: '创建时间', dataIndex: 'created_at', width: 170 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: any) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteKey(record.id)}>删除</Button>
      ),
    },
  ]

  const apiCallsColumns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '客户端ID', dataIndex: 'client_id', width: 120 },
    { title: 'API密钥', dataIndex: 'api_key', width: 150, ellipsis: true },
    { title: '用户ID', dataIndex: 'user_id', width: 80 },
    { title: '端点', dataIndex: 'endpoint', ellipsis: true },
    { title: '方法', dataIndex: 'method', width: 80 },
    {
      title: '状态码',
      dataIndex: 'status_code',
      width: 80,
      render: (v: number) => {
        let color = 'default'
        if (v >= 200 && v < 300) color = 'green'
        else if (v >= 400 && v < 500) color = 'orange'
        else if (v >= 500) color = 'red'
        return <Tag color={color}>{v}</Tag>
      },
    },
    { title: '响应时间(ms)', dataIndex: 'response_time', width: 100 },
    { title: 'IP', dataIndex: 'ip', width: 120 },
    { title: '创建时间', dataIndex: 'created_at', width: 170 },
  ]

  return (
    <AppSkeleton loading={loading}>
      <Card title="开放API管理">
        <Tabs activeKey={currentTab} onChange={setCurrentTab} items={[
          {
            key: 'apiKeys',
            label: <Space><KeyOutlined />API密钥管理</Space>,
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddKey}>
                    生成API密钥
                  </Button>
                </div>
                <Table
                  columns={apiKeysColumns}
                  dataSource={apiKeys}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 20 }}
                />
              </>
            ),
          },
          {
            key: 'apiCalls',
            label: <Space><BarChartOutlined />调用统计</Space>,
            children: (
              <>
                {apiStats && (
                  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={8}>
                      <Card>
                        <Statistic 
                          title="今日调用"
                          value={apiStats.dailyStats?.[apiStats.dailyStats.length - 1]?.count || 0}
                          prefix={<CheckCircleOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={8}>
                      <Card>
                        <Statistic 
                          title="平均响应时间"
                          value={Math.round((apiStats.endpointStats?.reduce((sum: number, item: any) => sum + (item.avg_time || 0), 0) / apiStats.endpointStats?.length || 0))}
                          suffix="ms"
                        />
                      </Card>
                    </Col>
                    <Col xs={8}>
                      <Card>
                        <Statistic 
                          title="成功率"
                          value={(apiStats.statusStats?.find((s: any) => s.status_code >= 200 && s.status_code < 300)?.count || 0) / (apiStats.statusStats?.reduce((sum: number, s: any) => sum + s.count, 0) || 1) * 100}
                          suffix="%"
                          precision={2}
                        />
                      </Card>
                    </Col>
                  </Row>
                )}
                <Table
                  columns={apiCallsColumns}
                  dataSource={apiCalls}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 20 }}
                />
              </>
            ),
          },
          {
            key: 'documentation',
            label: <Space><KeyOutlined />API文档</Space>,
            children: (
              <Card>
                <Descriptions title="API文档" column={1} bordered>
                  <Descriptions.Item label="认证方式">OAuth2.0 / API密钥</Descriptions.Item>
                  <Descriptions.Item label="API基础路径">/api</Descriptions.Item>
                  <Descriptions.Item label="OAuth2.0端点">
                    <ul>
                      <li>获取令牌: POST /api/oauth/token</li>
                      <li>刷新令牌: POST /api/oauth/refresh</li>
                    </ul>
                  </Descriptions.Item>
                  <Descriptions.Item label="健康检查">GET /api/health</Descriptions.Item>
                  <Descriptions.Item label="请求头">
                    <ul>
                      <li>Authorization: Bearer {`<access_token>`}</li>
                      <li>或 X-API-Key: {`<api_key>`}</li>
                    </ul>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
        ]} />
      </Card>

      <Modal
        title="生成API密钥"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSaveKey}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="keyName" label="密钥名称" rules={[{ required: true }]}>
            <Input placeholder="请输入密钥名称" />
          </Form.Item>
          <Form.Item name="scope" label="作用域" initialValue="read write">
            <Input placeholder="如: read write" />
          </Form.Item>
          <Form.Item name="expiresAt" label="过期时间">
            <DatePicker style={{ width: '100%' }} showTime />
          </Form.Item>
        </Form>
      </Modal>
    </AppSkeleton>
  )
}
