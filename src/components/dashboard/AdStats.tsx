import React from 'react'
import { Row, Col, Card, Statistic } from 'antd'
import { DollarOutlined } from '@ant-design/icons'
import type { Ad } from '../../types'

interface AdStatsProps {
  ads: Ad[]
}

export default function AdStats({ ads }: AdStatsProps) {
  const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressionCount, 0)
  const totalClicks = ads.reduce((sum, ad) => sum + ad.clickCount, 0)
  const clickRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  return (<Row gutter={[16, 16]}><Col xs={12} sm={12} md={6}><Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Statistic title="广告总数" value={ads.length} prefix={<DollarOutlined />} styles={{ content: { color: '#165DFF' } }} /></Card></Col><Col xs={12} sm={12} md={6}><Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Statistic title="广告展示次数" value={totalImpressions} prefix={<DollarOutlined />} styles={{ content: { color: '#0d6efd' } }} /></Card></Col><Col xs={12} sm={12} md={6}><Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Statistic title="广告点击次数" value={totalClicks} prefix={<DollarOutlined />} styles={{ content: { color: '#43e97b' } }} /></Card></Col><Col xs={12} sm={12} md={6}><Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Statistic
            title="点击率"
            value={clickRate}
            suffix="%"
            prefix={<DollarOutlined />}
            styles={{ content: { color: '#FF7D00' } }}
            precision={2}
          /></Card></Col></Row>)
}