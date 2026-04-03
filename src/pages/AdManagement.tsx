import React, { useState, useEffect } from 'react'
import { Card, Tabs, Table, Button, Space, Tag, message, Popconfirm, Modal, Form, Input, InputNumber, Switch, Select, DatePicker, Collapse, Statistic, Row, Col } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, DollarOutlined, BarChartOutlined, ExperimentOutlined, CalendarOutlined } from '@ant-design/icons'
import { adApi } from '../api'
import dayjs from 'dayjs'

const { Option } = Select
const { RangePicker } = DatePicker
const { Panel } = Collapse

const AdManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ads')
  const [ads, setAds] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [editForm] = Form.useForm()
  const [testForm] = Form.useForm()

  useEffect(() => {
    if (activeTab === 'ads') {
      loadAds()
    } else if (activeTab === 'ab-tests') {
      loadAbTests()
    } else if (activeTab === 'stats') {
      loadStats()
    }
  }, [activeTab])

  const loadAds = async () => {
    setLoading(true)
    try {
      const response = await adApi.getAds({})
      setAds(response.data.ads || [])
    } catch (error) {
      message.error('加载广告失败')
    } finally {
      setLoading(false)
    }
  }

  const loadAbTests = async () => {
    setLoading(true)
    try {
      const response = await adApi.getAbTests()
      setTests(response.data.tests || [])
    } catch (error) {
      message.error('加载A/B测试失败')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    setLoading(true)
    try {
      const response = await adApi.getStats({})
      setStats(response.data.stats || [])
    } catch (error) {
      message.error('加载统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await adApi.deleteAd(id)
      message.success('广告已删除')
      loadAds()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const openEditModal = (record: any) => {
    setEditRecord(record)
    editForm.setFieldsValue(record)
    setEditModalOpen(true)
  }

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields()
      if (editRecord.id) {
        await adApi.updateAd(editRecord.id, values)
        message.success('广告已更新')
      } else {
        await adApi.createAd(values)
        message.success('广告已创建')
      }
      setEditModalOpen(false)
      loadAds()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleCreateAbTest = async () => {
    try {
      const values = await testForm.validateFields()
      await adApi.createAbTest(values)
      message.success('A/B测试已创建')
      setTestModalOpen(false)
      loadAbTests()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const positionMap: Record<string, string> = {
    splash: '启动页',
    banner: '横幅',
    reward: '激励广告',
  }

  const adColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '广告名称', dataIndex: 'title', width: 150 },
    { title: '位置', dataIndex: 'position', width: 100, render: (v: string) => positionMap[v] || v },
    { title: '图片URL', dataIndex: 'image_url', width: 200, ellipsis: true },
    { title: '链接URL', dataIndex: 'link_url', width: 200, ellipsis: true },
    { title: '展示频率', dataIndex: 'show_frequency', width: 100, render: (v: number) => `${v}次/天` },
    { title: '跳过时间', dataIndex: 'skip_time', width: 100, render: (v: number) => `${v}秒` },
    { title: '开始日期', dataIndex: 'start_date', width: 120, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
    { title: '结束日期', dataIndex: 'end_date', width: 120, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
    { title: 'A/B分组', dataIndex: 'ab_test_group', width: 100, render: (v: string) => v || '-' },
    { title: '防作弊', dataIndex: 'anti_cheat', width: 80, render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag> },
    { title: '状态', dataIndex: 'is_enabled', width: 80, render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag> },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>编辑</Button>
          <Popconfirm title="确定删除此广告？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const testColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '测试名称', dataIndex: 'name', width: 200 },
    { title: '开始日期', dataIndex: 'start_date', width: 120, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '结束日期', dataIndex: 'end_date', width: 120, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '状态', dataIndex: 'is_active', width: 80, render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '活跃' : '已结束'}</Tag> },
  ]

  const statColumns = [
    { title: '广告ID', dataIndex: 'ad_id', width: 80 },
    { title: '日期', dataIndex: 'date', width: 120, render: (v: string) => dayjs(v).format('YYYY-MM-DD') },
    { title: '展示次数', dataIndex: 'view_count', width: 100 },
    { title: '唯一展示', dataIndex: 'unique_views', width: 100 },
    { title: '点击次数', dataIndex: 'click_count', width: 100 },
    { title: '唯一点击', dataIndex: 'unique_clicks', width: 100 },
    { title: '跳出率', dataIndex: 'bounce_rate', width: 100, render: (v: number) => `${v}%` },
    { title: '平均停留', dataIndex: 'average_time', width: 100, render: (v: number) => `${v}秒` },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 16, fontSize: '1.5rem', fontWeight: 600 }}>广告管理</h1>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'ads',
            label: <><DollarOutlined /> 广告管理</>,
            children: (
              <Card
                title="广告列表"
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditModal({})}>
                    新增广告
                  </Button>
                }
              >
                <Table
                  columns={adColumns}
                  dataSource={ads}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'ab-tests',
            label: <><ExperimentOutlined /> A/B测试</>,
            children: (
              <Card
                title="A/B测试管理"
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setTestModalOpen(true)}>
                    新增测试
                  </Button>
                }
              >
                <Table
                  columns={testColumns}
                  dataSource={tests}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'stats',
            label: <><BarChartOutlined /> 广告统计</>,
            children: (
              <Card title="广告统计数据">
                <Table
                  columns={statColumns}
                  dataSource={stats}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={editRecord?.id ? '编辑广告' : '新增广告'}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.submit()}
        width={800}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label="广告名称"
                rules={[{ required: true, message: '请输入广告名称' }]}
              >
                <Input placeholder="请输入广告名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="position"
                label="广告位置"
                rules={[{ required: true, message: '请选择广告位置' }]}
              >
                <Select placeholder="请选择广告位置">
                  <Option value="splash">启动页</Option>
                  <Option value="banner">横幅</Option>
                  <Option value="reward">激励广告</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="image_url"
                label="图片URL"
                rules={[{ required: true, message: '请输入图片URL' }]}
              >
                <Input placeholder="https://example.com/ad.jpg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="link_url"
                label="链接URL"
                rules={[{ required: true, message: '请输入链接URL' }]}
              >
                <Input placeholder="https://example.com" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="show_frequency"
                label="展示频率"
                rules={[{ required: true, message: '请输入展示频率' }]}
              >
                <InputNumber placeholder="次数/天" min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="skip_time"
                label="跳过时间"
                rules={[{ required: true, message: '请输入跳过时间' }]}
              >
                <InputNumber placeholder="秒" min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="anti_cheat"
                label="防作弊"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="start_date"
                label="开始日期"
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="end_date"
                label="结束日期"
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="ab_test_group"
                label="A/B测试分组"
              >
                <Input placeholder="如：A组、B组" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="is_enabled"
                label="状态"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="show_rule"
            label="展示规则"
          >
            <Input.TextArea placeholder="JSON格式的展示规则" rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增A/B测试"
        open={testModalOpen}
        onCancel={() => setTestModalOpen(false)}
        onOk={() => testForm.submit()}
        width={600}
      >
        <Form form={testForm} layout="vertical" onFinish={handleCreateAbTest}>
          <Form.Item
            name="name"
            label="测试名称"
            rules={[{ required: true, message: '请输入测试名称' }]}
          >
            <Input placeholder="请输入测试名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="测试描述"
          >
            <Input.TextArea placeholder="请输入测试描述" rows={4} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startDate"
                label="开始时间"
                rules={[{ required: true, message: '请选择开始时间' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endDate"
                label="结束时间"
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default AdManagement
