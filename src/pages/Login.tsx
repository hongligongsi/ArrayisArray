import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, message, Modal } from 'antd'
import { UserOutlined, LockOutlined, DatabaseOutlined } from '@ant-design/icons'
import { authApi } from '../api'

const { Title, Text } = Typography

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [forgetPasswordModalVisible, setForgetPasswordModalVisible] = useState(false)
  const [forgetPasswordLoading, setForgetPasswordLoading] = useState(false)
  const [forgetPasswordForm] = Form.useForm()
  const navigate = useNavigate()

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const res: any = await authApi.login(values)
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      message.success('登录成功')
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      message.error(err.error || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleForgetPassword = async () => {
    try {
      const values = await forgetPasswordForm.validateFields()
      setForgetPasswordLoading(true)
      // 调用忘记密码API
      await authApi.forgotPassword(values)
      message.success('密码重置链接已发送到您的邮箱，请查收')
      setForgetPasswordModalVisible(false)
      forgetPasswordForm.resetFields()
    } catch (err: any) {
      message.error(err.message || '发送失败，请稍后重试')
    } finally {
      setForgetPasswordLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 16,
    }}>
      <Card
        style={{ width: '100%', maxWidth: 400 }}
        styles={{ body: { padding: '40px 32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <DatabaseOutlined style={{ fontSize: 48, color: '#667eea', marginBottom: 16 }} />
          <Title level={3} style={{ marginBottom: 4 }}>DB Admin</Title>
          <Text type="secondary">数据库管理系统</Text>
        </div>
        <Form name="login" onFinish={onFinish} size="large" autoComplete="off">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Text type="link" onClick={() => setForgetPasswordModalVisible(true)}>
              忘记密码？
            </Text>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            默认账号: admin / admin123
          </Text>
        </div>
    </div>
      </Card >
    <Modal
      title="忘记密码"
      open={forgetPasswordModalVisible}
      onCancel={() => setForgetPasswordModalVisible(false)}
      onOk={handleForgetPassword}
      okText="发送重置链接"
      cancelText="取消"
      confirmLoading={forgetPasswordLoading}
      width={500}
    >
      <Form form={forgetPasswordForm} layout="vertical">
        <Form.Item
          name="email"
          label="邮箱地址"
          rules={[
            { required: true, message: '请输入邮箱地址' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input placeholder="请输入您的邮箱地址" />
        </Form.Item>
        <div style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
          我们将发送密码重置链接到您的邮箱，请查收并按照提示操作。
        </div>
      </Form>
    </Modal>
    </div >
  )
}
