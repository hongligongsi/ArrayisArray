import { useState, useCallback } from 'react'
import { message } from 'antd'

interface ErrorHandler {
  error: Error | null
  isLoading: boolean
  handleError: (error: any, customMessage?: string) => void
  clearError: () => void
  setLoading: (loading: boolean) => void
}

export function useErrorHandler(): ErrorHandler {
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleError = useCallback((error: any, customMessage?: string) => {
    console.error('Error:', error)
    
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

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading)
  }, [])

  return {
    error,
    isLoading,
    handleError,
    clearError,
    setLoading,
  }
}