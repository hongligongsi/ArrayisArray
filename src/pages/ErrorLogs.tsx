import { useState, useEffect } from 'react'
import { Card, Table, Tag, Space, Button, DatePicker, Input, message, Popconfirm, Modal } from 'antd'
import { ReloadOutlined, DeleteOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons'
import { logApi } from '../api'

const { RangePicker } = DatePicker

export default function ErrorLogs() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [typeFilter, setTypeFilter] = useState('')
  const [dateRange, setDateRange] = useState<any>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailRecord, setDetailRecord] = useState<any>(null)

  const loadData = async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const params: any = { page, pageSize }
      if (typeFilter) params.errorType = typeFilter
      if (dateRange?.[0]) params.startDate = dateRange[0].format('YYYY-MM-DD')
      if (dateRange?.[1]) params.endDate = dateRange[1].format('YYYY-MM-DD')
      const res: any = await logApi.errors(params)
      setData(res.rows || [])
      setPagination({ current: page, pageSize, total: res.total || 0 })
    } catch (err: any) {
      message.error(err.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleClear = async () => {
    try {
      await logApi.clearErrors()
      message.success('异常日志已清空')
      loadData(1, pagination.pageSize)
    } catch (err: any) {
      message.error(err.error || '清空失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '用户', dataIndex: 'username', width: 100 },
    { title: '操作', dataIndex: 'action', width: 100 },
    {
      title: '错误类型', dataIndex: 'error_type', width: 120,
      render: (v: string) => <Tag color="red">{v || 'Error'}</Tag>,
    },
    {
      title: '错误信息', dataIndex: 'error_message', ellipsis: true,
      render: (v: string) => <span style={{ color: '#ff4d4f' }}>{v}</span>,
    },
    { title: '时间', dataIndex: 'created_at', width: 170 },
    {
      title: '操作', width: 60,
      render: (_: unknown, record: any) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => { setDetailRecord(record); setDetailVisible(true) }} />
      ),
    },
  ]

  return (
    <>
      <Card
        title="异常日志"
        extra={
          <Space wrap>
            <Input placeholder="错误类型" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} onPressEnter={() => loadData(1, pagination.pageSize)} allowClear style={{ width: 140 }} />
            <RangePicker onChange={setDateRange} />
            <Button icon={<SearchOutlined />} onClick={() => loadData(1, pagination.pageSize)}>搜索</Button>
            <Button icon={<ReloadOutlined />} onClick={() => loadData(pagination.current, pagination.pageSize)}>刷新</Button>
            <Popconfirm title="确定清空所有异常日志？" onConfirm={handleClear}>
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
          scroll={{ x: 800 }}
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
      <Modal
        title="异常详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {detailRecord && (
          <pre style={{ maxHeight: 400, overflow: 'auto', background: '#f5f5f5', padding: 16, borderRadius: 8, fontSize: 12 }}>
{`错误类型: ${detailRecord.error_type || '-'}
操作: ${detailRecord.action || '-'}
错误信息: ${detailRecord.error_message}
时间: ${detailRecord.created_at}
用户: ${detailRecord.username || '-'}

${detailRecord.stack_trace || '(无堆栈信息)'}`}
          </pre>
        )}
      </Modal>
    </>
  )
}
