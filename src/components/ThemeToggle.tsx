import React from 'react'
import { Switch, Tooltip } from 'antd'
import { MoonOutlined, SunOutlined } from '@ant-design/icons'

interface ThemeToggleProps {
  darkMode: boolean
  onChange: (checked: boolean) => void
}

export default function ThemeToggle({ darkMode, onChange }: ThemeToggleProps) {
  const handleChange = (checked: boolean) => {
    onChange(checked)
    localStorage.setItem('theme', checked ? 'dark' : 'light')
  }

  return (<Tooltip title={darkMode ? '切换到浅色模式' : '切换到深色模式'}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{darkMode ? (<MoonOutlined style={{ fontSize: 16 }} />) : (<SunOutlined style={{ fontSize: 16 }} />)}<Switch
          checked={darkMode}
          onChange={handleChange}
          checkedChildren={<MoonOutlined />}
          unCheckedChildren={<SunOutlined />}
          size="small"
        /></div></Tooltip>)
}