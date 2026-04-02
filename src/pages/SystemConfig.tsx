import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, message, Popconfirm, Modal, Form, Input, InputNumber, Switch, Select, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { systemConfigApi } from '../api'

export default function SystemConfig() {
  const [configs, setConfigs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [editForm] = Form.useForm()

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    setLoading(true)
    try {
      const res: any = await systemConfigApi.getConfigs()
      setConfigs(res.configs || [])
    } catch (err: any) {
      message.error(err.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (configKey: string) => {
    try {
      await systemConfigApi.deleteConfig(configKey)
      message.success('配置已删除')
      loadConfigs()
    } catch (err: any) {
      message.error(err.error || '删除失败')
    }
  }

  const openEditModal = (record: any) => {
    setEditRecord(record)
    editForm.setFieldsValue(record)
    setEditModalOpen(true)
  }

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields()
      if (editRecord.config_key) {
        await systemConfigApi.updateConfig(editRecord.config_key, values)
        message.success('配置已更新')
      } else {
        await systemConfigApi.createConfig(values)
        message.success('配置已创建')
      }
      setEditModalOpen(false)
      loadConfigs()
    } catch (err: any) {
      message.error(err.error || '操作失败')
    }
  }

  const typeMap: Record<string, string> = {
    string: '字符串',
    number: '数字',
    boolean: '布尔',
    json: 'JSON',
  }

  const columns = [
    { title: '配置键', dataIndex: 'config_key', width: 180 },
    { title: '配置值', dataIndex: 'config_value', width: 250, ellipsis: true },
    { title: '类型', dataIndex: 'config_type', width: 100, render: (v: string) => typeMap[v] || v },
    { title: '描述', dataIndex: 'description', width: 250, ellipsis: true },
    { title: '更新时间', dataIndex: 'updated_at', width: 170 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>编辑</Button>
          <Popconfirm title="确定删除此配置？" onConfirm={() => handleDelete(record.config_key)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const commonConfigs = [
    { config_key: 'site_name', config_value: '工具箱', config_type: 'string', description: '网站名称' },
    { config_key: 'site_description', config_value: '在线工具集合', config_type: 'string', description: '网站描述' },
    { config_key: 'contact_email', config_value: 'admin@example.com', config_type: 'string', description: '联系邮箱' },
    { config_key: 'daily_free_limit', config_value: '10', config_type: 'number', description: '每日免费使用次数' },
    { config_key: 'enable_ads', config_value: 'true', config_type: 'boolean', description: '是否启用广告' },
    { config_key: 'enable_registration', config_value: 'true', config_type: 'boolean', description: '是否开放注册' },
  ]

  return (
    <>
      <Card
        title="系统配置"
        extra={
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => {
              commonConfigs.forEach(config => openEditModal(config))
            }}>
              初始化常用配置
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditModal({})}>
              新增配置
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={configs}
          rowKey="config_key"
          loading={loading}
          size="small"
          pagination={false}
        />
      </Card>

      <Modal
        title={editRecord?.config_key ? '编辑配置' : '新增配置'}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleEdit}
        width={600}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="config_key" label="配置键" rules={[{ required: true }]}>
            <Input placeholder="如：site_name" disabled={!!editRecord?.config_key} />
          </Form.Item>
          <Form.Item name="config_value" label="配置值" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="配置值" />
          </Form.Item>
          <Form.Item name="config_type" label="类型" rules={[{ required: true }]}>
            <Select placeholder="选择类型">
              <Select.Option value="string">字符串</Select.Option>
              <Select.Option value="number">数字</Select.Option>
              <Select.Option value="boolean">布尔</Select.Option>
              <Select.Option value="json">JSON</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="配置说明" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
