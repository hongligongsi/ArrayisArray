import { useState, useEffect } from 'react'
import { Card, Descriptions, Tag, Alert } from 'antd'
import { DatabaseOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { connectionApi, tableApi, dataApi } from '../api'

export default function ConnectionManager() {
  const [dbInfo, setDbInfo] = useState<{ connected: boolean; database: string | null; host: string | null } | null>(null)
  const [stats, setStats] = useState<{ tables: number; totalRows: number } | null>(null)

  useEffect(() => {
    loadInfo()
  }, [])

  const loadInfo = async () => {
    try {
      const res: any = await connectionApi.status()
      setDbInfo(res)
      const tablesRes: any = await tableApi.list()
      const tables = tablesRes.tables || []
      let totalRows = 0
      for (const t of tables) {
        try {
          const countRes: any = await dataApi.count(t.tableName)
          totalRows += countRes.count || 0
        } catch {}
      }
      setStats({ tables: tables.length, totalRows })
    } catch {}
  }

  return (
    <div>
      <Card title="数据库信息">
        <Alert
          message="SQLite 模式"
          description="当前使用 SQLite 文件数据库，无需配置连接。数据存储在本地 .db 文件中。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
        {dbInfo && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="状态">
              <Tag color="success" icon={<CheckCircleOutlined />}>已连接</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="数据库类型">
              <Tag icon={<DatabaseOutlined />}>SQLite</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="数据库文件">{dbInfo.database}</Descriptions.Item>
            <Descriptions.Item label="存储位置">{dbInfo.host}</Descriptions.Item>
          </Descriptions>
        )}
        {stats && (
          <Descriptions bordered column={2} size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="表数量">{stats.tables}</Descriptions.Item>
            <Descriptions.Item label="总记录数">{stats.totalRows}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    </div>
  )
}
