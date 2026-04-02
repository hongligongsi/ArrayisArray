import React, { useState, useEffect } from 'react'
import { Card, Tabs, DatePicker, Spin, Alert, Statistic, Row, Col, Progress, Table, Tag, Tooltip, Space } from 'antd'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as EchartsTooltip, Legend, ResponsiveContainer } from 'recharts'
import { ClockCircleOutlined, AlertOutlined, BarChartOutlined, LineChartOutlined, WarningOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { analyticsApi } from '../api'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { TabPane } = Tabs

interface PerformanceData {
    totalRequests: number
    totalResponseTime: number
    avgResponseTime: number
    errorRate: number
    endpointStats: Array<[string, {
        totalRequests: number
        totalResponseTime: number
        avgResponseTime: number
        maxResponseTime: number
        minResponseTime: number
        errorCount: number
    }]>
}

interface ToolTrendData {
    sqlQuery: Array<{
        date: string
        count: number
    }>
    dataBrowser: Array<{
        date: string
        count: number
    }>
    tableManager: Array<{
        date: string
        count: number
    }>
}

interface AnomalyData {
    totalAnomalies: number
    criticalAnomalies: number
    warningAnomalies: number
    anomalies: Array<{
        type: string
        endpoint?: string
        responseTime?: number
        threshold?: number
        timestamp?: number
        severity: 'critical' | 'warning'
        errorRate?: number
        totalRequests?: number
        errorCount?: number
        hour?: string
        requestCount?: number
    }>
}

const AnalyticsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('performance')
    const [loading, setLoading] = useState(true)
    const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
    const [toolTrendData, setToolTrendData] = useState<ToolTrendData | null>(null)
    const [anomalyData, setAnomalyData] = useState<AnomalyData | null>(null)
    const [timeRange, setTimeRange] = useState('24h')

    useEffect(() => {
        loadData()
    }, [activeTab, timeRange])

    const loadData = async () => {
        setLoading(true)
        try {
            if (activeTab === 'performance') {
                const response = await analyticsApi.getPerformance({ timeRange })
                setPerformanceData(response.data)
            } else if (activeTab === 'trends') {
                const response = await analyticsApi.getToolTrends({ timeRange })
                setToolTrendData(response.data)
            } else if (activeTab === 'anomalies') {
                const response = await analyticsApi.getAnomalies({ timeRange })
                setAnomalyData(response.data)
            }
        } catch (error) {
            console.error('Failed to load analytics data:', error)
        } finally {
            setLoading(false)
        }
    }

    const getAnomalyTypeText = (type: string) => {
        switch (type) {
            case 'high_response_time': return '响应时间异常'
            case 'high_error_rate': return '错误率异常'
            case 'high_request_rate': return '请求频率异常'
            default: return type
        }
    }

    const getAnomalySeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'error'
            case 'warning': return 'warning'
            default: return 'info'
        }
    }

    const getAnomalySeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            case 'warning': return <WarningOutlined style={{ color: '#faad14' }} />
            default: return <ClockCircleOutlined style={{ color: '#1890ff' }} />
        }
    }

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ marginBottom: 16, fontSize: '1.5rem', fontWeight: 600 }}>统计分析</h1>
                <Space>
                    <span>时间范围：</span>
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #d9d9d9' }}
                    >
                        <option value="1h">最近1小时</option>
                        <option value="24h">最近24小时</option>
                        <option value="7d">最近7天</option>
                        <option value="30d">最近30天</option>
                    </select>
                </Space>
            </div>

            <Tabs activeKey={activeTab} onChange={setActiveTab}>
                <TabPane tab={<><LineChartOutlined /> 性能监控</>} key="performance">
                    <Spin spinning={loading} tip="加载中...">
                        {performanceData && (
                            <>
                                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                                    <Col span={6}>
                                        <Card>
                                            <Statistic
                                                title="总请求数"
                                                value={performanceData.totalRequests}
                                                prefix={<ClockCircleOutlined />}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card>
                                            <Statistic
                                                title="平均响应时间"
                                                value={performanceData.avgResponseTime.toFixed(2)}
                                                suffix="ms"
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card>
                                            <Statistic
                                                title="错误率"
                                                value={(performanceData.errorRate * 100).toFixed(2)}
                                                suffix="%"
                                                valueStyle={{ color: performanceData.errorRate > 0.1 ? '#ff4d4f' : '#52c41a' }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card>
                                            <Statistic
                                                title="总响应时间"
                                                value={(performanceData.totalResponseTime / 1000).toFixed(2)}
                                                suffix="s"
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                <Card title="端点性能排行" style={{ marginBottom: 24 }}>
                                    <Table
                                        columns={[
                                            {
                                                title: '端点',
                                                dataIndex: 'endpoint',
                                                key: 'endpoint',
                                            },
                                            {
                                                title: '请求数',
                                                dataIndex: 'totalRequests',
                                                key: 'totalRequests',
                                                sorter: (a: any, b: any) => a.totalRequests - b.totalRequests,
                                            },
                                            {
                                                title: '平均响应时间 (ms)',
                                                dataIndex: 'avgResponseTime',
                                                key: 'avgResponseTime',
                                                sorter: (a: any, b: any) => a.avgResponseTime - b.avgResponseTime,
                                                render: (value: number) => value.toFixed(2),
                                            },
                                            {
                                                title: '最大响应时间 (ms)',
                                                dataIndex: 'maxResponseTime',
                                                key: 'maxResponseTime',
                                                sorter: (a: any, b: any) => a.maxResponseTime - b.maxResponseTime,
                                                render: (value: number) => value.toFixed(2),
                                            },
                                            {
                                                title: '错误数',
                                                dataIndex: 'errorCount',
                                                key: 'errorCount',
                                                sorter: (a: any, b: any) => a.errorCount - b.errorCount,
                                                render: (value: number) => (
                                                    <Tag color={value > 0 ? 'error' : 'success'}>{value}</Tag>
                                                ),
                                            },
                                        ]}
                                        dataSource={performanceData.endpointStats.map(([endpoint, stats], index) => ({
                                            key: index,
                                            endpoint,
                                            ...stats,
                                        }))}
                                    />
                                </Card>
                            </>
                        )}
                    </Spin>
                </TabPane>

                <TabPane tab={<><BarChartOutlined /> 工具趋势</>} key="trends">
                    <Spin spinning={loading} tip="加载中...">
                        {toolTrendData && (
                            <Card title="工具使用趋势">
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={toolTrendData.sqlQuery}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis />
                                        <EchartsTooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="count" name="SQL查询" stroke="#1890ff" activeDot={{ r: 8 }} />
                                        {toolTrendData.dataBrowser.map((item, index) => {
                                            const sqlItem = toolTrendData.sqlQuery.find(i => i.date === item.date)
                                            return {
                                                date: item.date,
                                                'SQL查询': sqlItem?.count || 0,
                                                '数据浏览': item.count,
                                            }
                                        }).forEach(item => {
                                            // 这里需要重新构建数据结构
                                        })}
                                    </LineChart>
                                </ResponsiveContainer>

                                <div style={{ marginTop: 24 }}>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={toolTrendData.sqlQuery}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <EchartsTooltip />
                                            <Legend />
                                            <Bar dataKey="count" name="SQL查询" fill="#1890ff" />
                                            {toolTrendData.dataBrowser.map((item, index) => {
                                                const sqlItem = toolTrendData.sqlQuery.find(i => i.date === item.date)
                                                return {
                                                    date: item.date,
                                                    'SQL查询': sqlItem?.count || 0,
                                                    '数据浏览': item.count,
                                                    '表管理': toolTrendData.tableManager.find(i => i.date === item.date)?.count || 0,
                                                }
                                            }).forEach(item => {
                                                // 这里需要重新构建数据结构
                                            })}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        )}
                    </Spin>
                </TabPane>

                <TabPane tab={<><AlertOutlined /> 异常告警</>} key="anomalies">
                    <Spin spinning={loading} tip="加载中...">
                        {anomalyData && (
                            <>
                                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                                    <Col span={8}>
                                        <Card>
                                            <Statistic
                                                title="总异常数"
                                                value={anomalyData.totalAnomalies}
                                                prefix={<AlertOutlined />}
                                                valueStyle={{ color: anomalyData.totalAnomalies > 0 ? '#ff4d4f' : '#52c41a' }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card>
                                            <Statistic
                                                title="严重异常"
                                                value={anomalyData.criticalAnomalies}
                                                prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                                                valueStyle={{ color: '#ff4d4f' }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card>
                                            <Statistic
                                                title="警告异常"
                                                value={anomalyData.warningAnomalies}
                                                prefix={<WarningOutlined style={{ color: '#faad14' }} />}
                                                valueStyle={{ color: '#faad14' }}
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                <Card title="异常列表">
                                    <Table
                                        columns={[
                                            {
                                                title: '类型',
                                                dataIndex: 'type',
                                                key: 'type',
                                                render: (type: string) => getAnomalyTypeText(type),
                                            },
                                            {
                                                title: '端点',
                                                dataIndex: 'endpoint',
                                                key: 'endpoint',
                                                render: (endpoint: string) => endpoint || '-',
                                            },
                                            {
                                                title: '详情',
                                                dataIndex: 'details',
                                                key: 'details',
                                                render: (_, record: any) => {
                                                    if (record.type === 'high_response_time') {
                                                        return `${record.responseTime.toFixed(2)}ms (阈值: ${record.threshold}ms)`
                                                    } else if (record.type === 'high_error_rate') {
                                                        return `${record.errorRate}% (${record.errorCount}/${record.totalRequests})`
                                                    } else if (record.type === 'high_request_rate') {
                                                        return `${record.requestCount}次/小时 (阈值: ${record.threshold}次)`
                                                    }
                                                    return '-'
                                                },
                                            },
                                            {
                                                title: '时间',
                                                dataIndex: 'timestamp',
                                                key: 'timestamp',
                                                render: (timestamp: number, record: any) => {
                                                    if (record.hour) {
                                                        return record.hour
                                                    } else if (timestamp) {
                                                        return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
                                                    }
                                                    return '-'
                                                },
                                            },
                                            {
                                                title: '严重程度',
                                                dataIndex: 'severity',
                                                key: 'severity',
                                                render: (severity: string) => (
                                                    <Tag color={getAnomalySeverityColor(severity)}>
                                                        {severity === 'critical' ? '严重' : '警告'}
                                                    </Tag>
                                                ),
                                            },
                                        ]}
                                        dataSource={anomalyData.anomalies.map((anomaly, index) => ({
                                            key: index,
                                            ...anomaly,
                                        }))}
                                    />
                                </Card>
                            </>
                        )}
                    </Spin>
                </TabPane>
            </Tabs>
        </div>
    )
}

export default AnalyticsPage