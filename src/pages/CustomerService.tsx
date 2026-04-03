import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, message, Modal, Form, Select, Input, Descriptions, Timeline, Row, Col, Statistic } from 'antd'
import { EyeOutlined, EditOutlined, MessageOutlined, SendOutlined } from '@ant-design/icons'
import { serviceApi } from '../api'

const { TextArea } = Input

export default function CustomerService() {
  const [tickets, setTickets] = useState<any[]>([])
  const [ticketMessages, setTicketMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<any>({ status: '', priority: '', user_id: '' })
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [currentTicket, setCurrentTicket] = useState<any>(null)
  const [editForm] = Form.useForm()
  const [replyForm] = Form.useForm()

  useEffect(() => {
    loadTickets()
  }, [page, pageSize, filters])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const res: any = await serviceApi.getTickets({ page, pageSize, ...filters })
      setTickets(res.rows)
      setTotal(res.total)
    } catch (err: any) {
      message.error(err.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTicket = async (values: any) => {
    try {
      await serviceApi.updateTicket(currentTicket.id, values)
      message.success('更新成功')
      setEditModalOpen(false)
      editForm.resetFields()
      loadTickets()
      if (detailModalOpen) {
        loadTicketDetail(currentTicket.id)
      }
    } catch (err: any) {
      message.error(err.error || '更新失败')
    }
  }

  const handleReplyTicket = async (values: any) => {
    try {
      await serviceApi.replyTicket(currentTicket.id, values)
      message.success('回复成功')
      replyForm.resetFields()
      loadTicketDetail(currentTicket.id)
    } catch (err: any) {
      message.error(err.error || '回复失败')
    }
  }

  const openDetailModal = async (ticket: any) => {
    try {
      const [ticketRes, messagesRes] = await Promise.all([
        serviceApi.getTicket(ticket.id),
        serviceApi.getTicketMessages(ticket.id),
      ])
      setCurrentTicket(ticketRes.ticket)
      setTicketMessages(messagesRes.messages)
      setDetailModalOpen(true)
    } catch (err: any) {
      message.error(err.error || '加载失败')
    }
  }

  const openEditModal = (ticket: any) => {
    setCurrentTicket(ticket)
    editForm.setFieldsValue({ status: ticket.status, priority: ticket.priority })
    setEditModalOpen(true)
  }

  const loadTicketDetail = async (id: number) => {
    try {
      const messagesRes = await serviceApi.getTicketMessages(id)
      setTicketMessages(messagesRes.messages)
    } catch (err: any) {
      message.error(err.error || '加载失败')
    }
  }

  const statusColors: Record<string, string> = {
    open: 'processing',
    in_progress: 'blue',
    resolved: 'success',
    closed: 'default',
  }

  const statusLabels: Record<string, string> = {
    open: '待处理',
    in_progress: '处理中',
    resolved: '已解决',
    closed: '已关闭',
  }

  const priorityColors: Record<string, string> = {
    low: 'default',
    medium: 'processing',
    high: 'warning',
    urgent: 'error',
  }

  const priorityLabels: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
    urgent: '紧急',
  }

  const ticketColumns = [
    { title: 'ID', dataIndex: 'id', width: 80, key: 'id' },
    { title: '标题', dataIndex: 'title', width: 250, key: 'title', ellipsis: true },
    { title: '用户', dataIndex: 'user_name', width: 120, key: 'user_name' },
    { title: '邮箱', dataIndex: 'user_email', width: 180, key: 'user_email', ellipsis: true },
    { title: '优先级', dataIndex: 'priority', width: 80, key: 'priority', render: (priority: string) => <Tag color={priorityColors[priority]}>{priorityLabels[priority]}</Tag> },
    { title: '状态', dataIndex: 'status', width: 100, key: 'status', render: (status: string) => <Tag color={statusColors[status]}>{statusLabels[status]}</Tag> },
    { title: '处理人', dataIndex: 'assigned_to_name', width: 100, key: 'assigned_to_name' },
    { title: '创建时间', dataIndex: 'created_at', width: 160, key: 'created_at' },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetailModal(record)}>查看</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>更新</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总工单数" value={total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待处理" value={tickets.filter((t) => t.status === 'open').length} styles={{ content: { color: '#1890ff' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="处理中" value={tickets.filter((t) => t.status === 'in_progress').length} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已解决" value={tickets.filter((t) => t.status === 'resolved').length} styles={{ content: { color: '#8c8c8c' } }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select placeholder="状态" style={{ width: 120 }} allowClear onChange={(value) => setFilters({ ...filters, status: value })}>
            <Select.Option value="open">待处理</Select.Option>
            <Select.Option value="in_progress">处理中</Select.Option>
            <Select.Option value="resolved">已解决</Select.Option>
            <Select.Option value="closed">已关闭</Select.Option>
          </Select>
          <Select placeholder="优先级" style={{ width: 120 }} allowClear onChange={(value) => setFilters({ ...filters, priority: value })}>
            <Select.Option value="low">低</Select.Option>
            <Select.Option value="medium">中</Select.Option>
            <Select.Option value="high">高</Select.Option>
            <Select.Option value="urgent">紧急</Select.Option>
          </Select>
          <Input.Search placeholder="搜索用户ID" style={{ width: 150 }} onSearch={(value) => setFilters({ ...filters, user_id: value })} />
        </Space>
        <Table
          columns={ticketColumns}
          dataSource={tickets}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => { setPage(page); setPageSize(pageSize) },
          }}
        />
      </Card>

      <Modal
        title="工单详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>,
        ]}
        width={900}
      >
        {currentTicket && (
          <div>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="工单ID">{currentTicket.id}</Descriptions.Item>
              <Descriptions.Item label="标题">{currentTicket.title}</Descriptions.Item>
              <Descriptions.Item label="用户">{currentTicket.user_name}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{currentTicket.user_email}</Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={priorityColors[currentTicket.priority]}>{priorityLabels[currentTicket.priority]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[currentTicket.status]}>{statusLabels[currentTicket.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="处理人">{currentTicket.assigned_to_name || '未分配'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{currentTicket.created_at}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{currentTicket.updated_at}</Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: 16 }}>
              <h4>问题描述</h4>
              <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 4 }}>{currentTicket.description}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4>沟通记录</h4>
              <Timeline
                items={ticketMessages.map((msg) => ({
                  color: msg.sender_type === 'admin' ? 'blue' : 'green',
                  children: (
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        <strong>{msg.sender_name || msg.sender_username || '系统'}</strong>
                        <Tag style={{ marginLeft: 8 }}>{msg.sender_type === 'admin' ? '管理员' : '用户'}</Tag>
                        <span style={{ marginLeft: 8, color: '#8c8c8c' }}>{msg.created_at}</span>
                      </div>
                      <div style={{ padding: 12, background: msg.sender_type === 'admin' ? '#e6f7ff' : '#f6ffed', borderRadius: 4 }}>
                        {msg.message}
                      </div>
                    </div>
                  ),
                }))}
              />
            </div>

            <Form form={replyForm} layout="vertical">
              <Form.Item name="message" label="回复内容" rules={[{ required: true, message: '请输入回复内容' }]}>
                <TextArea rows={4} placeholder="请输入回复内容" />
              </Form.Item>
              <Button type="primary" icon={<SendOutlined />} onClick={() => replyForm.validateFields().then(handleReplyTicket)}>
                发送回复
              </Button>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title="更新工单"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.validateFields().then(handleUpdateTicket)}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select placeholder="选择状态">
              <Select.Option value="open">待处理</Select.Option>
              <Select.Option value="in_progress">处理中</Select.Option>
              <Select.Option value="resolved">已解决</Select.Option>
              <Select.Option value="closed">已关闭</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请选择优先级' }]}>
            <Select placeholder="选择优先级">
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="urgent">紧急</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
