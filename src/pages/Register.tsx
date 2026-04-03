import { useState } from 'react'
import { Form, Input, Button, Card, message, Typography } from 'antd'
import { UserOutlined, LockOutlined, DatabaseOutlined } from '@ant-design/icons'
import { authApi } from '../api'

const { Title, Text } = Typography

export default function Register() {
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { username: string; password: string; nickname: string }) => {
    setLoading(true)
    try {
      const res: any = await authApi.register(values)
      message.success('注册成功，请登录')
      setTimeout(() => window.location.href = '/login', 1500)
    } catch (err: any) {
      message.error(err.error || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      padding: 16,
    }}>
      <Card
        style={{ width: '100%', maxWidth: 400 }}
        styles={{ body: { padding: '40px 32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <DatabaseOutlined style={{ fontSize: 48, color: '#f5576c', marginBottom: 16 }} />
          <Title level={3} style={{ marginBottom: 4 }}>注册账号</Title>
          <Text type="secondary">DataHub 数据库管理系统</Text>
        </div>
        <Form name="register" onFinish={onFinish} size="large" autoComplete="off">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item name="nickname" rules={[{ required: false }]}>
            <Input placeholder="昵称（可选）" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              已有账号？<a href="/login" style={{ marginLeft: 4 }}>去登录</a>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  )
}
