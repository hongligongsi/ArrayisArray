import React from 'react'
import { Card } from 'antd'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { DashboardChartData } from '../../types'

interface OrderAmountChartProps {
  chartData: DashboardChartData | null
}

export default function OrderAmountChart({ chartData }: OrderAmountChartProps) {
  return (<Card title="订单金额趋势" size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><ResponsiveContainer width="100%" height={300}><AreaChart data={chartData?.dailyQueries || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Legend /><Area type="monotone" dataKey="count" stroke="#165DFF" fill="#165DFF" fillOpacity={0.6} name="查询数" /></AreaChart></ResponsiveContainer></Card>)
}