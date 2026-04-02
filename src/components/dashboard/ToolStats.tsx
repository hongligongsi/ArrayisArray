import React from 'react'
import { Row, Col, Card, Statistic } from 'antd'
import { ToolOutlined } from '@ant-design/icons'
import type { Tool } from '../../types'

interface ToolStatsProps {
  tools: Tool[]
}

export default function ToolStats({ tools }: ToolStatsProps) {
  const totalUsage = tools.reduce((sum, tool) => sum + tool.usageCount, 0)

  return (<Row gutter={[16, 16]}><Col xs={12} sm={12} md={6}><Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Statistic title="工具总数" value={tools.length} prefix={<ToolOutlined />} styles={{ content: { color: '#165DFF' } }} /></Card></Col><Col xs={12} sm={12} md={6}><Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Statistic title="工具使用次数" value={totalUsage} prefix={<ToolOutlined />} styles={{ content: { color: '#0d6efd' } }} /></Card></Col></Row>)
}