import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, message, Modal, Form, Input, Checkbox, Popconfirm, Tabs, Tag, Row, Col, Statistic } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons'
import { permissionApi } from '../api'

const { TabPane } = Tabs

export default function PermissionManagement() {
  const [roles, setRoles] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])
  const [rolePermissions, setRolePermissions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [permissionModalOpen, setPermissionModalOpen] = useState(false)
  const [currentRole, setCurrentRole] = useState<any>(null)
  const [roleForm] = Form.useForm()
  const [activeTab, setActiveTab] = useState('roles')

  useEffect(() => {
    loadRoles()
    loadPermissions()
  }, [])

  const loadRoles = async () => {
    setLoading(true)
    try {
      const res: any = await permissionApi.getRoles()
      setRoles(res.roles)
    } catch (err: any) {
      message.error(err.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadPermissions = async () => {
    try {
      const res: any = await permissionApi.getPermissions()
      setPermissions(res.permissions)
    } catch (err: any) {
      message.error(err.error || '加载失败')
    }
  }

  const loadRolePermissions = async (roleId: number) => {
    try {
      const res: any = await permissionApi.getRolePermissions(roleId)
      setRolePermissions(res.permissions)
    } catch (err: any) {
      message.error(err.error || '加载失败')
    }
  }

  const handleCreateRole = async (values: any) => {
    try {
      await permissionApi.createRole(values)
      message.success('创建成功')
      setRoleModalOpen(false)
      roleForm.resetFields()
      loadRoles()
    } catch (err: any) {
      message.error(err.error || '创建失败')
    }
  }

  const handleUpdateRole = async (values: any) => {
    try {
      await permissionApi.updateRole(currentRole.id, values)
      message.success('更新成功')
      setRoleModalOpen(false)
      roleForm.resetFields()
      loadRoles()
    } catch (err: any) {
      message.error(err.error || '更新失败')
    }
  }

  const handleDeleteRole = async (id: number) => {
    try {
      await permissionApi.deleteRole(id)
      message.success('删除成功')
      loadRoles()
    } catch (err: any) {
      message.error(err.error || '删除失败')
    }
  }

  const handleAssignPermission = async (permissionId: number) => {
    try {
      await permissionApi.assignPermission(currentRole.id, { permission_id: permissionId })
      message.success('分配成功')
      loadRolePermissions(currentRole.id)
    } catch (err: any) {
      message.error(err.error || '分配失败')
    }
  }

  const handleRemovePermission = async (permissionId: number) => {
    try {
      await permissionApi.removePermission(currentRole.id, permissionId)
      message.success('移除成功')
      loadRolePermissions(currentRole.id)
    } catch (err: any) {
      message.error(err.error || '移除失败')
    }
  }

  const openRoleModal = (role?: any) => {
    if (role) {
      setCurrentRole(role)
      roleForm.setFieldsValue({ name: role.name, description: role.description })
    } else {
      setCurrentRole(null)
      roleForm.resetFields()
    }
    setRoleModalOpen(true)
  }

  const openPermissionModal = (role: any) => {
    setCurrentRole(role)
    loadRolePermissions(role.id)
    setPermissionModalOpen(true)
  }

  const roleColumns = [
    { title: 'ID', dataIndex: 'id', width: 80, key: 'id' },
    { title: '角色名称', dataIndex: 'name', width: 150, key: 'name' },
    { title: '描述', dataIndex: 'description', width: 250, key: 'description', ellipsis: true },
    { title: '用户数', dataIndex: 'user_count', width: 100, key: 'user_count' },
    { title: '创建时间', dataIndex: 'created_at', width: 160, key: 'created_at' },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<SafetyOutlined />} onClick={() => openPermissionModal(record)}>权限配置</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openRoleModal(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteRole(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const permissionColumns = [
    { title: 'ID', dataIndex: 'id', width: 80, key: 'id' },
    { title: '权限名称', dataIndex: 'name', width: 200, key: 'name' },
    { title: '权限代码', dataIndex: 'code', width: 200, key: 'code' },
    { title: '模块', dataIndex: 'module', width: 100, key: 'module', render: (module: string) => <Tag>{module}</Tag> },
    { title: '描述', dataIndex: 'description', width: 250, key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: any) => {
        const hasPermission = record.role_permission_id !== null
        return hasPermission ? (
          <Button type="link" size="small" danger onClick={() => handleRemovePermission(record.id)}>移除</Button>
        ) : (
          <Button type="link" size="small" onClick={() => handleAssignPermission(record.id)}>分配</Button>
        )
      },
    },
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="角色总数" value={roles.length} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="权限总数" value={permissions.length} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="权限分配" value={rolePermissions.filter((p) => p.role_permission_id !== null).length} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="角色管理" key="roles">
            <Space style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openRoleModal()}>新建角色</Button>
            </Space>
            <Table
              columns={roleColumns}
              dataSource={roles}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1100 }}
              pagination={false}
            />
          </TabPane>

          <TabPane tab="权限列表" key="permissions">
            <Table
              columns={[
                { title: 'ID', dataIndex: 'id', width: 80 },
                { title: '权限名称', dataIndex: 'name', width: 200 },
                { title: '权限代码', dataIndex: 'code', width: 200 },
                { title: '模块', dataIndex: 'module', width: 100, render: (module: string) => <Tag>{module}</Tag> },
                { title: '描述', dataIndex: 'description', width: 300, ellipsis: true },
              ]}
              dataSource={permissions}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1000 }}
              pagination={false}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={currentRole ? '编辑角色' : '新建角色'}
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        onOk={() => roleForm.validateFields().then(currentRole ? handleUpdateRole : handleCreateRole)}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item name="description" label="角色描述">
            <Input.TextArea rows={4} placeholder="请输入角色描述" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`权限配置 - ${currentRole?.name}`}
        open={permissionModalOpen}
        onCancel={() => setPermissionModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setPermissionModalOpen(false)}>关闭</Button>,
        ]}
        width={1000}
      >
        <Table
          columns={permissionColumns}
          dataSource={permissions}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={false}
        />
      </Modal>
    </div>
  )
}
