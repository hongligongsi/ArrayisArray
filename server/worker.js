import { parentPort } from 'worker_threads'

parentPort.on('message', (message) => {
  const { taskId, task } = message
  
  try {
    let result
    
    switch (task.type) {
      case 'sqlFormat':
        result = formatSQL(task.sql)
        break
      case 'dataProcessing':
        result = processData(task.data)
        break
      case 'heavyCalculation':
        result = heavyCalculation(task.params)
        break
      case 'fileProcessing':
        result = processFile(task.fileData)
        break
      default:
        result = { error: 'Unknown task type' }
    }
    
    parentPort.postMessage({ taskId, result })
  } catch (error) {
    parentPort.postMessage({ 
      taskId, 
      result: { error: error.message || 'Unknown error' } 
    })
  }
})

function formatSQL(sql) {
  try {
    const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'GROUP', 'ORDER', 'LIMIT', 'OFFSET', 'HAVING']
    let formatted = sql
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      formatted = formatted.replace(regex, `\n${keyword}`)
    })
    return { formatted }
  } catch (error) {
    return { error: error.message }
  }
}

function processData(data) {
  try {
    if (!Array.isArray(data)) {
      return { error: 'Data must be an array' }
    }
    
    const processed = data.map((item, index) => ({
      id: index + 1,
      ...item,
      processedAt: new Date().toISOString()
    }))
    
    return { processed, count: processed.length }
  } catch (error) {
    return { error: error.message }
  }
}

function heavyCalculation(params) {
  try {
    const { iterations = 1000000000 } = params
    let result = 0
    for (let i = 0; i < iterations; i++) {
      result += Math.sin(i) * Math.cos(i)
    }
    return { result: result.toFixed(2), iterations }
  } catch (error) {
    return { error: error.message }
  }
}

function processFile(fileData) {
  try {
    const lines = fileData.split('\n')
    const processed = lines.filter(line => line.trim()).map(line => line.trim())
    return { lines: processed.length, content: processed.slice(0, 10) }
  } catch (error) {
    return { error: error.message }
  }
}
