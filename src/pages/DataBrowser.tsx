import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Input,
  Select,
  Modal,
  Form,
  Popconfirm,
  Tag,
  Tooltip,
  Drawer,
  Upload,
  Alert,
  Popover,
  Typography,
} from 'antd'
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  CameraOutlined,
  HistoryOutlined,
  FilterOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { dataApi, tableApi } from '../api'
import type { ColumnInfo } from '../types'
import type { UploadProps } from 'antd'

const { Text } = Typography

interface FilterMemory {
  [key: string]: {
    searchText: string
    sortField?: string
    sortOrder?: string
    pageSize?: number
  }
}

interface Snapshot {
  id: number
  snapshot_name: string
  record_count: number
  created_at: string
}

export default function DataBrowser() {
  const [tables, setTables] = useState<string[]>([])
  const [currentTable, setCurrentTable] = useState('')
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 })
  const [sortInfo, setSortInfo] = useState<{ field: string; order: string } | null>(null)
  const [searchText, setSearchText] = useState('')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [insertModalOpen, setInsertModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<Record<string, unknown> | null>(null)
  const [editForm] = Form.useForm()
  const [insertForm] = Form.useForm()
  const [filterMemory, setFilterMemory] = useState<FilterMemory>({})
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [snapshotDrawerOpen, setSnapshotDrawerOpen] = useState(false)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [createSnapshotModalOpen, setCreateSnapshotModalOpen] = useState(false)
  const [snapshotName, setSnapshotName] = useState('')
  const [creatingSnapshot, setCreatingSnapshot] = useState(false)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const uploadRef = useRef<any>(null)

  const loadTables = async () => {
    try {
      const res: any = await tableApi.list()
      setTables((res.tables || []).map((t: any) => t.tableName))
    } catch (err: any) {
      message.error(err.message)
    }
  }

  const loadColumns = useCallback(async (tableName: string) => {
    try {
      const res: any = await tableApi.columns(tableName)
      setColumns(res.columns || [])
      return res.columns || []
    } catch (err: any) {
      message.error(err.message)
      return []
    }
  }, [])

  const loadData = useCallback(async (tableName: string, page = 1, pageSize = 50, sort?: { field: string; order: string } | null, search?: string) => {
    setLoading(true)
    try {
      const params: any = { page, pageSize }
      if (sort && sort.field) {
        params.sort = sort.field
        params.order = sort.order === 'ascend' ? 'ASC' : 'DESC'
      }
      if (search) {
        params.search = search
      }
      const res: any = await dataApi.query(tableName, params)
      setData(res.rows || [])
      setPagination((prev) => ({ ...prev, current: page, total: res.total || 0 }))
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleTableChange = async (tableName: string) => {
    setCurrentTable(tableName)
    setSearchText('')
    setSortInfo(null)
    if (tableName) {
      await loadColumns(tableName)
      await loadData(tableName)

      const savedFilter = filterMemory[tableName]
      if (savedFilter) {
        if (savedFilter.searchText) setSearchText(savedFilter.searchText)
        if (savedFilter.sortField && savedFilter.sortOrder) {
          setSortInfo({ field: savedFilter.sortField, order: savedFilter.sortOrder })
        }
        if (savedFilter.pageSize) {
          setPagination(prev => ({ ...prev, pageSize: savedFilter.pageSize }))
        }
      }
    } else {
      setColumns([])
      setData([])
    }
  }

  useEffect(() => {
    loadTables()
    const savedFilter = localStorage.getItem('dataBrowserFilterMemory')
    if (savedFilter) {
      try {
        setFilterMemory(JSON.parse(savedFilter))
      } catch { }
    }
  }, [])

  const saveFilterMemory = (tableName: string) => {
    const newFilterMemory = {
      ...filterMemory,
      [tableName]: {
        searchText,
        sortField: sortInfo?.field,
        sortOrder: sortInfo?.order,
        pageSize: pagination.pageSize,
      },
    }
    setFilterMemory(newFilterMemory)
    localStorage.setItem('dataBrowserFilterMemory', JSON.stringify(newFilterMemory))
  }

  const handleTableChangeInternal = (pag: any, _filters: any, sorter: any) => {
    const newSort = sorter.field
      ? { field: sorter.field, order: sorter.order }
      : null
    setSortInfo(newSort)
    loadData(currentTable, pag.current, pag.pageSize, newSort, searchText)
    saveFilterMemory(currentTable)
  }

  const handleSearch = () => {
    loadData(currentTable, 1, pagination.pageSize, sortInfo, searchText)
    saveFilterMemory(currentTable)
  }

  const getPkColumn = () => columns.find((c) => c.columnKey === 'PRI')

  const handleInsert = async () => {
    try {
      const values = await insertForm.validateFields()
      await dataApi.insert(currentTable, values)
      message.success('插入成功')
      setInsertModalOpen(false)
      insertForm.resetFields()
      loadData(currentTable, pagination.current, pagination.pageSize, sortInfo, searchText)
    } catch (err: any) {
      if (err.message) message.error(err.message)
    }
  }

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields()
      const pk = getPkColumn()
      if (!pk) {
        message.error('未找到主键，无法编辑')
        return
      }
      const where: Record<string, unknown> = {}
      where[pk.columnName] = editRecord?.[pk.columnName]
      await dataApi.update(currentTable, values, where)
      message.success('更新成功')
      setEditModalOpen(false)
      editForm.resetFields()
      setEditRecord(null)
      loadData(currentTable, pagination.current, pagination.pageSize, sortInfo, searchText)
    } catch (err: any) {
      if (err.message) message.error(err.message)
    }
  }

  const handleDelete = async (record: Record<string, unknown>) => {
    try {
      const pk = getPkColumn()
      if (!pk) {
        message.error('未找到主键，无法删除')
        return
      }
      const where: Record<string, unknown> = {}
      where[pk.columnName] = record[pk.columnName]
      await dataApi.delete(currentTable, where)
      message.success('删除成功')
      loadData(currentTable, pagination.current, pagination.pageSize, sortInfo, searchText)
    } catch (err: any) {
      message.error(err.message)
    }
  }

  const openEditModal = (record: Record<string, unknown>) => {
    setEditRecord(record)
    editForm.setFieldsValue(record)
    setEditModalOpen(true)
  }

  const handleExport = () => {
    if (!data.length) {
      message.warning('没有数据可导出')
      return
    }
    const headers = columns.map((c) => c.columnName).join(',')
    const rows = data.map((row) =>
      columns.map((c) => {
        const val = row[c.columnName]
        if (val === null || val === undefined) return ''
        const str = String(val)
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
      }).join(',')
    )
    const csv = '\uFEFF' + headers + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentTable}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  }

  const handleImport: UploadProps['customRequest'] = async (options) => {
    const { file } = options
    setImportFile(file as File)
    options.onSuccess?.(file)
  }

  const handleImportSubmit = async () => {
    if (!importFile) {
      message.warning('请选择文件')
      return
    }

    setImporting(true)
    try {
      const text = await importFile.text()
      const lines = text.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        message.error('CSV文件格式错误')
        return
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const record: Record<string, unknown> = {}
        headers.forEach((header, index) => {
          record[header] = values[index] || null
        })
        await dataApi.insert(currentTable, record)
      }

      message.success(`成功导入 ${lines.length - 1} 条记录`)
      setImportModalOpen(false)
      setImportFile(null)
      loadData(currentTable, pagination.current, pagination.pageSize, sortInfo, searchText)
    } catch (err: any) {
      message.error(err.message || '导入失败')
    } finally {
      setImporting(false)
    }
  }

  const loadSnapshots = async () => {
    setSnapshotLoading(true)
    try {
      const res: any = await dataApi.getSnapshots(currentTable)
      setSnapshots(res.snapshots || [])
      setSnapshotDrawerOpen(true)
    } catch (err: any) {
      message.error(err.message || '加载快照失败')
    } finally {
      setSnapshotLoading(false)
    }
  }

  const handleCreateSnapshot = async () => {
    if (!snapshotName.trim()) {
      message.warning('请输入快照名称')
      return
    }

    setCreatingSnapshot(true)
    try {
      const res: any = await dataApi.createSnapshot(currentTable, snapshotName)
      message.success(`快照创建成功，共 ${res.recordCount} 条记录`)
      setCreateSnapshotModalOpen(false)
      setSnapshotName('')
      loadSnapshots()
    } catch (err: any) {
      message.error(err.message || '创建快照失败')
    } finally {
      setCreatingSnapshot(false)
    }
  }

  const handleRestoreSnapshot = async (snapshotId: number) => {
    Modal.confirm({
      title: '确认恢复',
      content: '恢复快照将清空当前表数据并替换为快照数据，此操作不可撤销。是否继续？',
      onOk: async () => {
        try {
          const res: any = await dataApi.restoreSnapshot(currentTable, snapshotId)
          message.success(`快照恢复成功，共 ${res.recordCount} 条记录`)
          loadData(currentTable, pagination.current, pagination.pageSize, sortInfo, searchText)
          loadSnapshots()
        } catch (err: any) {
          message.error(err.message || '恢复快照失败')
        }
      },
    })
  }

  const handleDeleteSnapshot = async (snapshotId: number) => {
    try {
      await dataApi.deleteSnapshot(currentTable, snapshotId)
      message.success('快照删除成功')
      loadSnapshots()
    } catch (err: any) {
      message.error(err.message || '删除快照失败')
    }
  }

  const dynamicColumns = columns.map((col) => ({
    title: (
      <Tooltip title={`${col.dataType}${col.columnKey === 'PRI' ? ' (主键)' : ''}`}>
        {col.columnName}
        {col.columnKey === 'PRI' && <Tag color="gold" style={{ marginLeft: 4, fontSize: 10 }}>PK</Tag>}
      </Tooltip>
    ),
    dataIndex: col.columnName,
    key: col.columnName,
    width: 150,
    ellipsis: true,
    sorter: true,
    render: (val: unknown) =>
      val === null || val === undefined ? (
        <span className="null-value">NULL</span>
      ) : (
        String(val)
      ),
  }))

  const pk = getPkColumn()
  if (pk) {
    dynamicColumns.push({
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: Record<string, unknown>) => (
        <Space>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          </Tooltip>
          <Popconfirm
            title="确定要删除此行吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Tooltip title="删除">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    })
  }

  const renderFormFields = (form: any, isEdit: boolean) =>
    columns.map((col) => {
      if (col.extra === 'autoincrement' && isEdit) return null
      return (
        <Form.Item
          key={col.columnName}
          name={col.columnName}
          label={`${col.columnName} (${col.dataType})`}
          rules={col.isNullable === 'NO' && !isEdit ? [{ required: true, message: '必填' }] : undefined}
        >
          <Input placeholder={col.columnComment || col.dataType} />
        </Form.Item>
      )
    })

  const filterContent = (
    <div style={{ width: 300 }}>
      <Alert
        message="筛选记忆"
        description="当前筛选条件将自动保存，下次打开此表时自动应用"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <div style={{ marginBottom: 8 }}>
        <Text strong>搜索:</Text>
        <Input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="搜索内容..."
          style={{ marginTop: 4 }}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <Text strong>排序:</Text>
        <div style={{ marginTop: 4 }}>
          {sortInfo ? (
            <Tag closable onClose={() => setSortInfo(null)}>
              {sortInfo.field} ({sortInfo.order === 'ascend' ? '升序' : '降序'})
            </Tag>
          ) : (
            <Text type="secondary">无排序</Text>
          )}
        </div>
      </div>
      <div>
        <Text strong>每页显示:</Text>
        <Select
          value={pagination.pageSize}
          onChange={(value) => {
            setPagination(prev => ({ ...prev, pageSize: value }))
            saveFilterMemory(currentTable)
          }}
          style={{ width: '100%', marginTop: 4 }}
        >
          <Select.Option value={20}>20</Select.Option>
          <Select.Option value={50}>50</Select.Option>
          <Select.Option value={100}>100</Select.Option>
          <Select.Option value={200}>200</Select.Option>
        </Select>
      </div>
    </div>
  )

  return (
    <div>
      <Card
        title={
          <Space>
            <span>数据浏览</span>
            {currentTable && <Tag color="blue">{currentTable}</Tag>}
            {pagination.total > 0 && <Tag>{pagination.total} 条记录</Tag>}
          </Space>
        }
        extra={
          <Space>
            <Select
              value={currentTable || undefined}
              onChange={handleTableChange}
              style={{ width: 200 }}
              placeholder="选择表"
              allowClear
              showSearch
              options={tables.map((t) => ({ label: t, value: t }))}
            />
            {currentTable && (
              <>
                <Popover
                  content={filterContent}
                  title="筛选设置"
                  trigger="click"
                  open={filterPopoverOpen}
                  onOpenChange={setFilterPopoverOpen}
                >
                  <Button icon={<FilterOutlined />} />
                </Popover>
                <Input.Search
                  placeholder="搜索..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onSearch={handleSearch}
                  style={{ width: 200 }}
                  allowClear
                />
                <Tooltip title="导入 CSV">
                  <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)} />
                </Tooltip>
                <Tooltip title="导出 CSV">
                  <Button icon={<DownloadOutlined />} onClick={handleExport} />
                </Tooltip>
                <Tooltip title="数据快照">
                  <Button icon={<CameraOutlined />} onClick={loadSnapshots} />
                </Tooltip>
                <Button icon={<ReloadOutlined />} onClick={() => loadData(currentTable, pagination.current, pagination.pageSize, sortInfo, searchText)}>
                  刷新
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setInsertModalOpen(true)}>
                  新增
                </Button>
              </>
            )}
          </Space>
        }
      >
        <Table
          columns={dynamicColumns}
          dataSource={data}
          rowKey={(record: any) => {
            const pkCol = getPkColumn()
            return pkCol ? String(record[pkCol.columnName] ?? Math.random()) : String(Math.random())
          }}
          loading={loading}
          size="small"
          scroll={{ x: 'max-content', y: 600 }}
          onChange={handleTableChangeInternal}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
            pageSizeOptions: ['20', '50', '100', '200'],
          }}
          locale={{ emptyText: currentTable ? '暂无数据' : '请选择一个表' }}
        />
      </Card>

      <Modal
        title="新增记录"
        open={insertModalOpen}
        onOk={handleInsert}
        onCancel={() => {
          setInsertModalOpen(false)
          insertForm.resetFields()
        }}
        width={600}
      >
        <Form form={insertForm} layout="vertical" style={{ marginTop: 16, maxHeight: 500, overflow: 'auto' }}>
          {renderFormFields(insertForm, false)}
        </Form>
      </Modal>

      <Modal
        title="编辑记录"
        open={editModalOpen}
        onOk={handleEdit}
        onCancel={() => {
          setEditModalOpen(false)
          editForm.resetFields()
          setEditRecord(null)
        }}
        width={600}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16, maxHeight: 500, overflow: 'auto' }}>
          {renderFormFields(editForm, true)}
        </Form>
      </Modal>

      <Modal
        title="导入 CSV 文件"
        open={importModalOpen}
        onOk={handleImportSubmit}
        onCancel={() => {
          setImportModalOpen(false)
          setImportFile(null)
        }}
        confirmLoading={importing}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="导入说明"
            description="请确保CSV文件的第一行为列名，列名必须与表结构匹配。"
            type="info"
            showIcon
          />
        </div>
        <Upload
          ref={uploadRef}
          customRequest={handleImport}
          accept=".csv"
          maxCount={1}
          fileList={importFile ? [{ uid: '1', name: importFile.name, status: 'done' }] : []}
          onRemove={() => setImportFile(null)}
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
      </Modal>

      <Modal
        title="创建数据快照"
        open={createSnapshotModalOpen}
        onOk={handleCreateSnapshot}
        onCancel={() => {
          setCreateSnapshotModalOpen(false)
          setSnapshotName('')
        }}
        confirmLoading={creatingSnapshot}
      >
        <Form layout="vertical">
          <Form.Item label="快照名称" required>
            <Input
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="请输入快照名称"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="数据快照"
        placement="right"
        width={600}
        open={snapshotDrawerOpen}
        onClose={() => setSnapshotDrawerOpen(false)}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateSnapshotModalOpen(true)}>
            创建快照
          </Button>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {snapshots.length === 0 ? (
            <Text type="secondary">暂无快照</Text>
          ) : (
            snapshots.map((snapshot) => (
              <Card
                key={snapshot.id}
                size="small"
                title={snapshot.snapshot_name}
                extra={
                  <Space>
                    <Tooltip title="恢复">
                      <Button size="small" icon={<HistoryOutlined />} onClick={() => handleRestoreSnapshot(snapshot.id)} />
                    </Tooltip>
                    <Popconfirm
                      title="确定要删除此快照吗？"
                      onConfirm={() => handleDeleteSnapshot(snapshot.id)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                }
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text type="secondary">记录数:</Text> {snapshot.record_count}
                  </div>
                  <div>
                    <Text type="secondary">创建时间:</Text> {snapshot.created_at}
                  </div>
                </Space>
              </Card>
            ))
          )}
        </Space>
      </Drawer>
    </div>
  )
}
