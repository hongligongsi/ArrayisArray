import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Badge, Dropdown, Button, Avatar, theme, Space, Switch, Tooltip, Drawer, Modal, Form, Input, message } from 'antd'
import {
  DashboardOutlined,
  DatabaseOutlined,
  TableOutlined,
  CodeOutlined,
  FileTextOutlined,
  WarningOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  AuditOutlined,
  ShoppingCartOutlined,
  SafetyOutlined,
  CustomerServiceOutlined,
  SunOutlined,
  MoonOutlined,
  ToolOutlined,
  CrownOutlined,
  DollarOutlined,
  MessageOutlined,
  SettingOutlined,
  BarChartOutlined,
  KeyOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { authApi } from '../api'
import TabManager from '../components/TabManager'
import KeyboardShortcuts from '../components/KeyboardShortcuts'

const { Sider, Content, Header } = Layout

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false)
  const [changePasswordForm] = Form.useForm()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
  }, [])

  const toggleTheme = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    localStorage.setItem('theme', newMode ? 'dark' : 'light')
  }

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch { }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  const handleChangePassword = async () => {
    try {
      const values = await changePasswordForm.validateFields()
      await authApi.changePassword(values)
      message.success('密码修改成功，请重新登录')
      setChangePasswordModalVisible(false)
      handleLogout()
    } catch (err: any) {
      message.error(err.message || '密码修改失败')
    }
  }

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表板' },
    { key: '/analytics', icon: <BarChartOutlined />, label: '统计分析' },
    { type: 'divider' as const },
    { key: '/tools', icon: <ToolOutlined />, label: '工具管理' },
    { key: '/membership', icon: <CrownOutlined />, label: '会员套餐' },
    { key: '/ads', icon: <DollarOutlined />, label: '广告配置' },
    { key: '/feedback', icon: <MessageOutlined />, label: '反馈管理' },
    { key: '/integrations', icon: <LinkOutlined />, label: '第三方集成' },
    { key: '/open-api', icon: <KeyOutlined />, label: '开放API' },
    { key: '/operations', icon: <BarChartOutlined />, label: '运维优化' },
    { key: '/system', icon: <SettingOutlined />, label: '系统配置' },
    { type: 'divider' as const },
    { key: '/tables', icon: <DatabaseOutlined />, label: '表结构管理' },
    { key: '/data', icon: <TableOutlined />, label: '数据浏览' },
    { key: '/query', icon: <CodeOutlined />, label: 'SQL 查询' },
    { type: 'divider' as const },
    { key: '/content', icon: <AuditOutlined />, label: '内容审核' },
    { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单管理' },
    { key: '/permissions', icon: <SafetyOutlined />, label: '权限管理' },
    { key: '/customer-service', icon: <CustomerServiceOutlined />, label: '客服系统' },
    { type: 'divider' as const },
    { key: '/logs/operations', icon: <FileTextOutlined />, label: '操作日志' },
    { key: '/logs/errors', icon: <WarningOutlined />, label: '异常日志' },
  ]

  const selectedKeys = [location.pathname]

  const userMenu = {
    items: [
      { key: 'changePassword', icon: <KeyOutlined />, label: '修改密码', onClick: () => setChangePasswordModalVisible(true) },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
    ],
  }

  const { token: { colorBgContainer, borderRadiusLG, colorPrimary, colorSuccess, colorWarning, colorError } } = theme.useToken()

  return (
    <Layout style={{ minHeight: '100vh', background: darkMode ? '#1f1f2f' : '#f0f2f5' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={60}
        theme={darkMode ? 'dark' : 'light'}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
          boxShadow: darkMode ? '2px 0 8px rgba(0,0,0,0.3)' : '2px 0 8px rgba(0,0,0,0.08)',
          borderRight: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
        }}
      >
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          borderBottom: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)',
          background: darkMode ? 'linear-gradient(135deg, #165DFF 0%, #0d6efd 100%)' : 'linear-gradient(135deg, #165DFF 0%, #0d6efd 100%)'
        }}>
          <DatabaseOutlined style={{ fontSize: 22, color: '#fff' }} />
          {!collapsed && <span style={{ color: '#fff', marginLeft: 12, fontWeight: 600, fontSize: 17, whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>DataHub</span>}
        </div>
        <Menu
          theme={darkMode ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            borderRight: 0,
            background: 'transparent',
            fontSize: 14
          }}
        />
      </Sider>
      <Layout style={{
        marginLeft: collapsed ? 60 : 220,
        transition: 'margin-left 0.2s ease-in-out',
        background: darkMode ? '#1a1a2a' : '#f0f2f5'
      }}>
        <Header style={{
          padding: '0 24px',
          background: darkMode ? '#252526' : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)',
          position: 'sticky',
          top: 0,
          zIndex: 9,
          height: 64,
          boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 4px rgba(0,0,0,0.04)'
        }}>
          <Space size="middle">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: 18,
                width: 48,
                height: 48,
                color: darkMode ? '#8c8cf8' : '#595959',
                borderRadius: 8,
                transition: 'all 0.2s'
              }}
            />
            <Switch
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
              checked={darkMode}
              onChange={toggleTheme}
              style={{
                marginLeft: 16,
                minWidth: 88
              }}
            />
            <Tooltip title="快捷键帮助 (F1)">
              <Button
                type="text"
                icon={<KeyOutlined />}
                style={{
                  fontSize: 16,
                  width: 48,
                  height: 48,
                  color: darkMode ? '#8c8cf8' : '#595959',
                  borderRadius: 8,
                  transition: 'all 0.2s'
                }}
                onClick={() => {
                  // 触发快捷键帮助
                  const event = new KeyboardEvent('keydown', { key: 'F1', bubbles: true })
                  window.dispatchEvent(event)
                }}
              />
            </Tooltip>
          </Space>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Button type="text" style={{ height: 48, borderRadius: 8 }}>
              <Space size="small">
                <Badge status="success" />
                <span style={{
                  display: 'inline-block',
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 14,
                  color: darkMode ? '#e8e8e5' : '#262626'
                }}>
                  {user?.nickname || user?.username || '用户'}
                </span>
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  style={{ backgroundColor: colorPrimary, boxShadow: '0 2px 8px rgba(22,101,52,0.15)' }}
                />
              </Space>
            </Button>
          </Dropdown>
        </Header>
        <Content style={{
          margin: 16,
          padding: 24,
          background: darkMode ? '#1a1a2a' : '#ffffff',
          borderRadius: borderRadiusLG,
          overflow: 'auto',
          minHeight: 'calc(100vh - 80px)',
          boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <TabManager />
          <Outlet />
          <KeyboardShortcuts />
        </Content>
      </Layout>{/* 移动端菜单抽屉 */}<Drawer
        title="菜单"
        placement="left"
        size={280}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        styles={{
          body: { padding: 0, background: darkMode ? '#1f1f2f' : '#ffffff' },
          header: {
            background: darkMode ? 'linear-gradient(135deg, #165DFF 0%, #0d6efd 100%)' : 'linear-gradient(135deg, #165DFF 0%, #0d6efd 100%)',
            color: '#fff',
            borderBottom: 0
          }
        }}
      ><div style={{
        padding: '20px 0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}><div style={{
        padding: '0 20px 20px',
        borderBottom: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)'
      }}><div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 16
      }}><DatabaseOutlined style={{ fontSize: 24, color: '#165DFF', marginRight: 12 }} /><span style={{ fontSize: 18, fontWeight: 600, color: darkMode ? '#fff' : '#262626' }}>DataHub</span></div><div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}><span style={{ fontSize: 14, color: darkMode ? '#8c8cf8' : '#595959' }}>主题模式</span><Switch
                checkedChildren={<MoonOutlined />}
                unCheckedChildren={<SunOutlined />}
                checked={darkMode}
                onChange={toggleTheme}
                size="small"
              /></div></div><Menu
            theme={darkMode ? 'dark' : 'light'}
            mode="inline"
            selectedKeys={selectedKeys}
            items={menuItems}
            onClick={({ key }) => {
              navigate(key)
              setMobileMenuOpen(false)
            }}
            style={{
              borderRight: 0,
              background: 'transparent',
              fontSize: 14,
              flex: 1
            }}
          /></div></Drawer>
      <Modal
        title="修改密码"
        open={changePasswordModalVisible}
        onCancel={() => setChangePasswordModalVisible(false)}
        onOk={handleChangePassword}
        width={500}
      >
        <Form form={changePasswordForm} layout="vertical">
          <Form.Item
            name="oldPassword"
            label="原密码"
            rules={[
              { required: true, message: '请输入原密码' },
            ]}
          >
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度至少6位' },
              { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: '密码必须包含字母和数字' },
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位，包含字母和数字）" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
