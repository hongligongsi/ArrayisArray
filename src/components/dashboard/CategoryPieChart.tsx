import React from 'react'
import { Card } from 'antd'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { DashboardChartData } from '../../types'

interface CategoryPieChartProps {
  chartData: DashboardChartData | null
}

const COLORS = ['#165DFF', '#00B42A', '#FF7D00', '#F53F3F', '#0d6efd', '#43e97b', '#fa709a', '#fee140']

export default function CategoryPieChart({ chartData }: CategoryPieChartProps) {
  return (<Card title="商品分类分布" size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><ResponsiveContainer width="100%" height={280}><PieChart><Pie 
            data={chartData?.dailyQueries || []} 
            cx="50%" 
            cy="50%" 
            outerRadius={100} 
            dataKey="count" 
            nameKey="date" 
            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
          >{(chartData?.dailyQueries || []).map((_: any, i: number) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></Card>)
}