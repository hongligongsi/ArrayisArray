import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, message, Modal, Form, Input, Select, Popconfirm, Tabs, Image, Row, Col, Statistic, Descriptions } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, EyeOutlined, SendOutlined } from '@ant-design/icons'
import { contentApi } from '../api'

const { TextArea } = Input

export default function ContentAudit() {
  const [articles, setArticles] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<any>({ status: '', category_id: '', search: '' })
  const [activeTab, setActiveTab] = useState('articles')
  const [articleModalOpen, setArticleModalOpen] = useState(false)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [currentArticle, setCurrentArticle] = useState<any>(null)
  const [articleForm] = Form.useForm()
  const [categoryForm] = Form.useForm()
  const [auditForm] = Form.useForm()

  useEffect(() => {
    loadCategories()
    loadArticles()
  }, [page, pageSize, filters])

  const loadArticles = async () => {
    setLoading(true)
    try {
      const res: any = await contentApi.getArticles({ page, pageSize, ...filters })
      setArticles(res.rows)
      setTotal(res.total)
    } catch (err: any) {
      message.error(err.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const res: any = await contentApi.getCategories()
      setCategories(res.categories)
    } catch (err: any) {
      message.error(err.error || '加载分类失败')
    }
  }

  const loadAuditLogs = async () => {
    setLoading(true)
    try {
      const res: any = await contentApi.getAuditLogs({ page, pageSize })
      setAuditLogs(res.rows)
      setTotal(res.total)
    } catch (err: any) {
      message.error(err.error || '加载审核日志失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateArticle = async (values: any) => {
    try {
      await contentApi.createArticle(values)
      message.success('创建成功')
      setArticleModalOpen(false)
      articleForm.resetFields()
      loadArticles()
    } catch (err: any) {
      message.error(err.error || '创建失败')
    }
  }

  const handleUpdateArticle = async (values: any) => {
    try {
      await contentApi.updateArticle(currentArticle.id, values)
      message.success('更新成功')
      setArticleModalOpen(false)
      articleForm.resetFields()
      loadArticles()
    } catch (err: any) {
      message.error(err.error || '更新失败')
    }
  }

  const handleDeleteArticle = async (id: number) => {
    try {
      await contentApi.deleteArticle(id)
      message.success('删除成功')
      loadArticles()
    } catch (err: any) {
      message.error(err.error || '删除失败')
    }
  }

  const handleSubmitArticle = async (id: number) => {
    try {
      await contentApi.submitArticle(id)
      message.success('提交成功')
      loadArticles()
    } catch (err: any) {
      message.error(err.error || '提交失败')
    }
  }

  const handleApproveArticle = async (values: any) => {
    try {
      await contentApi.approveArticle(currentArticle.id, values)
      message.success('审核通过')
      setAuditModalOpen(false)
      auditForm.resetFields()
      loadArticles()
    } catch (err: any) {
      message.error(err.error || '审核失败')
    }
  }

  const handleRejectArticle = async (values: any) => {
    try {
      await contentApi.rejectArticle(currentArticle.id, values)
      message.success('已拒绝')
      setAuditModalOpen(false)
      auditForm.resetFields()
      loadArticles()
    } catch (err: any) {
      message.error(err.error || '拒绝失败')
    }
  }

  const handleCreateCategory = async (values: any) => {
    try {
      await contentApi.createCategory(values)
      message.success('创建成功')
      setCategoryModalOpen(false)
      categoryForm.resetFields()
      loadCategories()
    } catch (err: any) {
      message.error(err.error || '创建失败')
    }
  }

  const handleDeleteCategory = async (id: number) => {
    try {
      await contentApi.deleteCategory(id)
      message.success('删除成功')
      loadCategories()
    } catch (err: any) {
      message.error(err.error || '删除失败')
    }
  }

  const openEditModal = (article: any) => {
    setCurrentArticle(article)
    articleForm.setFieldsValue({
      title: article.title,
      content: article.content,
      category_id: article.category_id,
      cover_image: article.cover_image,
      images: article.images ? JSON.parse(article.images) : [],
    })
    setArticleModalOpen(true)
  }

  const openViewModal = async (article: any) => {
    try {
      const res: any = await contentApi.getArticle(article.id)
      setCurrentArticle(res.article)
      setViewModalOpen(true)
    } catch (err: any) {
      message.error(err.error || '加载失败')
    }
  }

  const openAuditModal = (article: any) => {
    setCurrentArticle(article)
    setAuditModalOpen(true)
  }

  const statusColors: Record<string, string> = {
    draft: 'default',
    pending: 'processing',
    approved: 'success',
    rejected: 'error',
  }

  const statusLabels: Record<string, string> = {
    draft: '草稿',
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
  }

  const articleColumns = [
    { title: 'ID', dataIndex: 'id', width: 80, key: 'id' },
    { title: '标题', dataIndex: 'title', width: 200, key: 'title', ellipsis: true },
    { title: '分类', dataIndex: 'category_name', width: 120, key: 'category_name' },
    { title: '作者', dataIndex: 'author_name', width: 100, key: 'author_name' },
    { title: '状态', dataIndex: 'status', width: 100, key: 'status', render: (status: string) => <Tag color={statusColors[status]}>{statusLabels[status]}</Tag> },
    { title: '浏览量', dataIndex: 'view_count', width: 80, key: 'view_count' },
    { title: '创建时间', dataIndex: 'created_at', width: 160, key: 'created_at' },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openViewModal(record)}>查看</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>编辑</Button>
          {record.status === 'draft' && (
            <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleSubmitArticle(record.id)}>提交</Button>
          )}
          {record.status === 'pending' && (
            <>
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => openAuditModal(record)}>审核</Button>
            </>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteArticle(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const auditLogColumns = [
    { title: 'ID', dataIndex: 'id', width: 80, key: 'id' },
    { title: '文章标题', dataIndex: 'article_title', width: 200, key: 'article_title', ellipsis: true },
    { title: '操作人', dataIndex: 'auditor_name', width: 100, key: 'auditor_name' },
    {
      title: '操作',
      dataIndex: 'action',
      width: 100,
      key: 'action',
      render: (action: string) => {
        const actionLabels: Record<string, string> = { submit: '提交', approve: '通过', reject: '拒绝' }
        const actionColors: Record<string, string> = { submit: 'default', approve: 'success', reject: 'error' }
        return <Tag color={actionColors[action]}>{actionLabels[action]}</Tag>
      },
    },
    { title: '状态变更', dataIndex: 'status_before', width: 120, key: 'status_before', render: (before: string, record: any) => `${statusLabels[before]} → ${statusLabels[record.status_after]}` },
    { title: '备注', dataIndex: 'comment', width: 200, key: 'comment', ellipsis: true },
    { title: '时间', dataIndex: 'created_at', width: 160, key: 'created_at' },
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总文章数" value={total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="草稿" value={articles.filter((a) => a.status === 'draft').length} styles={{ content: { color: '#8c8c8c' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待审核" value={articles.filter((a) => a.status === 'pending').length} styles={{ content: { color: '#1890ff' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已通过" value={articles.filter((a) => a.status === 'approved').length} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'articles',
              label: '文章管理',
              children: (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Input.Search placeholder="搜索标题或内容" style={{ width: 200 }} onSearch={(value) => setFilters({ ...filters, search: value })} />
                    <Select placeholder="状态" style={{ width: 120 }} allowClear onChange={(value) => setFilters({ ...filters, status: value })}>
                      <Select.Option value="draft">草稿</Select.Option>
                      <Select.Option value="pending">待审核</Select.Option>
                      <Select.Option value="approved">已通过</Select.Option>
                      <Select.Option value="rejected">已拒绝</Select.Option>
                    </Select>
                    <Select placeholder="分类" style={{ width: 150 }} allowClear onChange={(value) => setFilters({ ...filters, category_id: value })}>
                      {categories.map((cat) => (
                        <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
                      ))}
                    </Select>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCurrentArticle(null); articleForm.resetFields(); setArticleModalOpen(true) }}>新建文章</Button>
                  </Space>
                  <Table
                    columns={articleColumns}
                    dataSource={articles}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1200 }}
                    pagination={{
                      current: page,
                      pageSize,
                      total,
                      showSizeChanger: true,
                      showTotal: (total) => `共 ${total} 条`,
                      onChange: (page, pageSize) => { setPage(page); setPageSize(pageSize) },
                    }}
                  />
                </>
              ),
            },
            {
              key: 'categories',
              label: '分类管理',
              children: (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { categoryForm.resetFields(); setCategoryModalOpen(true) }}>新建分类</Button>
                  </Space>
                  <Table
                    columns={[
                      { title: 'ID', dataIndex: 'id', width: 80 },
                      { title: '名称', dataIndex: 'name', width: 200 },
                      { title: '描述', dataIndex: 'description', width: 300, ellipsis: true },
                      { title: '排序', dataIndex: 'sort_order', width: 100 },
                      { title: '创建时间', dataIndex: 'created_at', width: 160 },
                      {
                        title: '操作',
                        key: 'action',
                        width: 100,
                        render: (_: any, record: any) => (
                          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteCategory(record.id)}>
                            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                          </Popconfirm>
                        ),
                      },
                    ]}
                    dataSource={categories}
                    rowKey="id"
                    pagination={false}
                  />
                </>
              ),
            },
            {
              key: 'auditLogs',
              label: '审核日志',
              children: (
                <Table
                  columns={auditLogColumns}
                  dataSource={auditLogs}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: page,
                    pageSize,
                    total,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                    onChange: (page, pageSize) => { setPage(page); setPageSize(pageSize) },
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={currentArticle ? '编辑文章' : '新建文章'}
        open={articleModalOpen}
        onCancel={() => setArticleModalOpen(false)}
        onOk={() => articleForm.validateFields().then(currentArticle ? handleUpdateArticle : handleCreateArticle)}
        width={800}
      >
        <Form form={articleForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入文章标题" />
          </Form.Item>
          <Form.Item name="category_id" label="分类">
            <Select placeholder="选择分类" allowClear>
              {categories.map((cat) => (
                <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="cover_image" label="封面图片">
            <Input placeholder="封面图片URL" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <TextArea rows={10} placeholder="请输入文章内容" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建分类"
        open={categoryModalOpen}
        onCancel={() => setCategoryModalOpen(false)}
        onOk={() => categoryForm.validateFields().then(handleCreateCategory)}
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item name="description" label="分类描述">
            <TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <Input type="number" placeholder="请输入排序" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="文章详情"
        open={viewModalOpen}
        onCancel={() => setViewModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalOpen(false)}>关闭</Button>,
        ]}
        width={800}
      >
        {currentArticle && (
          <div>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="标题">{currentArticle.title}</Descriptions.Item>
              <Descriptions.Item label="分类">{currentArticle.category_name}</Descriptions.Item>
              <Descriptions.Item label="作者">{currentArticle.author_name}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[currentArticle.status]}>{statusLabels[currentArticle.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="浏览量">{currentArticle.view_count}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{currentArticle.created_at}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{currentArticle.updated_at}</Descriptions.Item>
            </Descriptions>
            {currentArticle.cover_image && (
              <div style={{ marginTop: 16 }}>
                <div style={{ marginBottom: 8 }}>封面图片：</div>
                <Image src={currentArticle.cover_image} width="100%" style={{ maxHeight: 400 }} />
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 8 }}>内容：</div>
              <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 4 }}>{currentArticle.content}</div>
            </div>
            {currentArticle.reject_reason && (
              <div style={{ marginTop: 16 }}>
                <div style={{ marginBottom: 8 }}>拒绝原因：</div>
                <div style={{ padding: 16, background: '#fff2f0', borderRadius: 4, color: '#ff4d4f' }}>{currentArticle.reject_reason}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="审核文章"
        open={auditModalOpen}
        onCancel={() => setAuditModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setAuditModalOpen(false)}>取消</Button>,
          <Popconfirm key="reject" title="确定拒绝该文章？" onConfirm={() => auditForm.validateFields().then(handleRejectArticle)}>
            <Button danger icon={<CloseOutlined />}>拒绝</Button>
          </Popconfirm>,
          <Popconfirm key="approve" title="确定通过该文章？" onConfirm={() => auditForm.validateFields().then(handleApproveArticle)}>
            <Button type="primary" icon={<CheckOutlined />}>通过</Button>
          </Popconfirm>,
        ]}
        width={600}
      >
        {currentArticle && (
          <div>
            <Descriptions bordered column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="标题">{currentArticle.title}</Descriptions.Item>
              <Descriptions.Item label="分类">{currentArticle.category_name}</Descriptions.Item>
              <Descriptions.Item label="作者">{currentArticle.author_name}</Descriptions.Item>
            </Descriptions>
            <Form form={auditForm} layout="vertical">
              <Form.Item name="comment" label="审核备注">
                <TextArea rows={4} placeholder="请输入审核备注（可选）" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}
