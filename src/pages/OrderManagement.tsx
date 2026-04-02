import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, App, message, Modal, Form, Select, Input, DatePicker, Descriptions, Timeline } from 'antd'
import { EyeOutlined, EditOutlined } from '@ant-design/icons'
import { orderApi } from '../api'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

export default function OrderManagement() {
  const { message: appMessage } = App.useApp()
  const [orders, setOrders] = useState<any[]>([])
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [statusLogs, setStatusLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<any>({ status: '', user_id: '', start_date: '', end_date: '' })
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<any>(null)
  const [statusForm] = Form.useForm()

  useEffect(() => {
    loadOrders()
  }, [page, pageSize, filters])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const res: any = await orderApi.getOrders({ page, pageSize, ...filters })
      setOrders(res.rows)
      setTotal(res.total)
    } catch (err: any) {
      message.error(err.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (values: any) => {
    try {
      await orderApi.updateStatus(currentOrder.id, values)
      message.success('状态更新成功')
      setStatusModalOpen(false)
      statusForm.resetFields()
      loadOrders()
      if (detailModalOpen) {
        loadOrderDetail(currentOrder.id)
      }
    } catch (err: any) {
      message.error(err.error || '更新失败')
    }
  }

  const openDetailModal = async (order: any) => {
    try {
      const [orderRes, itemsRes, logsRes] = await Promise.all([
        orderApi.getOrder(order.id),
        orderApi.getOrderItems(order.id),
        orderApi.getStatusLogs(order.id),
      ])
      setCurrentOrder(orderRes.order)
      setOrderItems(itemsRes.items)
      setStatusLogs(logsRes.logs)
      setDetailModalOpen(true)
    } catch (err: any) {
      message.error(err.error || '加载失败')
    }
  }

  const openStatusModal = (order: any) => {
    setCurrentOrder(order)
    statusForm.setFieldsValue({ status: order.status, remark: '' })
    setStatusModalOpen(true)
  }

  const loadOrderDetail = async (id: number) => {
    try {
      const [itemsRes, logsRes] = await Promise.all([
        orderApi.getOrderItems(id),
        orderApi.getStatusLogs(id),
      ])
      setOrderItems(itemsRes.items)
      setStatusLogs(logsRes.logs)
    } catch (err: any) {
      message.error(err.error || '加载失败')
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'processing',
    paid: 'blue',
    shipped: 'cyan',
    completed: 'success',
    cancelled: 'error',
  }

  const statusLabels: Record<string, string> = {
    pending: '待处理',
    paid: '已支付',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消',
  }

  const orderColumns = [
    { title: 'ID', dataIndex: 'id', width: 80, key: 'id' },
    { title: '用户', dataIndex: 'user_name', width: 120, key: 'user_name' },
    { title: '商品', dataIndex: 'product_name', width: 200, key: 'product_name', ellipsis: true },
    { title: '数量', dataIndex: 'quantity', width: 80, key: 'quantity' },
    { title: '总价', dataIndex: 'total_price', width: 100, key: 'total_price', render: (price: any) => `¥${Number(price || 0).toFixed(2)}` },
    { title: '状态', dataIndex: 'status', width: 100, key: 'status', render: (status: string) => <Tag color={statusColors[status]}>{statusLabels[status]}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', width: 160, key: 'created_at' },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetailModal(record)}>查看</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openStatusModal(record)}>更新状态</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select placeholder="状态" style={{ width: 120 }} allowClear onChange={(value) => setFilters({ ...filters, status: value })}>
            <Select.Option value="pending">待处理</Select.Option>
            <Select.Option value="paid">已支付</Select.Option>
            <Select.Option value="shipped">已发货</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
            <Select.Option value="cancelled">已取消</Select.Option>
          </Select>
          <Input.Search placeholder="搜索用户ID" style={{ width: 150 }} onSearch={(value) => setFilters({ ...filters, user_id: value })} />
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            style={{ width: 260 }}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setFilters({
                  ...filters,
                  start_date: dates[0].format('YYYY-MM-DD'),
                  end_date: dates[1].format('YYYY-MM-DD'),
                })
              } else {
                setFilters({ ...filters, start_date: '', end_date: '' })
              }
            }}
          />
        </Space>
        <Table
          columns={orderColumns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1100 }}
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
        title="订单详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>,
        ]}
        width={800}
      >
        {currentOrder && (
          <div>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="订单ID">{currentOrder.id}</Descriptions.Item>
              <Descriptions.Item label="用户">{currentOrder.user_name}</Descriptions.Item>
              <Descriptions.Item label="商品">{currentOrder.product_name}</Descriptions.Item>
              <Descriptions.Item label="数量">{currentOrder.quantity}</Descriptions.Item>
              <Descriptions.Item label="总价">¥{Number(currentOrder.total_price || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[currentOrder.status]}>{statusLabels[currentOrder.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>{currentOrder.created_at}</Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: 16 }}>
              <h4>订单商品</h4>
              <Table
                columns={[
                  { title: '商品名称', dataIndex: 'product_name', key: 'product_name' },
                  { title: '数量', dataIndex: 'quantity', width: 80, key: 'quantity' },
                  { title: '单价', dataIndex: 'price', width: 100, key: 'price', render: (price: any) => `¥${Number(price || 0).toFixed(2)}` },
                  { title: '小计', dataIndex: 'total_price', width: 100, key: 'total_price', render: (price: any) => `¥${Number(price || 0).toFixed(2)}` },
                ]}
                dataSource={orderItems}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </div>

            <div>
              <h4>状态变更记录</h4>
              <Timeline
                items={statusLogs.map((log) => ({
                  color: log.status_after === 'completed' ? 'green' : log.status_after === 'cancelled' ? 'red' : 'blue',
                  children: (
                    <div>
                      <div>
                        <strong>{statusLabels[log.status_after] || log.status_after}</strong>
                        <span style={{ marginLeft: 8, color: '#8c8c8c' }}>{log.created_at}</span>
                      </div>
                      {log.operator_name && <div style={{ color: '#8c8c8c' }}>操作人：{log.operator_name}</div>}
                      {log.remark && <div style={{ color: '#8c8c8c' }}>备注：{log.remark}</div>}
                    </div>
                  ),
                }))}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="更新订单状态"
        open={statusModalOpen}
        onCancel={() => setStatusModalOpen(false)}
        onOk={() => statusForm.validateFields().then(handleUpdateStatus)}
      >
        <Form form={statusForm} layout="vertical">
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select placeholder="选择状态">
              <Select.Option value="pending">待处理</Select.Option>
              <Select.Option value="paid">已支付</Select.Option>
              <Select.Option value="shipped">已发货</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="cancelled">已取消</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={4} placeholder="请输入备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
