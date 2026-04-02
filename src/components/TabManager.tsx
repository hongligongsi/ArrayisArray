import { useState, useEffect } from 'react'
import { Tabs, Badge, Tooltip, Button } from 'antd'
import { CloseOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'

interface TabItem {
  key: string
  title: string
  path: string
  icon?: React.ReactNode
  count?: number
}

export default function TabManager() {
  const location = useLocation()
  const navigate = useNavigate()
  const [tabs, setTabs] = useState<TabItem[]>(() => {
    const savedTabs = localStorage.getItem('tabs')
    return savedTabs ? JSON.parse(savedTabs) : []
  })
  const [activeKey, setActiveKey] = useState(location.pathname)

  const tabTitleMap: Record<string, string> = {
    '/dashboard': '仪表板',
    '/analytics': '统计分析',
    '/tools': '工具管理',
    '/membership': '会员套餐',
    '/ads': '广告配置',
    '/feedback': '反馈管理',
    '/system': '系统配置',
    '/tables': '表结构管理',
    '/data': '数据浏览',
    '/query': 'SQL 查询',
    '/content': '内容审核',
    '/orders': '订单管理',
    '/permissions': '权限管理',
    '/customer-service': '客服系统',
    '/logs/operations': '操作日志',
    '/logs/errors': '异常日志',
  }

  useEffect(() => {
    const currentPath = location.pathname
    setActiveKey(currentPath)
    
    // 检查当前路径是否已在标签页中
    const existingTab = tabs.find(tab => tab.path === currentPath)
    if (!existingTab) {
      const newTab: TabItem = {
        key: currentPath,
        title: tabTitleMap[currentPath] || currentPath,
        path: currentPath,
      }
      const newTabs = [...tabs, newTab]
      setTabs(newTabs)
      localStorage.setItem('tabs', JSON.stringify(newTabs))
    }
  }, [location.pathname, tabs])

  const handleTabChange = (key: string) => {
    setActiveKey(key)
    const tab = tabs.find(t => t.key === key)
    if (tab) {
      navigate(tab.path)
    }
  }

  const handleTabClose = (key: string) => {
    const newTabs = tabs.filter(tab => tab.key !== key)
    setTabs(newTabs)
    localStorage.setItem('tabs', JSON.stringify(newTabs))
    
    // 如果关闭的是当前活动标签，切换到第一个标签
    if (key === activeKey && newTabs.length > 0) {
      handleTabChange(newTabs[0].key)
    } else if (newTabs.length === 0) {
      navigate('/dashboard')
    }
  }

  const handleCloseAll = () => {
    setTabs([])
    localStorage.removeItem('tabs')
    navigate('/dashboard')
  }

  const handleCloseOthers = (key: string) => {
    const newTabs = tabs.filter(tab => tab.key === key)
    setTabs(newTabs)
    localStorage.setItem('tabs', JSON.stringify(newTabs))
  }

  const tabItems = tabs.map(tab => ({
    key: tab.key,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {tab.count ? <Badge count={tab.count} size="small" /> : null}
        <span>{tab.title}</span>
        <Tooltip title="关闭">
          <CloseOutlined 
            onClick={(e) => {
              e.stopPropagation()
              handleTabClose(tab.key)
            }}
            style={{ fontSize: 12, cursor: 'pointer' }}
          />
        </Tooltip>
      </div>
    ),
  }))

  return (
    <div style={{ marginBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{tabTitleMap[activeKey] || activeKey}</h2>
        {tabs.length > 1 && (
          <Button 
            type="text" 
            icon={<CloseCircleOutlined />} 
            onClick={handleCloseAll}
            size="small"
          >
            关闭全部
          </Button>
        )}
      </div>
      {tabs.length > 0 && (
        <Tabs
          activeKey={activeKey}
          onChange={handleTabChange}
          items={tabItems}
          style={{ minHeight: 48 }}
        />
      )}
    </div>
  )
}
