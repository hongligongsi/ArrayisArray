import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import TableManager from './pages/TableManager'
import DataBrowser from './pages/DataBrowser'
import SqlQuery from './pages/SqlQuery'
import OperationLogs from './pages/OperationLogs'
import ErrorLogs from './pages/ErrorLogs'
import ContentAudit from './pages/ContentAudit'
import OrderManagement from './pages/OrderManagement'
import PermissionManagement from './pages/PermissionManagement'
import CustomerService from './pages/CustomerService'
import ToolManagement from './pages/ToolManagement'
import MembershipManagement from './pages/MembershipManagement'
import AdManagement from './pages/AdManagement'
import FeedbackManagement from './pages/FeedbackManagement'
import SystemConfig from './pages/SystemConfig'
import Analytics from './pages/Analytics'
import ThirdPartyIntegration from './pages/ThirdPartyIntegration'
import OpenApiManagement from './pages/OpenApiManagement'
import OperationsManagement from './pages/OperationsManagement'
import { useState, useEffect } from 'react'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    const handleStorageChange = () => {
      setDarkMode(localStorage.getItem('theme') === 'dark')
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#165DFF',
          colorSuccess: '#00B42A',
          colorWarning: '#FF7D00',
          colorError: '#F53F3F',
          colorInfo: '#165DFF',
          borderRadius: 8,
          borderRadiusLG: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          boxShadowSecondary: '0 2px 4px rgba(0, 0, 0, 0.04)',
          motion: true,
          motionDurationFast: '0.1s',
          motionDurationMid: '0.2s',
          motionDurationSlow: '0.3s',
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="tables" element={<TableManager />} />
            <Route path="data" element={<DataBrowser />} />
            <Route path="query" element={<SqlQuery />} />
            <Route path="content" element={<ContentAudit />} />
            <Route path="orders" element={<OrderManagement />} />
            <Route path="permissions" element={<PermissionManagement />} />
            <Route path="customer-service" element={<CustomerService />} />
            <Route path="tools" element={<ToolManagement />} />
            <Route path="membership" element={<MembershipManagement />} />
            <Route path="ads" element={<AdManagement />} />
            <Route path="feedback" element={<FeedbackManagement />} />
            <Route path="system" element={<SystemConfig />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="integrations" element={<ThirdPartyIntegration />} />
            <Route path="open-api" element={<OpenApiManagement />} />
            <Route path="operations" element={<OperationsManagement />} />
            <Route path="logs/operations" element={<OperationLogs />} />
            <Route path="logs/errors" element={<ErrorLogs />} />
            <Route path="*" element={
              <div style={{ textAlign: 'center', padding: 100 }}>
                <h2>404</h2>
                <p>页面不存在</p>
              </div>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
