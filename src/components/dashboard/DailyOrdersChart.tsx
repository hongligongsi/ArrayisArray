import React from 'react'
import { Card } from 'antd'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { DashboardChartData } from '../../types'

interface DailyOrdersChartProps {
  chartData: DashboardChartData | null
}

export default function DailyOrdersChart({ chartData }: DailyOrdersChartProps) {
  return (<Card title="每日订单趋势" size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><ResponsiveContainer width="100%" height={300}><LineChart data={chartData?.dailyQueries || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="count" stroke="#165DFF" strokeWidth={2} name="查询数" /></LineChart></ResponsiveContainer></Card>)
}