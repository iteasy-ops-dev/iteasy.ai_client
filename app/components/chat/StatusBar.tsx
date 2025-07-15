'use client'

import { useSettingsStore } from '@/app/store/settings-store'
import { Zap, ZapOff, Wifi, WifiOff } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function StatusBar() {
  const { 
    llmProvider, 
    model, 
    localLLMModel, 
    localLLMEndpoint, 
    apiKey,
    validateApiKey 
  } = useSettingsStore()
  
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown')
  const [isChecking, setIsChecking] = useState(false)

  // Get display values based on provider
  const getProviderDisplay = () => {
    switch (llmProvider) {
      case 'openai':
        return { name: 'OpenAI', model: model }
      case 'local':
      case 'ollama':
        return { name: 'Custom LLM', model: localLLMModel }
      default:
        return { name: 'Unknown', model: 'Unknown' }
    }
  }

  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600'
      case 'disconnected':
        return 'text-red-600'
      default:
        return 'text-muted-foreground'
    }
  }

  const getConnectionIcon = () => {
    if (isChecking) {
      return <Zap className="h-3 w-3 animate-pulse" />
    }
    
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-3 w-3" />
      case 'disconnected':
        return <WifiOff className="h-3 w-3" />
      default:
        return <ZapOff className="h-3 w-3" />
    }
  }

  // Check connection status
  useEffect(() => {
    const checkConnection = async () => {
      setIsChecking(true)
      
      try {
        if (llmProvider === 'openai') {
          if (!validateApiKey()) {
            setConnectionStatus('disconnected')
            return
          }
          
          // Test OpenAI API key with a minimal request
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
            },
          })
          
          setConnectionStatus(response.ok ? 'connected' : 'disconnected')
        } else {
          // Test local/ollama endpoint
          const response = await fetch(localLLMEndpoint.replace('/api/generate', '/api/tags'), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          })
          
          setConnectionStatus(response.ok ? 'connected' : 'disconnected')
        }
      } catch (error) {
        setConnectionStatus('disconnected')
      } finally {
        setIsChecking(false)
      }
    }

    checkConnection()
  }, [llmProvider, apiKey, localLLMEndpoint, validateApiKey])

  const { name: providerName, model: currentModel } = getProviderDisplay()

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b text-sm">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground">Provider:</span>
          <span className="font-medium">{providerName}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground">Model:</span>
          <span className="font-medium">{currentModel}</span>
        </div>
      </div>
      
      <div className={`flex items-center space-x-2 ${getConnectionColor()}`}>
        {getConnectionIcon()}
        <span className="text-xs">
          {isChecking 
            ? 'Checking...' 
            : connectionStatus === 'connected' 
              ? 'Connected' 
              : connectionStatus === 'disconnected'
                ? 'Disconnected'
                : 'Unknown'
          }
        </span>
      </div>
    </div>
  )
}