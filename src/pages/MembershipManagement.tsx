import React, { useState, useEffect } from 'react'
import { Card, Tabs, Button, Table, Form, Input, InputNumber, Switch, Select, DatePicker, message, Space, Tag, Modal, Alert, Statistic, Row, Col } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, GiftOutlined, LineChartOutlined, ShopOutlined } from '@ant-design/icons'
import { membershipApi } from '../api'
import dayjs from 'dayjs'

const { Option } = Select
const { RangePicker } = DatePicker

const MembershipPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('plans')
  const [loading, setLoading] = useState(false)
  const [plans, setPlans] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [discounts, setDiscounts] = useState<any[]>([])
  const [usage, setUsage] = useState<any[]>([])
  const [form] = Form.useForm()
  const [modalVisible, setModalVisible] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<any>(null)

  useEffect(() => {
    if (activeTab === 'plans') {
      loadPlans()
    } else if (activeTab === 'users') {
      loadUsers()
    } else if (activeTab === 'discounts') {
      loadDiscounts()
    } else if (activeTab === 'usage') {
      loadUsage()
    }
  }, [activeTab])

  const loadPlans = async () => {
    setLoading(true)
    try {
      const response = await membershipApi.getPlans()
      setPlans(response.plans || [])
    } catch (error) {
      message.error('加载套餐失败')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      // 这里应该调用用户列表API，暂时使用模拟数据
      setUsers([
        { id: 1, username: 'zhangsan', email: 'zhangsan@example.com', status: 1 },
        { id: 2, username: 'lisi', email: 'lisi@example.com', status: 1 },
        { id: 3, username: 'wangwu', email: 'wangwu@example.com', status: 1 },
      ])
    } catch (error) {
      message.error('加载用户失败')
    } finally {
      setLoading(false)
    }
  }

  const loadDiscounts = async () => {
    setLoading(true)
    try {
      const response = await membershipApi.getDiscounts()
      setDiscounts(response.discounts || [])
    } catch (error) {
      message.error('加载折扣规则失败')
    } finally {
      setLoading(false)
    }
  }

  const loadUsage = async () => {
    setLoading(true)
    try {
      const response = await membershipApi.getUsage({})
      setUsage(response.usage || [])
    } catch (error) {
      message.error('加载使用统计失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddPlan = () => {
    setCurrentPlan(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEditPlan = (plan: any) => {
    setCurrentPlan(plan)
    form.setFieldsValue(plan)
    setModalVisible(true)
  }

  const handleDeletePlan = async (id: number) => {
    try {
      await membershipApi.deletePlan(id)
      message.success('删除成功')
      loadPlans()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      if (currentPlan) {
        await membershipApi.updatePlan(currentPlan.id, values)
        message.success('更新成功')
      } else {
        await membershipApi.createPlan(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      loadPlans()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handlePurchaseMembership = async (userId: number, planId: number) => {
    try {
      await membershipApi.purchaseMembership({ userId, planId, autoRenew: true })
      message.success('购买成功')
    } catch (error) {
      message.error('购买失败')
    }
  }

  const planColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price: any) => `¥${typeof price === 'number' ? price.toFixed(2) : '0.00'}`,
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration: number) => `${duration}天`,
    },
    {
      title: '权益',
      dataIndex: 'benefits',
      key: 'benefits',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'red'}>
          {enabled ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditPlan(record)}>
            编辑
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeletePlan(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => (
        <Tag color={status ? 'green' : 'red'}>
          {status ? '活跃' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '会员状态',
      key: 'membership',
      render: (_, record: any) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handlePurchaseMembership(record.id, 2)}
        >
          购买会员
        </Button>
      ),
    },
  ]

  const discountColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        switch (type) {
          case 'percentage': return '百分比折扣'
          case 'fixed': return '固定金额折扣'
          default: return type
        }
      },
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      render: (value: number, record: any) => {
        return record.type === 'percentage' ? `${value}%` : `¥${value.toFixed(2)}`
      },
    },
    {
      title: '开始日期',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
  ]

  const usageColumns = [
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
    },
    {
      title: '资源',
      dataIndex: 'resource',
      key: 'resource',
    },
    {
      title: '使用次数',
      dataIndex: 'count',
      key: 'count',
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 16, fontSize: '1.5rem', fontWeight: 600 }}>会员管理</h1>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'plans',
            label: <><ShopOutlined /> 套餐管理</>,
            children: (
              <Card
                title="会员套餐"
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPlan}>
                    添加套餐
                  </Button>
                }
              >
                <Table
                  columns={planColumns}
                  dataSource={plans}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'users',
            label: <><UserOutlined /> 用户会员</>,
            children: (
              <Card title="用户会员管理">
                <Table
                  columns={userColumns}
                  dataSource={users}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'discounts',
            label: <><GiftOutlined /> 折扣规则</>,
            children: (
              <Card
                title="折扣规则"
                extra={
                  <Button type="primary" icon={<PlusOutlined />}>
                    添加折扣
                  </Button>
                }
              >
                <Table
                  columns={discountColumns}
                  dataSource={discounts}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'usage',
            label: <><LineChartOutlined /> 使用统计</>,
            children: (
              <Card title="会员使用统计">
                <Table
                  columns={usageColumns}
                  dataSource={usage}
                  rowKey="action"
                  loading={loading}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={currentPlan ? '编辑套餐' : '添加套餐'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="套餐名称"
            rules={[{ required: true, message: '请输入套餐名称' }]}
          >
            <Input placeholder="请输入套餐名称" />
          </Form.Item>
          <Form.Item
            name="price"
            label="价格"
            rules={[{ required: true, message: '请输入价格' }]}
          >
            <InputNumber placeholder="请输入价格" prefix="¥" precision={2} />
          </Form.Item>
          <Form.Item
            name="duration"
            label="时长（天）"
            rules={[{ required: true, message: '请输入时长' }]}
          >
            <InputNumber placeholder="请输入时长" min={1} />
          </Form.Item>
          <Form.Item
            name="benefits"
            label="权益"
            rules={[{ required: true, message: '请输入权益' }]}
          >
            <Input.TextArea placeholder="请输入权益描述" rows={4} />
          </Form.Item>
          <Form.Item
            name="is_enabled"
            label="状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item
            name="sort_order"
            label="排序"
          >
            <InputNumber placeholder="请输入排序值" min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default MembershipPage
