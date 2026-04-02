import React from 'react'
import { Row, Col, Card, Statistic } from 'antd'
import { DatabaseOutlined, TableOutlined, FileTextOutlined, WarningOutlined } from '@ant-design/icons'
import type { DashboardStats } from '../../types'

interface StatCardsProps {
  stats: DashboardStats | null
}

export default function StatCards({ stats }: StatCardsProps) {
  return (<Row gutter={[16, 16]}><Col xs={12} sm={12} md={6}><Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Statistic title="数据表" value={stats?.totalTables || 0} prefix={<DatabaseOutlined />} /></Card></Col><Col xs={12} sm={12} md={6}><Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Statistic title="总记录数" value={stats?.totalRecords || 0} prefix={<TableOutlined />} /></Card></Col><Col xs={12} sm={12} md={6}><Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Statistic title="今日操作" value={stats?.recentQueries || 0} prefix={<FileTextOutlined />} styles={{ content: { color: '#165DFF' } }} /></Card></Col><Col xs={12} sm={12} md={6}><Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Statistic title="今日异常" value={0} prefix={<WarningOutlined />} styles={{ content: { color: '#F53F3F' } }} /></Card></Col></Row>)
}