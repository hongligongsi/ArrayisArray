import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, App, message, Popconfirm, Modal, Form, Input, Select, InputNumber, Switch, Upload } from 'antd'
import { DeleteOutlined, EditOutlined, LockOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { authApi } from '../api'
import type { UploadProps } from 'antd'

export default function UserManagement() {
  const { message: appMessage } = App.useApp()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [editForm] = Form.useForm()
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res: any = await authApi.getUsers()
      setUsers(res.users || [])
    } catch (err: any) {
      appMessage.error(err.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await authApi.deleteUser(id)
      appMessage.success('用户已删除')
      loadUsers()
    } catch (err: any) {
      appMessage.error(err.error || '删除失败')
    }
  }

  const handleResetPassword = async (id: number, username: string) => {
    try {
      await authApi.resetPassword(id, { oldPassword: '', newPassword: '' })
      appMessage.success('密码已重置为: user123')
      loadUsers()
    } catch (err: any) {
      appMessage.error(err.error || '重置失败')
    }
  }

  const openEditModal = (record: any) => {
    setEditRecord(record)
    editForm.setFieldsValue({
      username: record.username,
      nickname: record.nickname,
      role: record.role,
      avatar: record.avatar,
      age: record.age,
      status: record.status === 1,
    })
    setAvatarUrl(record.avatar || '')
    setEditModalOpen(true)
  }

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields()
      await authApi.updateUser(editRecord.id, values)
      appMessage.success('用户已更新')
      setEditModalOpen(false)
      loadUsers()
    } catch (err: any) {
      appMessage.error(err.error || '更新失败')
    }
  }

  const handleAvatarChange: UploadProps['onChange'] = (info) => {
    if (info.file.status === 'done') {
      setAvatarUrl(URL.createObjectURL(info.file.originFileObj))
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '昵称', dataIndex: 'nickname', width: 120 },
    { title: '年龄', dataIndex: 'age', width: 80 },
    { title: '头像', dataIndex: 'avatar', width: 100, render: (avatar: string) => avatar ? <img src={avatar} alt="avatar" style={{ width: 40, height: 40, borderRadius: '50%' }} /> : '-' },
    { title: '角色', dataIndex: 'role', width: 100, render: (v: string) => v === 'superadmin' ? <Tag color="gold">超管</Tag> : <Tag color="blue">{v}</Tag> },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: number) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag> },
    { title: '最后登录', dataIndex: 'last_login', width: 170 },
    { title: '创建时间', dataIndex: 'created_at', width: 170 },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>编辑</Button>
          <Popconfirm title="确定删除此用户？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
          <Button size="small" icon={<LockOutlined />} onClick={() => handleResetPassword(record.id, record.username)}>重置密码</Button>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="用户管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditRecord({})}>
          新增用户
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
      />
      <Modal
        title="编辑用户"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleEdit}
        width={600}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input disabled={!!editRecord?.id} />
          </Form.Item>
          <Form.Item name="nickname" label="昵称">
            <Input placeholder="请输入昵称" />
          </Form.Item>
          <Form.Item name="avatar" label="头像">
            <Space direction="vertical" style={{ width: '100%' }}>
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  style={{ width: 80, height: 80, borderRadius: '50%', marginBottom: 8 }}
                />
              )}
              <Upload
                name="avatar"
                listType="picture"
                maxCount={1}
                accept="image/*"
                beforeUpload={() => false}
                onChange={handleAvatarChange}
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />}>上传头像</Button>
              </Upload>
            </Space>
          </Form.Item>
          <Form.Item name="age" label="年龄">
            <InputNumber min={0} max={150} style={{ width: '100%' }} placeholder="请输入年龄" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="请选择角色">
              <Select.Option value="superadmin">超级管理员</Select.Option>
              <Select.Option value="admin">管理员</Select.Option>
              <Select.Option value="user">普通用户</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
