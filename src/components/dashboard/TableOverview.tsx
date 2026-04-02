import { Card, Table } from 'antd'
import type { DashboardStats } from '../../types'

interface TableOverviewProps {
  stats: DashboardStats | null
}

export default function TableOverview({ stats }: TableOverviewProps) {
  const tableColumns = [
    { title: '表名', dataIndex: 'tableName', key: 'tableName' },
    { title: '行数', dataIndex: 'rowCount', key: 'rowCount', render: (v: number) => v?.toLocaleString() },
  ]

  const tableData = stats?.tableList || []

  return (<Card title="数据表概览" size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><Table
        columns={tableColumns}
        dataSource={tableData}
        rowKey="tableName"
        size="small"
        pagination={false}
        scroll={{ y: 260 }}
      /></Card>)
}