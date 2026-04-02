import { useState, useEffect } from 'react'
import { Card, Tabs, Button, Table, Space, Modal, Form, Input, Select, Switch, message, Tag, Badge, Descriptions } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined, LogoutOutlined, DollarOutlined } from '@ant-design/icons'
import { integrationApi } from '../api'
import AppSkeleton from '../components/Skeleton'

export default function ThirdPartyIntegration() {
  const [notificationChannels, setNotificationChannels] = useState<any[]>([])
  const [logChannels, setLogChannels] = useState<any[]>([])
  const [paymentGateways, setPaymentGateways] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [currentTab, setCurrentTab] = useState('notification')
  const [currentItem, setCurrentItem] = useState<any>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [notifRes, logRes, paymentRes, transRes]: any = await Promise.all([
        integrationApi.notification.getChannels(),
        integrationApi.log.getChannels(),
        integrationApi.payment.getGateways(),
        integrationApi.payment.getTransactions(),
      ])
      setNotificationChannels(notifRes.channels || [])
      setLogChannels(logRes.channels || [])
      setPaymentGateways(paymentRes.gateways || [])
      setTransactions(transRes.transactions || [])
    } catch (err: any) {
      message.error(err.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setCurrentItem(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (item: any) => {
    setCurrentItem(item)
    form.setFieldsValue({
      ...item,
      config: JSON.stringify(item.config, null, 2),
      isActive: item.is_active,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const data = {
        ...values,
        config: values.config ? JSON.parse(values.config) : null,
        isActive: values.isActive,
      }

      if (currentItem) {
        switch (currentTab) {
          case 'notification':
            await integrationApi.notification.updateChannel(currentItem.id, data)
            break
          case 'log':
            await integrationApi.log.updateChannel(currentItem.id, data)
            break
          case 'payment':
            await integrationApi.payment.updateGateway(currentItem.id, data)
            break
        }
        message.success('更新成功')
      } else {
        switch (currentTab) {
          case 'notification':
            await integrationApi.notification.createChannel(data)
            break
          case 'log':
            await integrationApi.log.createChannel(data)
            break
          case 'payment':
            await integrationApi.payment.createGateway(data)
            break
        }
        message.success('创建成功')
      }
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      message.error(err.error || '操作失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      switch (currentTab) {
        case 'notification':
          await integrationApi.notification.deleteChannel(id)
          break
        case 'log':
          await integrationApi.log.deleteChannel(id)
          break
        case 'payment':
          await integrationApi.payment.deleteGateway(id)
          break
      }
      message.success('删除成功')
      loadData()
    } catch (err: any) {
      message.error(err.error || '删除失败')
    }
  }

  const notificationColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', width: 150 },
    { title: '类型', dataIndex: 'type', width: 100 },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ]

  const logColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', width: 150 },
    { title: '类型', dataIndex: 'type', width: 100 },
    { title: '端点', dataIndex: 'endpoint', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ]

  const paymentColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', width: 150 },
    { title: '类型', dataIndex: 'type', width: 100 },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ]

  const transactionColumns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '订单ID', dataIndex: 'order_id', width: 100 },
    { title: '用户ID', dataIndex: 'user_id', width: 100 },
    { title: '金额', dataIndex: 'amount', width: 100, render: (v: number) => `¥${v}` },
    { title: '货币', dataIndex: 'currency', width: 80 },
    { title: '网关', dataIndex: 'gateway_id', width: 80 },
    { title: '交易ID', dataIndex: 'gateway_transaction_id', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const colorMap = {
          pending: 'orange',
          success: 'green',
          failed: 'red',
          refunded: 'blue',
        }
        return <Tag color={colorMap[v as keyof typeof colorMap]}>{v}</Tag>
      },
    },
    { title: '支付方式', dataIndex: 'payment_method', width: 100 },
    { title: '创建时间', dataIndex: 'created_at', width: 170 },
  ]

  const modalTitle = currentItem ? '编辑' : '新增'
  const modalContent = (
    <Form form={form} layout="vertical">
      <Form.Item name="name" label="名称" rules={[{ required: true }]}>
        <Input placeholder="请输入名称" />
      </Form.Item>
      
      {currentTab === 'notification' && (
        <Form.Item name="type" label="通知类型" rules={[{ required: true }]}>
          <Select options={[
            { value: 'email', label: '邮件' },
            { value: 'sms', label: '短信' },
            { value: 'webhook', label: 'Webhook' },
            { value: 'push', label: '推送' },
          ]} />
        </Form.Item>
      )}
      
      {currentTab === 'log' && (
        <>
          <Form.Item name="type" label="日志类型" rules={[{ required: true }]}>
            <Select options={[
              { value: 'elk', label: 'ELK' },
              { value: 'splunk', label: 'Splunk' },
              { value: 'graylog', label: 'Graylog' },
              { value: 'datadog', label: 'Datadog' },
            ]} />
          </Form.Item>
          <Form.Item name="endpoint" label="端点URL" rules={[{ required: true }]}>
            <Input placeholder="请输入API端点" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key">
            <Input placeholder="请输入API Key" />
          </Form.Item>
        </>
      )}
      
      {currentTab === 'payment' && (
        <Form.Item name="type" label="支付类型" rules={[{ required: true }]}>
          <Select options={[
            { value: 'alipay', label: '支付宝' },
            { value: 'wechat', label: '微信支付' },
            { value: 'stripe', label: 'Stripe' },
            { value: 'paypal', label: 'PayPal' },
          ]} />
        </Form.Item>
      )}
      
      <Form.Item name="config" label="配置" help="JSON格式">
        <Input.TextArea rows={4} placeholder='{"key": "value"}' />
      </Form.Item>
      
      <Form.Item name="isActive" label="状态" valuePropName="checked" initialValue={true}>
        <Switch checkedChildren="启用" unCheckedChildren="禁用" />
      </Form.Item>
    </Form>
  )

  return (
    <AppSkeleton loading={loading}>
      <Card title="第三方集成管理">
        <Tabs activeKey={currentTab} onChange={setCurrentTab} items={[
          {
            key: 'notification',
            label: <Space><SendOutlined />消息通知</Space>,
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    新增通知渠道
                  </Button>
                </div>
                <Table
                  columns={notificationColumns}
                  dataSource={notificationChannels}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 20 }}
                />
              </>
            ),
          },
          {
            key: 'log',
            label: <Space><LogoutOutlined />日志系统</Space>,
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    新增日志集成
                  </Button>
                </div>
                <Table
                  columns={logColumns}
                  dataSource={logChannels}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 20 }}
                />
              </>
            ),
          },
          {
            key: 'payment',
            label: <Space><DollarOutlined />支付集成</Space>,
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    新增支付网关
                  </Button>
                </div>
                <Table
                  columns={paymentColumns}
                  dataSource={paymentGateways}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 20 }}
                />
                <div style={{ marginTop: 24 }}>
                  <h3>交易记录</h3>
                  <Table
                    columns={transactionColumns}
                    dataSource={transactions}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20 }}
                  />
                </div>
              </>
            ),
          },
        ]} />
      </Card>

      <Modal
        title={modalTitle}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        width={600}
      >
        {modalContent}
      </Modal>
    </AppSkeleton>
  )
}
