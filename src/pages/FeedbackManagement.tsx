import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, message, Popconfirm, Modal, Form, Input, InputNumber, Select, Tabs, Descriptions, DatePicker, Badge, Divider, Switch } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, CheckOutlined, CloseOutlined, UserOutlined, ClockCircleOutlined, FileTextOutlined, TagOutlined, AlertOutlined } from '@ant-design/icons'
import { feedbackApi, faqApi } from '../api'

export default function FeedbackManagement() {
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [faqs, setFaqs] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [slaRules, setSlaRules] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [slaModalOpen, setSlaModalOpen] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null)
  const [selectedFeedbackDetails, setSelectedFeedbackDetails] = useState<any>({ feedback: {}, notes: [], relatedFaqs: [] })
  const [detailForm] = Form.useForm()
  const [templateForm] = Form.useForm()
  const [slaForm] = Form.useForm()
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPriority, setFilterPriority] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [fRes, faqRes, templateRes, slaRes]: any = await Promise.all([
        feedbackApi.getFeedbacks({ status: filterStatus, priority: filterPriority }),
        faqApi.getFaqs(),
        feedbackApi.getTemplates(),
        feedbackApi.getSlaRules(),
      ])
      setFeedbacks(fRes.feedbacks || [])
      setFaqs(faqRes.faqs || [])
      setTemplates(templateRes.templates || [])
      setSlaRules(slaRes.rules || [])
    } catch (err: any) {
      message.error(err.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadFeedbackDetails = async (id: number) => {
    try {
      const res: any = await feedbackApi.getFeedback(id)
      setSelectedFeedbackDetails(res)
    } catch (err: any) {
      message.error(err.error || '加载详情失败')
    }
  }

  const handleFeedbackStatus = async (id: number, status: string) => {
    try {
      await feedbackApi.updateFeedback(id, { status })
      message.success('状态已更新')
      loadData()
    } catch (err: any) {
      message.error(err.error || '更新失败')
    }
  }

  const handleAssign = async (id: number, assignedTo: number, assignedName: string) => {
    try {
      await feedbackApi.updateFeedback(id, { assignedTo, assignedName, status: 'processing' })
      message.success('已分配')
      loadData()
    } catch (err: any) {
      message.error(err.error || '分配失败')
    }
  }

  const handleAddNote = async (id: number, content: string, isInternal: boolean) => {
    try {
      await feedbackApi.addNote(id, { content, isInternal })
      message.success('笔记已添加')
      loadFeedbackDetails(id)
    } catch (err: any) {
      message.error(err.error || '添加失败')
    }
  }

  const handleAddFaqRelation = async (id: number, faqId: number, relevanceScore: number) => {
    try {
      await feedbackApi.addFaqRelation(id, { faqId, relevanceScore })
      message.success('FAQ已关联')
      loadFeedbackDetails(id)
    } catch (err: any) {
      message.error(err.error || '关联失败')
    }
  }

  const handleCreateTemplate = async () => {
    try {
      const values = await templateForm.validateFields()
      await feedbackApi.createTemplate(values)
      message.success('模板已创建')
      setTemplateModalOpen(false)
      loadData()
    } catch (err: any) {
      message.error(err.error || '创建失败')
    }
  }

  const handleCreateSlaRule = async () => {
    try {
      const values = await slaForm.validateFields()
      await feedbackApi.createSlaRule(values)
      message.success('SLA规则已创建')
      setSlaModalOpen(false)
      loadData()
    } catch (err: any) {
      message.error(err.error || '创建失败')
    }
  }

  const priorityMap: Record<string, { text: string; color: string }> = {
    low: { text: '低', color: 'default' },
    medium: { text: '中', color: 'blue' },
    high: { text: '高', color: 'orange' },
    urgent: { text: '紧急', color: 'red' },
  }

  const statusMap: Record<string, { text: string; color: string }> = {
    pending: { text: '待处理', color: 'orange' },
    processing: { text: '处理中', color: 'blue' },
    resolved: { text: '已解决', color: 'green' },
    closed: { text: '已关闭', color: 'default' },
  }

  const feedbackColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户', dataIndex: 'user_name', width: 100 },
    { title: '类型', dataIndex: 'type', width: 100 },
    { title: '标题', dataIndex: 'title', width: 200, ellipsis: true },
    { title: '内容', dataIndex: 'content', width: 300, ellipsis: true },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      render: (v: string) => <Tag color={priorityMap[v]?.color}>{priorityMap[v]?.text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag color={statusMap[v]?.color}>{statusMap[v]?.text}</Tag>,
    },
    {
      title: '负责人',
      dataIndex: 'assigned_name',
      width: 100,
      render: (v: string) => v || '-',
    },
    {
      title: 'SLA状态',
      dataIndex: 'sla_deadline',
      width: 120,
      render: (v: string) => {
        if (!v) return '-'
        const deadline = new Date(v)
        const now = new Date()
        const isOverdue = now > deadline
        return (
          <Badge status={isOverdue ? 'error' : 'success'} text={isOverdue ? '已逾期' : '正常'} />
        )
      },
    },
    { title: '创建时间', dataIndex: 'created_at', width: 170 },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_: unknown, record: any) => (
        <Space>
          <Button size="small" onClick={() => {
            setSelectedFeedback(record)
            loadFeedbackDetails(record.id)
            setDetailModalOpen(true)
          }}>详情</Button>
          {record.status === 'pending' && (
            <Button size="small" type="primary" onClick={() => handleAssign(record.id, 1, '管理员')}>
              分配
            </Button>
          )}
          {record.status !== 'resolved' && (
            <Button size="small" icon={<CheckOutlined />} onClick={() => handleFeedbackStatus(record.id, 'resolved')}>
              解决
            </Button>
          )}
          {record.status !== 'closed' && (
            <Button size="small" icon={<CloseOutlined />} onClick={() => handleFeedbackStatus(record.id, 'closed')}>
              关闭
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const faqColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '问题', dataIndex: 'question', width: 300, ellipsis: true },
    { title: '答案', dataIndex: 'answer', width: 400, ellipsis: true },
    { title: '排序', dataIndex: 'sort_order', width: 80 },
    {
      title: '状态',
      dataIndex: 'is_published',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '已发布' : '草稿'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />}>编辑</Button>
        </Space>
      ),
    },
  ]

  const templateColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', width: 200 },
    { title: '类型', dataIndex: 'type', width: 100 },
    { title: '内容', dataIndex: 'content', width: 400, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
  ]

  const slaColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', width: 200 },
    { title: '优先级', dataIndex: 'priority', width: 100 },
    { title: '响应时间(分钟)', dataIndex: 'response_time', width: 120 },
    { title: '解决时间(分钟)', dataIndex: 'resolution_time', width: 120 },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
  ]

  return (
    <>
      <Card title="反馈与问题管理">
        <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
          <Select
            placeholder="状态筛选"
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 150 }}
            options={[
              { value: '', label: '全部' },
              { value: 'pending', label: '待处理' },
              { value: 'processing', label: '处理中' },
              { value: 'resolved', label: '已解决' },
              { value: 'closed', label: '已关闭' },
            ]}
          />
          <Select
            placeholder="优先级筛选"
            value={filterPriority}
            onChange={setFilterPriority}
            style={{ width: 150 }}
            options={[
              { value: '', label: '全部' },
              { value: 'low', label: '低' },
              { value: 'medium', label: '中' },
              { value: 'high', label: '高' },
              { value: 'urgent', label: '紧急' },
            ]}
          />
          <Button type="primary" onClick={loadData}>筛选</Button>
        </div>

        <Tabs
          defaultActiveKey="feedback"
          items={[
            {
              key: 'feedback',
              label: `用户反馈 (${feedbacks.length})`,
              children: (
                <Table
                  columns={feedbackColumns}
                  dataSource={feedbacks}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  pagination={{ pageSize: 20 }}
                />
              ),
            },
            {
              key: 'faq',
              label: `FAQ管理 (${faqs.length})`,
              children: (
                <Table
                  columns={faqColumns}
                  dataSource={faqs}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  pagination={{ pageSize: 20 }}
                />
              ),
            },
            {
              key: 'templates',
              label: `回复模板 (${templates.length})`,
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setTemplateModalOpen(true)}>
                      新增模板
                    </Button>
                  </div>
                  <Table
                    columns={templateColumns}
                    dataSource={templates}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    pagination={{ pageSize: 20 }}
                  />
                </>
              ),
            },
            {
              key: 'sla',
              label: `SLA规则 (${slaRules.length})`,
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setSlaModalOpen(true)}>
                      新增SLA规则
                    </Button>
                  </div>
                  <Table
                    columns={slaColumns}
                    dataSource={slaRules}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    pagination={{ pageSize: 20 }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="反馈详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>
        ]}
      >
        {selectedFeedback && (
          <>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="ID">{selectedFeedback.id}</Descriptions.Item>
              <Descriptions.Item label="用户">{selectedFeedback.user_name}</Descriptions.Item>
              <Descriptions.Item label="类型">{selectedFeedback.type}</Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={priorityMap[selectedFeedback.priority]?.color}>
                  {priorityMap[selectedFeedback.priority]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusMap[selectedFeedback.status]?.color}>
                  {statusMap[selectedFeedback.status]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="负责人">{selectedFeedback.assigned_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="SLA截止时间">{selectedFeedback.sla_deadline || '-'}</Descriptions.Item>
              <Descriptions.Item label="响应时间">{selectedFeedback.response_time || '-'}</Descriptions.Item>
              <Descriptions.Item label="解决时间" span={2}>{selectedFeedback.resolution_time || '-'}</Descriptions.Item>
              <Descriptions.Item label="标题" span={2}>{selectedFeedback.title}</Descriptions.Item>
              <Descriptions.Item label="内容" span={2}>{selectedFeedback.content}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">关联FAQ</Divider>
            <Table
              columns={[
                { title: 'ID', dataIndex: 'id', width: 60 },
                { title: '问题', dataIndex: 'question' },
              ]}
              dataSource={selectedFeedbackDetails.relatedFaqs}
              rowKey="id"
              size="small"
              pagination={false}
            />

            <Divider orientation="left">处理记录</Divider>
            <Table
              columns={[
                { title: '用户', dataIndex: 'user_name', width: 120 },
                { title: '内容', dataIndex: 'content' },
                { title: '类型', dataIndex: 'is_internal', width: 80, render: (v: boolean) => v ? '内部' : '公开' },
                { title: '时间', dataIndex: 'created_at', width: 170 },
              ]}
              dataSource={selectedFeedbackDetails.notes}
              rowKey="id"
              size="small"
              pagination={false}
            />

            <Divider orientation="left">添加处理记录</Divider>
            <Form layout="vertical" onFinish={(values) => {
              handleAddNote(selectedFeedback.id, values.content, values.isInternal)
              detailForm.resetFields()
            }}>
              <Form.Item name="content" label="内容" rules={[{ required: true }]}>
                <Input.TextArea rows={4} />
              </Form.Item>
              <Form.Item name="isInternal" label="类型" valuePropName="checked" initialValue={false}>
                <Switch checkedChildren="内部" unCheckedChildren="公开" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">添加记录</Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <Modal
        title="新增回复模板"
        open={templateModalOpen}
        onCancel={() => setTemplateModalOpen(false)}
        onOk={handleCreateTemplate}
        width={600}
      >
        <Form form={templateForm} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="如：感谢反馈" />
          </Form.Item>
          <Form.Item name="content" label="模板内容" rules={[{ required: true }]}>
            <Input.TextArea rows={6} placeholder="回复内容" />
          </Form.Item>
          <Form.Item name="type" label="模板类型">
            <Select options={[
              { value: 'general', label: '通用' },
              { value: 'bug', label: 'Bug反馈' },
              { value: 'feature', label: '功能建议' },
              { value: 'other', label: '其他' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增SLA规则"
        open={slaModalOpen}
        onCancel={() => setSlaModalOpen(false)}
        onOk={handleCreateSlaRule}
        width={600}
      >
        <Form form={slaForm} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="如：紧急优先级SLA" />
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
            <Select options={[
              { value: 'low', label: '低' },
              { value: 'medium', label: '中' },
              { value: 'high', label: '高' },
              { value: 'urgent', label: '紧急' },
            ]} />
          </Form.Item>
          <Form.Item name="responseTime" label="响应时间(分钟)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="resolutionTime" label="解决时间(分钟)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
