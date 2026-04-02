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
import type { DashboardStats, DashboardChartData, Tool, MembershipPlan, Ad } from '../types'

const COLORS = ['#165DFF', '#00B42A', '#FF7D00', '#F53F3F', '#0d6efd', '#43e97b', '#fa709a', '#fee140']

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartData, setChartData] = useState<DashboardChartData | null>(null)
  const [tools, setTools] = useState<Tool[]>([])
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, c, tRes, pRes, aRes] = await Promise.all([
        dashboardApi.stats(),
        dashboardApi.chartData(),
        toolApi.getTools(),
        membershipApi.getPlans(),
        adApi.getAds(),
      ])
      setStats(s || {} as DashboardStats)
      setChartData(c || {} as DashboardChartData)
      setTools(Array.isArray(tRes?.tools) ? tRes.tools : [])
      setPlans(Array.isArray(pRes?.plans) ? pRes.plans : [])
      setAds(Array.isArray(aRes?.ads) ? aRes.ads : [])
    } catch (err) {
      console.error('加载数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <AppSkeleton type="dashboard" loading={loading} />

  return (<div style={{ padding: '0 8px' }}><StatCards stats={stats} /><div style={{ marginTop: 24 }}><ToolStats tools={tools} /></div><div style={{ marginTop: 24 }}><MembershipStats plans={plans} /></div><div style={{ marginTop: 24 }}><AdStats ads={ads} /></div><Row gutter={[16, 16]} style={{ marginTop: 24 }}><Col xs={24} lg={12}><CategoryPieChart chartData={chartData} /></Col><Col xs={24} lg={12}><OrderStatusPieChart chartData={chartData} /></Col></Row><Row gutter={[16, 16]} style={{ marginTop: 24 }}><Col xs={24} lg={14}><TopProductsChart chartData={chartData} /></Col><Col xs={24} lg={10}><TableOverview stats={stats} /></Col></Row><Row gutter={[16, 16]} style={{ marginTop: 24 }}><Col xs={24} lg={12}><DailyOrdersChart chartData={chartData} /></Col><Col xs={24} lg={12}><OrderAmountChart chartData={chartData} /></Col></Row></div>
  )
}
