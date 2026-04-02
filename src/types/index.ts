export interface ConnectionConfig {
  id: string
  name: string
  host: string
  port: number
  user: string
  password: string
  database: string
}

export interface DatabaseInfo {
  schema: string
}

export interface TableInfo {
  tableName: string
  tableType: string
  tableComment: string
  engine: string
  rowCount: number
  createTime: string
  updateTime: string
}

export interface ColumnInfo {
  columnName: string
  dataType: string
  isNullable: string
  columnKey: string
  columnDefault: string | null
  extra: string
  columnComment: string
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  affectedRows?: number
  message?: string
}
