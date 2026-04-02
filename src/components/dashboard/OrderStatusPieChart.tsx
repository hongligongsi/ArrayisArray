import React from 'react'
import { Card, Tag } from 'antd'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { DashboardChartData } from '../../types'

interface OrderStatusPieChartProps {
  chartData: DashboardChartData | null
}

const COLORS = ['#165DFF', '#00B42A', '#FF7D00', '#F53F3F', '#0d6efd', '#43e97b', '#fa709a', '#fee140']

const statusColorMap: Record<string, string>= {
  completed: 'green', 
  shipped: 'blue', 
  pending: 'orange', 
  cancelled: 'red',
}

export default function OrderStatusPieChart({ chartData }: OrderStatusPieChartProps) {
  return (<Card title="订单状态分布" size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><ResponsiveContainer width="100%" height={280}><PieChart><Pie 
            data={chartData?.tableSizes || []} 
            cx="50%" 
            cy="50%" 
            outerRadius={100} 
            dataKey="size" 
            nameKey="table" 
            label={({ name, value }) => `${name}: ${value}`}
          >{(chartData?.tableSizes || []).map((entry: any, i: number) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}</Pie><Tooltip /><Legend formatter={(value: string) => <Tag color={statusColorMap[value] || 'default'}>{value}</Tag>} /></PieChart></ResponsiveContainer></Card>)
}