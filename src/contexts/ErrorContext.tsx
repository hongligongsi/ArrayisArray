import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react'
import { message } from 'antd'

interface ErrorContextType {
  error: Error | null
  setError: (error: Error | null) => void
  handleError: (error: any, customMessage?: string) => void
  clearError: () => void
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined)

interface ErrorProviderProps {
  children: ReactNode
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const [error, setError] = useState<Error | null>(null)

  const handleError = useCallback((error: any, customMessage?: string) => {
    console.error('Global error:', error)
    
    const errorMessage = customMessage || 
      error?.response?.data?.message || 
      error?.message || 
      '操作失败，请稍后重试'

    message.error(errorMessage)
    setError(error instanceof Error ? error : new Error(errorMessage))
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (<ErrorContext.Provider value={{ error, setError, handleError, clearError }}>{children}</ErrorContext.Provider>)
}

export function useError() {
  const context = useContext(ErrorContext)
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider')
  }
  return context
}