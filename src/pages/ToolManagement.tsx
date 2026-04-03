import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, App, message, Popconfirm, Modal, Form, Input, Switch, InputNumber, Tabs, Descriptions } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined, EyeOutlined } from '@ant-design/icons'
import { toolApi } from '../api'

export default function ToolManagement() {
  const { message: appMessage } = App.useApp()
  const [tools, setTools] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [selectedTool, setSelectedTool] = useState<any>(null)
  const [configs, setConfigs] = useState<any[]>([])
  const [editForm] = Form.useForm()
  const [configForm] = Form.useForm()

  useEffect(() => {
    loadTools()
  }, [])

  const loadTools = async () => {
    setLoading(true)
    try {
      const res: any = await toolApi.getTools()
      setTools(Array.isArray(res?.tools) ? res.tools : [])
    } catch (err: any) {
      appMessage.error(err.error || '加载工具失败')
      setTools([])
    } finally {
      setLoading(false)
    }
  }

  const loadConfigs = async (toolId: number) => {
    try {
      const res: any = await toolApi.getToolConfigs(toolId)
      setConfigs(Array.isArray(res?.configs) ? res.configs : [])
    } catch (err: any) {
      appMessage.error(err.error || '加载配置失败')
      setConfigs([])
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await toolApi.deleteTool(id)
      appMessage.success('删除成功')
      loadTools()
    } catch (err: any) {
      appMessage.error(err.error || '删除失败')
    }
  }

  const openEditModal = (record: any) => {
    setEditRecord(record)
    editForm.setFieldsValue(record)
    setEditModalOpen(true)
  }

  const openConfigModal = (record: any) => {
    setSelectedTool(record)
    loadConfigs(record.id)
    setConfigModalOpen(true)
  }

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields()
      if (editRecord.id) {
        await toolApi.updateTool(editRecord.id, values)
        appMessage.success('更新成功')
      } else {
        await toolApi.createTool(values)
        appMessage.success('创建成功')
      }
      setEditModalOpen(false)
      loadTools()
    } catch (err: any) {
      appMessage.error(err.error || '操作失败')
    }
  }

  const handleConfigUpdate = async (configKey: string, value: any) => {
    try {
      await toolApi.updateToolConfig(selectedTool.id, configKey, { config_value: value })
      appMessage.success('配置更新成功')
      loadConfigs(selectedTool.id)
    } catch (err: any) {
      appMessage.error(err.error || '配置更新失败')
    }
  }

  const handleAddConfig = async () => {
    try {
      const values = await configForm.validateFields()
      await toolApi.createToolConfig(selectedTool.id, values)
      appMessage.success('?????')
      configForm.resetFields()
      loadConfigs(selectedTool.id)
    } catch (err: any) {
      appMessage.error(err.error || '????')
    }
  }

  const handleDeleteConfig = async (configKey: string) => {
    try {
      await toolApi.deleteToolConfig(selectedTool.id, configKey)
      appMessage.success('?????')
      loadConfigs(selectedTool.id)
    } catch (err: any) {
      appMessage.error(err.error || '????')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '??', dataIndex: 'name', width: 150 },
    { title: '??', dataIndex: 'description', width: 200, ellipsis: true },
    { title: '??', dataIndex: 'icon', width: 80 },
    { title: '??', dataIndex: 'sort_order', width: 80 },
    { title: '????', dataIndex: 'usage_count', width: 100 },
    {
      title: '??',
      dataIndex: 'is_enabled',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '??' : '??'}</Tag>,
    },
    {
      title: '??',
      key: 'action',
      width: 200,
      render: (_: unknown, record: any) => (
        <Space>
          <Button size="small" icon={<SettingOutlined />} onClick={() => openConfigModal(record)}>??</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>??</Button>
          <Popconfirm title="????????" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>??</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const configColumns = [
    { title: '???', dataIndex: 'config_key', width: 150 },
    { title: '???', dataIndex: 'config_value', width: 200, ellipsis: true },
    { title: '??', dataIndex: 'config_type', width: 100 },
    { title: '??', dataIndex: 'description', width: 200, ellipsis: true },
    {
      title: '??',
      key: 'action',
      width: 100,
      render: (_: unknown, record: any) => (
        <Popconfirm title="????????" onConfirm={() => handleDeleteConfig(record.config_key)}>
          <Button size="small" danger icon={<DeleteOutlined />}>??</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <Card
      title="????"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditModal({})}>
          ????
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={tools}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
      />
      <Modal
        title={editRecord?.id ? '????' : '????'}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleEdit}
        width={600}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="??" rules={[{ required: true, message: '?????' }]}>
            <Input placeholder="??PDF???" />
          </Form.Item>
          <Form.Item name="description" label="??">
            <Input.TextArea rows={3} placeholder="????" />
          </Form.Item>
          <Form.Item name="icon" label="??">
            <Input placeholder="??file-pdf" />
          </Form.Item>
          <Form.Item name="sort_order" label="??" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_enabled" label="??" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`???? - ${selectedTool?.name}`}
        open={configModalOpen}
        onCancel={() => setConfigModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setConfigModalOpen(false)}>??</Button>,
        ]}
        width={900}
      >
        <Tabs
          defaultActiveKey="list"
          items={[
            {
              key: 'list',
              label: '????',
              children: (
                <Table
                  columns={configColumns}
                  dataSource={configs}
                  rowKey="config_key"
                  size="small"
                  pagination={false}
                />
              ),
            },
            {
              key: 'add',
              label: '????',
              children: (
                <Form form={configForm} layout="vertical" style={{ marginTop: 16 }}>
                  <Form.Item name="config_key" label="???" rules={[{ required: true }]}>
                    <Input placeholder="??daily_limit" />
                  </Form.Item>
                  <Form.Item name="config_value" label="???" rules={[{ required: true }]}>
                    <Input placeholder="???" />
                  </Form.Item>
                  <Form.Item name="config_type" label="??" initialValue="string">
                    <Input.TextArea rows={1} placeholder="string / number / boolean / json" />
                  </Form.Item>
                  <Form.Item name="description" label="??">
                    <Input.TextArea rows={2} placeholder="????" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" onClick={handleAddConfig}>????</Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Modal>
    </Card>
  )
}
