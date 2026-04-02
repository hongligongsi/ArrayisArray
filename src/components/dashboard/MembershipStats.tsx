import React from 'react'
import { Row, Col, Card, Statistic } from 'antd'
import { CrownOutlined } from '@ant-design/icons'
import type { MembershipPlan } from '../../types'

interface MembershipStatsProps {
  plans: MembershipPlan[]
}

export default function MembershipStats({ plans }: MembershipStatsProps) {
  return (<Row gutter={[16, 16]}><Col xs={12} sm={12} md={6}><Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Statistic title="会员套餐" value={plans.length} prefix={<CrownOutlined />} styles={{ content: { color: '#165DFF' } }} /></Card></Col><Col xs={12} sm={12} md={6}><Card hoverable style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Statistic title="活跃会员" value={0} prefix={<CrownOutlined />} styles={{ content: { color: '#00B42A' } }} /></Card></Col></Row>)
}