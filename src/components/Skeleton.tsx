import { Skeleton, Card, Space, Row, Col } from 'antd'

interface SkeletonProps {
  type?: 'table' | 'form' | 'card' | 'dashboard'
  loading?: boolean
  children?: React.ReactNode
}

export default function AppSkeleton({ type = 'card', loading = true, children }: SkeletonProps) {
  if (!loading) return <>{children}</>

  switch (type) {
    case 'table':
      return (
        <Card>
          <Skeleton
            active
            paragraph={{ rows: 10 }}
            title
          />
        </Card>
      )
    
    case 'form':
      return (
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            {[...Array(5)].map((_, index) => (
              <Skeleton.Input key={index} active style={{ width: index % 2 === 0 ? '100%' : '70%' }} />
            ))}
            <Skeleton.Button active style={{ width: 120 }} />
          </Space>
        </Card>
      )
    
    case 'dashboard':
      return (
        <Row gutter={[16, 16]}>
          {[...Array(4)].map((_, index) => (
            <Col key={index} span={6}>
              <Card>
                <Skeleton active paragraph={{ rows: 3 }} title />
              </Card>
            </Col>
          ))}
          <Col span={24}>
            <Card>
              <Skeleton active paragraph={{ rows: 8 }} title />
            </Card>
          </Col>
        </Row>
      )
    
    case 'card':
    default:
      return (
        <Card>
          <Skeleton
            active
            paragraph={{ rows: 6 }}
            title
          />
        </Card>
      )
  }
}
