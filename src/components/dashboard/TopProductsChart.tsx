import React from 'react'
import { Card } from 'antd'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { DashboardChartData } from '../../types'

interface TopProductsChartProps {
  chartData: DashboardChartData | null
}

export default function TopProductsChart({ chartData }: TopProductsChartProps) {
  return (<Card title="热销商品 TOP 5" size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><ResponsiveContainer width="100%" height={300}><BarChart data={chartData?.userActivity || []} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="user" type="category" width={120} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) =>[`${value}`, '操作数']} /><Bar dataKey="actions" fill="#165DFF" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></Card>)
}