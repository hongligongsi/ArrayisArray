import { useEffect, useState } from 'react'
import { Modal, List, Typography, Divider, Tag, Space } from 'antd'
import { KeyOutlined, InfoCircleOutlined } from '@ant-design/icons'

interface Shortcut {
  key: string
  description: string
  action: () => void
  category: string
}

export default function KeyboardShortcuts() {
  const [visible, setVisible] = useState(false)

  const shortcuts: Shortcut[] = [
    {
      key: 'Ctrl + K',
      description: '快速搜索/导航',
      action: () => console.log('Quick search'),
      category: '导航'
    },
    {
      key: 'Ctrl + N',
      description: '新建标签页',
      action: () => console.log('New tab'),
      category: '标签页'
    },
    {
      key: 'Ctrl + W',
      description: '关闭当前标签页',
      action: () => console.log('Close tab'),
      category: '标签页'
    },
    {
      key: 'Ctrl + Shift + W',
      description: '关闭所有标签页',
      action: () => console.log('Close all tabs'),
      category: '标签页'
    },
    {
      key: 'Ctrl + Tab',
      description: '切换到下一个标签页',
      action: () => console.log('Next tab'),
      category: '标签页'
    },
    {
      key: 'Ctrl + Shift + Tab',
      description: '切换到上一个标签页',
      action: () => console.log('Previous tab'),
      category: '标签页'
    },
    {
      key: 'Ctrl + 1-9',
      description: '切换到第N个标签页',
      action: () => console.log('Switch to tab N'),
      category: '标签页'
    },
    {
      key: 'Ctrl + D',
      description: '回到仪表板',
      action: () => window.location.href = '/dashboard',
      category: '导航'
    },
    {
      key: 'Ctrl + F',
      description: '页面内搜索',
      action: () => window.find(''),
      category: '搜索'
    },
    {
      key: 'F1',
      description: '显示帮助',
      action: () => setVisible(true),
      category: '帮助'
    },
  ]

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 显示快捷键帮助
      if (e.key === 'F1') {
        e.preventDefault()
        setVisible(true)
      }
      
      // 快速导航
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        shortcuts.find(s => s.key === 'Ctrl + K')?.action()
      }
      
      // 新建标签页
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        shortcuts.find(s => s.key === 'Ctrl + N')?.action()
      }
      
      // 关闭标签页
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        shortcuts.find(s => s.key === 'Ctrl + W')?.action()
      }
      
      // 关闭所有标签页
      if (e.ctrlKey && e.shiftKey && e.key === 'w') {
        e.preventDefault()
        shortcuts.find(s => s.key === 'Ctrl + Shift + W')?.action()
      }
      
      // 回到仪表板
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault()
        shortcuts.find(s => s.key === 'Ctrl + D')?.action()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 按分类分组快捷键
  const groupedShortcuts = shortcuts.reduce((groups, shortcut) => {
    if (!groups[shortcut.category]) {
      groups[shortcut.category] = []
    }
    groups[shortcut.category].push(shortcut)
    return groups
  }, {} as Record<string, Shortcut[]>)

  return (
    <Modal
      title={
        <Space>
          <KeyOutlined />
          <span>键盘快捷键</span>
        </Space>
      }
      open={visible}
      onCancel={() => setVisible(false)}
      footer={[
        <Tag key="tip" icon={<InfoCircleOutlined />} color="blue">
          提示：按 F1 键快速打开此帮助
        </Tag>
      ]}
      width={600}
    >
      {Object.entries(groupedShortcuts).map(([category, items]) => (
        <div key={category} style={{ marginBottom: 24 }}>
          <Typography.Title level={5}>{category}</Typography.Title>
          <List
            dataSource={items}
            renderItem={item => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color="blue">{item.key}</Tag>
                      <span>{item.description}</span>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
          <Divider />
        </div>
      ))}
    </Modal>
  )
}
