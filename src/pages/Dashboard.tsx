import { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Spin } from 'antd'
import {
  DatabaseOutlined,
  TableOutlined,
  FileTextOutlined,
  WarningOutlined,
  ToolOutlined,
  CrownOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Area, AreaChart } from 'recharts'
import { dashboardApi, toolApi, membershipApi, adApi } from '../api'
import AppSkeleton from '../components/Skeleton'

const COLORS = ['#165DFF', '#00B42A', '#FF7D00', '#F53F3F', '#0d6efd', '#43e97b', '#fa709a', '#fee140']

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null)
  const [chartData, setChartData] = useState<any>(null)
  const [tools, setTools] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [ads, setAds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, c, tRes, pRes, aRes]: any = await Promise.all([
        dashboardApi.stats(),
        dashboardApi.chartData(),
        toolApi.getTools(),
        membershipApi.getPlans(),
        adApi.getAds(),
      ])
      setStats(s)
      setChartData(c)
      setTools(tRes.tools || [])
      setPlans(pRes.plans || [])
      setAds(aRes.ads || [])
    } catch (err) {
      console.error('加载数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <AppSkeleton type="dashboard" loading={loading} />

  const statusColorMap: Record<string, string> = {
    completed: 'green', shipped: 'blue', pending: 'orange', cancelled: 'red',
  }

  const tableColumns = [
    { title: '表名', dataIndex: 'tableName', key: 'tableName' },
    { title: '行数', dataIndex: 'rowCount', key: 'rowCount', render: (v: number) => v?.toLocaleString() },
  ]

  return (
    <div style={{ padding: '0 8px' }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic title="数据表" value={stats?.totalTables || 0} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic title="总记录数" value={stats?.totalRows || 0} prefix={<TableOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic title="今日操作" value={stats?.operationLogsToday || 0} prefix={<FileTextOutlined />} styles={{ content: { color: '#165DFF' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic title="今日异常" value={stats?.errorLogsToday || 0} prefix={<WarningOutlined />} styles={{ content: { color: stats?.errorLogsToday > 0 ? '#F53F3F' : '#00B42A' } }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic title="工具总数" value={tools.length} prefix={<ToolOutlined />} styles={{ content: { color: '#165DFF' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic title="工具使用次数" value={tools.reduce((sum: number, t: any) => sum + (t.usage_count || 0), 0)} prefix={<ToolOutlined />} styles={{ content: { color: '#0d6efd' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic title="会员套餐" value={plans.length} prefix={<CrownOutlined />} styles={{ content: { color: '#165DFF' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic title="活跃会员" value={plans.reduce((sum: number, p: any) => sum + (p.active_users || 0), 0)} prefix={<CrownOutlined />} styles={{ content: { color: '#00B42A' } }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic title="广告总数" value={ads.length} prefix={<DollarOutlined />} styles={{ content: { color: '#165DFF' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic title="广告展示次数" value={ads.reduce((sum: number, a: any) => sum + (a.impression_count || 0), 0)} prefix={<DollarOutlined />} styles={{ content: { color: '#0d6efd' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic title="广告点击次数" value={ads.reduce((sum: number, a: any) => sum + (a.click_count || 0), 0)} prefix={<DollarOutlined />} styles={{ content: { color: '#43e97b' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="点击率"
              value={ads.reduce((sum: number, a: any) => sum + (a.click_count || 0), 0) / (ads.reduce((sum: number, a: any) => sum + (a.impression_count || 0), 0) || 1) * 100}
              suffix="%"
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#FF7D00' }}
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="商品分类分布" size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={chartData?.categoryData || []} cx="50%" cy="50%" outerRadius={100} dataKey="count" nameKey="category" label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                  {(chartData?.categoryData || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="订单状态分布" size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={chartData?.orderStatusData || []} cx="50%" cy="50%" outerRadius={100} dataKey="count" nameKey="status" label={({ name, value }) => `${name}: ${value}`}>
                  {(chartData?.orderStatusData || []).map((entry: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend formatter={(value: string) => <Tag color={statusColorMap[value]}>{value}</Tag>} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={14}>
          <Card title="热销商品 TOP 5" size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData?.topProducts || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`¥${value?.toLocaleString()}`, '销售额']} />
                <Bar dataKey="totalRevenue" fill="#165DFF" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="数据表概览" size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Table
              columns={tableColumns}
              dataSource={stats?.tableList || []}
              rowKey="tableName"
              size="small"
              pagination={false}
              scroll={{ y: 260 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="每日订单趋势" size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData?.dailyOrders || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#165DFF" strokeWidth={2} name="订单数" />
                <Line type="monotone" dataKey="total" stroke="#00B42A" strokeWidth={2} name="总金额" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="订单金额趋势" size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData?.dailyOrders || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => `¥${value?.toLocaleString()}`} />
                <Legend />
                <Area type="monotone" dataKey="total" stroke="#165DFF" fill="#165DFF" fillOpacity={0.6} name="订单金额" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
