import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  message,
  Popconfirm,
  Modal,
  Input,
  Select,
  Form,
  Checkbox,
  Tooltip,
  Drawer,
  Alert,
  Descriptions,
  Typography,
} from 'antd'
import {
  ReloadOutlined,
  DeleteOutlined,
  PlusOutlined,
  EyeOutlined,
  ScissorOutlined,
  DiffOutlined,
  KeyOutlined,
  DownloadOutlined,
  UploadOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import { tableApi } from '../api'
import type { ColumnInfo } from '../types'

const { Text, Paragraph } = Typography

interface TableItem {
  tableName: string
  rowCount: number
  engine: string
  tableComment: string
  createTime: string
}

interface IndexInfo {
  Key_name: string
  Column_name: string
  Seq_in_index: number
  Cardinality: number
  Collation: string
  Null: string
  Index_type: string
  Comment: string
}

interface Difference {
  column: string
  type: 'added' | 'removed' | 'modified'
  table1?: any
  table2?: any
  changes?: string[]
}

export default function TableManager() {
  const [tables, setTables] = useState<TableItem[]>([])
  const [loading, setLoading] = useState(false)
  const [columnsVisible, setColumnsVisible] = useState(false)
  const [currentTable, setCurrentTable] = useState('')
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [columnsLoading, setColumnsLoading] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [compareModalOpen, setCompareModalOpen] = useState(false)
  const [compareTable1, setCompareTable1] = useState('')
  const [compareTable2, setCompareTable2] = useState('')
  const [differences, setDifferences] = useState<Difference[]>([])
  const [comparing, setComparing] = useState(false)
  const [indexesDrawerOpen, setIndexesDrawerOpen] = useState(false)
  const [indexes, setIndexes] = useState<IndexInfo[]>([])
  const [indexesLoading, setIndexesLoading] = useState(false)
  const [createIndexModalOpen, setCreateIndexModalOpen] = useState(false)
  const [createIndexForm] = Form.useForm()
  const [backupModalOpen, setBackupModalOpen] = useState(false)
  const [backupSQL, setBackupSQL] = useState('')
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreModalOpen, setRestoreModalOpen] = useState(false)
  const [restoreSQL, setRestoreSQL] = useState('')
  const [restoring, setRestoring] = useState(false)

  const loadTables = async () => {
    setLoading(true)
    try {
      const res: any = await tableApi.list()
      setTables(res.tables || [])
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTables()
  }, [])

  const handleViewColumns = async (tableName: string) => {
    setCurrentTable(tableName)
    setColumnsVisible(true)
    setColumnsLoading(true)
    try {
      const res: any = await tableApi.columns(tableName)
      setColumns(res.columns || [])
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setColumnsLoading(false)
    }
  }

  const handleDrop = async (tableName: string) => {
    try {
      await tableApi.drop(tableName)
      message.success(`表 ${tableName} 已删除`)
      loadTables()
    } catch (err: any) {
      message.error(err.message)
    }
  }

  const handleTruncate = async (tableName: string) => {
    try {
      await tableApi.truncate(tableName)
      message.success(`表 ${tableName} 已清空`)
      loadTables()
    } catch (err: any) {
      message.error(err.message)
    }
  }

  const handleCreateTable = async () => {
    try {
      const values = await createForm.validateFields()
      await tableApi.create(values)
      message.success('表创建成功')
      setCreateModalOpen(false)
      createForm.resetFields()
      loadTables()
    } catch (err: any) {
      if (err.message) message.error(err.message)
    }
  }

  const handleCompare = async () => {
    if (!compareTable1 || !compareTable2) {
      message.warning('请选择两个表进行对比')
      return
    }
    if (compareTable1 === compareTable2) {
      message.warning('请选择不同的表进行对比')
      return
    }

    setComparing(true)
    try {
      const res: any = await tableApi.compare(compareTable1, compareTable2)
      setDifferences(res.differences || [])
      setCompareModalOpen(true)
    } catch (err: any) {
      message.error(err.message || '对比失败')
    } finally {
      setComparing(false)
    }
  }

  const loadIndexes = async (tableName: string) => {
    setCurrentTable(tableName)
    setIndexesLoading(true)
    try {
      const res: any = await tableApi.getIndexes(tableName)
      setIndexes(res.indexes || [])
      setIndexesDrawerOpen(true)
    } catch (err: any) {
      message.error(err.message || '加载索引失败')
    } finally {
      setIndexesLoading(false)
    }
  }

  const handleCreateIndex = async () => {
    try {
      const values = await createIndexForm.validateFields()
      await tableApi.createIndex(currentTable, values)
      message.success('索引创建成功')
      setCreateIndexModalOpen(false)
      createIndexForm.resetFields()
      loadIndexes(currentTable)
    } catch (err: any) {
      if (err.message) message.error(err.message)
    }
  }

  const handleDropIndex = async (indexName: string) => {
    try {
      await tableApi.dropIndex(currentTable, indexName)
      message.success('索引删除成功')
      loadIndexes(currentTable)
    } catch (err: any) {
      message.error(err.message)
    }
  }

  const handleBackup = async (tableName: string) => {
    setCurrentTable(tableName)
    setBackupLoading(true)
    try {
      const res: any = await tableApi.backup(tableName)
      setBackupSQL(res.sql || '')
      setBackupModalOpen(true)
    } catch (err: any) {
      message.error(err.message || '备份失败')
    } finally {
      setBackupLoading(false)
    }
  }

  const handleCopyBackup = () => {
    navigator.clipboard.writeText(backupSQL)
    message.success('已复制到剪贴板')
  }

  const handleDownloadBackup = () => {
    const blob = new Blob([backupSQL], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentTable}_backup_${new Date().toISOString().slice(0, 10)}.sql`
    a.click()
    URL.revokeObjectURL(url)
    message.success('下载成功')
  }

  const handleRestore = async () => {
    if (!restoreSQL.trim()) {
      message.warning('请输入SQL语句')
      return
    }

    setRestoring(true)
    try {
      const res: any = await tableApi.restore(restoreSQL)
      message.success(`恢复成功，共执行 ${res.statementCount} 条语句`)
      setRestoreModalOpen(false)
      setRestoreSQL('')
      loadTables()
    } catch (err: any) {
      message.error(err.message || '恢复失败')
    } finally {
      setRestoring(false)
    }
  }

  const tableColumns = [
    {
      title: '表名',
      dataIndex: 'tableName',
      key: 'tableName',
      render: (text: string) => (
        <a onClick={() => handleViewColumns(text)}>{text}</a>
      ),
    },
    {
      title: '引擎',
      dataIndex: 'engine',
      key: 'engine',
      width: 90,
      responsive: ['md'] as any,
    },
    {
      title: '行数',
      dataIndex: 'rowCount',
      key: 'rowCount',
      width: 100,
      render: (val: number) => val?.toLocaleString(),
    },
    {
      title: '注释',
      dataIndex: 'tableComment',
      key: 'tableComment',
      ellipsis: true,
      responsive: ['lg'] as any,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 170,
      responsive: ['xl'] as any,
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right' as const,
      render: (_: unknown, record: TableItem) => (
        <Space>
          <Tooltip title="查看结构">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewColumns(record.tableName)}
            />
          </Tooltip>
          <Tooltip title="查看索引">
            <Button
              size="small"
              icon={<KeyOutlined />}
              onClick={() => loadIndexes(record.tableName)}
            />
          </Tooltip>
          <Tooltip title="备份表">
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleBackup(record.tableName)}
              loading={backupLoading && currentTable === record.tableName}
            />
          </Tooltip>
          <Popconfirm
            title="确定要清空此表吗？所有数据将被删除！"
            onConfirm={() => handleTruncate(record.tableName)}
          >
            <Tooltip title="清空表">
              <Button size="small" icon={<ScissorOutlined />} />
            </Tooltip>
          </Popconfirm>
          <Popconfirm
            title="确定要删除此表吗？此操作不可恢复！"
            onConfirm={() => handleDrop(record.tableName)}
          >
            <Tooltip title="删除表">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const columnInfoColumns = [
    { title: '字段名', dataIndex: 'columnName', key: 'columnName' },
    { title: '数据类型', dataIndex: 'dataType', key: 'dataType' },
    {
      title: '允许NULL',
      dataIndex: 'isNullable',
      key: 'isNullable',
      render: (val: string) =>
        val === 'YES' ? (
          <Tag color="blue">YES</Tag>
        ) : (
          <Tag color="red">NO</Tag>
        ),
    },
    {
      title: '键',
      dataIndex: 'columnKey',
      key: 'columnKey',
      render: (val: string) => {
        if (val === 'PRI') return <Tag color="gold">主键</Tag>
        if (val === 'UNI') return <Tag color="green">唯一</Tag>
        if (val === 'MUL') return <Tag color="blue">索引</Tag>
        return val || '-'
      },
    },
    { title: '默认值', dataIndex: 'columnDefault', key: 'columnDefault', render: (val: string | null) => val ?? <span className="null-value">NULL</span> },
    { title: '额外', dataIndex: 'extra', key: 'extra' },
  ]

  const indexColumns = [
    { title: '索引名', dataIndex: 'Key_name', key: 'Key_name' },
    { title: '列名', dataIndex: 'Column_name', key: 'Column_name' },
    { title: '序列', dataIndex: 'Seq_in_index', key: 'Seq_in_index', width: 80 },
    { title: '基数', dataIndex: 'Cardinality', key: 'Cardinality', width: 100 },
    { title: '类型', dataIndex: 'Index_type', key: 'Index_type', width: 120 },
    { title: '注释', dataIndex: 'Comment', key: 'Comment', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: IndexInfo) => (
        <Space>
          {record.Key_name !== 'PRIMARY' && (
            <Popconfirm
              title="确定要删除此索引吗？"
              onConfirm={() => handleDropIndex(record.Key_name)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const renderFormFields = (form: any) =>
    columns.map((col) => {
      if (col.extra === 'autoincrement') return null
      return (
        <Form.Item
          key={col.columnName}
          name={col.columnName}
          label={`${col.columnName} (${col.dataType})`}
          rules={col.isNullable === 'NO' ? [{ required: true, message: '必填' }] : undefined}
        >
          <Input placeholder={col.columnComment || col.dataType} />
        </Form.Item>
      )
    })

  return (
    <div>
      <Card
        title="表结构管理"
        extra={
          <Space>
            <Button icon={<DiffOutlined />} onClick={() => setCompareModalOpen(true)}>
              表结构对比
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setRestoreModalOpen(true)}>
              恢复备份
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadTables}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              新建表
            </Button>
          </Space>
        }
      >
        <Table
          columns={tableColumns}
          dataSource={tables}
          rowKey="tableName"
          loading={loading}
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: '暂无数据表' }}
        />
      </Card>

      <Modal
        title={`表结构: ${currentTable}`}
        open={columnsVisible}
        onCancel={() => setColumnsVisible(false)}
        footer={null}
        width={900}
      >
        <Table
          columns={columnInfoColumns}
          dataSource={columns}
          rowKey="columnName"
          loading={columnsLoading}
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </Modal>

      <Modal
        title="新建表"
        open={createModalOpen}
        onOk={handleCreateTable}
        onCancel={() => {
          setCreateModalOpen(false)
          createForm.resetFields()
        }}
        width={600}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="tableName"
            label="表名"
            rules={[{ required: true, message: '请输入表名' }]}
          >
            <Input placeholder="请输入表名" />
          </Form.Item>
          <Form.List name="columns">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'name']}
                      rules={[{ required: true, message: '字段名' }]}
                    >
                      <Input placeholder="字段名" style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'type']}
                      rules={[{ required: true, message: '类型' }]}
                    >
                      <Select
                        placeholder="类型"
                        style={{ width: 140 }}
                        options={[
                          { label: 'INTEGER', value: 'INTEGER' },
                          { label: 'TEXT', value: 'TEXT' },
                          { label: 'REAL', value: 'REAL' },
                          { label: 'NUMERIC', value: 'NUMERIC' },
                          { label: 'BLOB', value: 'BLOB' },
                          { label: 'VARCHAR(255)', value: 'VARCHAR(255)' },
                          { label: 'BOOLEAN', value: 'BOOLEAN' },
                          { label: 'DATETIME', value: 'DATETIME' },
                          { label: 'DATE', value: 'DATE' },
                          { label: 'JSON', value: 'JSON' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'primaryKey']} valuePropName="checked">
                      <Checkbox>主键</Checkbox>
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'nullable']} valuePropName="checked" initialValue={true}>
                      <Checkbox>可空</Checkbox>
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'comment']}>
                      <Input placeholder="注释" style={{ width: 100 }} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button type="link" danger onClick={() => remove(name)}>
                        删除
                      </Button>
                    )}
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加字段
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title="表结构对比"
        open={compareModalOpen}
        onCancel={() => setCompareModalOpen(false)}
        footer={null}
        width={1000}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space>
            <Select
              placeholder="选择第一个表"
              style={{ width: 200 }}
              value={compareTable1 || undefined}
              onChange={setCompareTable1}
              options={tables.map(t => ({ label: t.tableName, value: t.tableName }))}
            />
            <Text>vs</Text>
            <Select
              placeholder="选择第二个表"
              style={{ width: 200 }}
              value={compareTable2 || undefined}
              onChange={setCompareTable2}
              options={tables.map(t => ({ label: t.tableName, value: t.tableName }))}
            />
            <Button type="primary" onClick={handleCompare} loading={comparing}>
              对比
            </Button>
          </Space>

          {differences.length === 0 ? (
            <Alert message="未选择表或表结构相同" type="info" />
          ) : (
            <Table
              columns={[
                { title: '字段名', dataIndex: 'column', key: 'column' },
                {
                  title: '类型',
                  dataIndex: 'type',
                  key: 'type',
                  render: (type: string) => {
                    if (type === 'added') return <Tag color="green">新增</Tag>
                    if (type === 'removed') return <Tag color="red">删除</Tag>
                    if (type === 'modified') return <Tag color="orange">修改</Tag>
                    return type
                  },
                },
                {
                  title: '变更详情',
                  dataIndex: 'changes',
                  key: 'changes',
                  render: (changes: string[]) => changes?.join(', ') || '-',
                },
              ]}
              dataSource={differences}
              rowKey="column"
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          )}
        </Space>
      </Modal>

      <Drawer
        title={`索引管理: ${currentTable}`}
        placement="right"
        width={800}
        open={indexesDrawerOpen}
        onClose={() => setIndexesDrawerOpen(false)}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateIndexModalOpen(true)}>
            创建索引
          </Button>
        }
      >
        <Table
          columns={indexColumns}
          dataSource={indexes}
          rowKey={(record, index) => `${record.Key_name}-${record.Seq_in_index}`}
          loading={indexesLoading}
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </Drawer>

      <Modal
        title="创建索引"
        open={createIndexModalOpen}
        onOk={handleCreateIndex}
        onCancel={() => {
          setCreateIndexModalOpen(false)
          createIndexForm.resetFields()
        }}
        width={500}
      >
        <Form form={createIndexForm} layout="vertical">
          <Form.Item
            name="indexName"
            label="索引名"
            rules={[{ required: true, message: '请输入索引名' }]}
          >
            <Input placeholder="请输入索引名" />
          </Form.Item>
          <Form.Item
            name="columns"
            label="索引列"
            rules={[{ required: true, message: '请选择索引列' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择索引列"
              options={columns.map(col => ({ label: col.columnName, value: col.columnName }))}
            />
          </Form.Item>
          <Form.Item name="unique" valuePropName="checked" initialValue={false}>
            <Checkbox>唯一索引</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="表备份"
        open={backupModalOpen}
        onCancel={() => setBackupModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setBackupModalOpen(false)}>
            关闭
          </Button>,
          <Button key="copy" icon={<CopyOutlined />} onClick={handleCopyBackup}>
            复制
          </Button>,
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownloadBackup}>
            下载
          </Button>,
        ]}
        width={800}
      >
        <Alert
          message="备份说明"
          description="此备份包含表结构和数据，可用于恢复表。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          value={backupSQL}
          readOnly
          rows={20}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>

      <Modal
        title="恢复备份"
        open={restoreModalOpen}
        onOk={handleRestore}
        onCancel={() => {
          setRestoreModalOpen(false)
          setRestoreSQL('')
        }}
        confirmLoading={restoring}
        width={800}
      >
        <Alert
          message="恢复说明"
          description="请粘贴备份SQL语句，此操作将执行SQL语句，请谨慎操作。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          value={restoreSQL}
          onChange={(e) => setRestoreSQL(e.target.value)}
          placeholder="在此粘贴备份SQL语句..."
          rows={20}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>
    </div>
  )
}
