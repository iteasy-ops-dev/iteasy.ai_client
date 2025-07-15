'use client'

import { useState, useEffect } from 'react'
import { useSettingsStore } from '@/app/store/settings-store'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import { Eye, EyeOff, Check, X, Settings, Monitor, Sun, Moon, Type, Server } from 'lucide-react'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const {
    apiKey,
    model,
    temperature,
    maxTokens,
    theme: storeTheme,
    font: storeFont,
    llmProvider,
    localLLMEndpoint,
    localLLMModel,
    setApiKey,
    setModel,
    setTemperature,
    setMaxTokens,
    setTheme: setStoreTheme,
    setFont: setStoreFont,
    setLLMProvider,
    setLocalLLMEndpoint,
    setLocalLLMModel,
    validateApiKey,
    resetSettings,
  } = useSettingsStore()

  const [activeTab, setActiveTab] = useState('ai')
  const [localApiKey, setLocalApiKey] = useState('')
  const [localModel, setLocalModel] = useState('')
  const [localTemperature, setLocalTemperature] = useState(0.7)
  const [localMaxTokens, setLocalMaxTokens] = useState(1000)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<'success' | 'error' | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(storeTheme)
  const [font, setFont] = useState<'inter' | 'noto-sans-kr' | 'open-sans' | 'roboto' | 'poppins' | 'nunito' | 'comfortaa' | 'quicksand' | 'lato' | 'source-sans-3' | 'noto-serif-kr' | 'ibm-plex-sans-kr'>(storeFont)
  const [localProvider, setLocalProvider] = useState<'openai' | 'custom'>(llmProvider === 'local' || llmProvider === 'ollama' ? 'custom' : 'openai')
  const [localEndpoint, setLocalEndpoint] = useState(localLLMEndpoint)
  const [localModelName, setLocalModelName] = useState(localLLMModel)

  // Load current settings when modal opens
  useEffect(() => {
    if (open) {
      setLocalApiKey(apiKey)
      setLocalModel(model)
      setLocalTemperature(temperature)
      setLocalMaxTokens(maxTokens)
      setValidationResult(null)
      setTheme(storeTheme)
      setFont(storeFont)
      setLocalProvider(llmProvider === 'local' || llmProvider === 'ollama' ? 'custom' : 'openai')
      setLocalEndpoint(localLLMEndpoint)
      setLocalModelName(localLLMModel)
    }
  }, [open, apiKey, model, temperature, maxTokens, storeTheme, storeFont, llmProvider, localLLMEndpoint, localLLMModel])

  const handleValidateApiKey = async () => {
    if (!localApiKey.trim()) return

    setIsValidating(true)
    setValidationResult(null)

    try {
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: localApiKey }),
      })

      if (response.ok) {
        setValidationResult('success')
      } else {
        setValidationResult('error')
      }
    } catch (error) {
      setValidationResult('error')
    } finally {
      setIsValidating(false)
    }
  }

  const handleSave = () => {
    setApiKey(localApiKey)
    setModel(localModel)
    setTemperature(localTemperature)
    setMaxTokens(localMaxTokens)
    setStoreTheme(theme)
    // Convert custom back to the original provider types for store
    const storeProvider = localProvider === 'custom' ? 'local' : localProvider
    setLLMProvider(storeProvider)
    setLocalLLMEndpoint(localEndpoint)
    setLocalLLMModel(localModelName)
    
    onOpenChange(false)
  }

  const handleTestLocalConnection = async () => {
    if (!localEndpoint.trim()) return

    setIsValidating(true)
    setValidationResult(null)

    try {
      // Determine if this is an Ollama endpoint by checking the URL
      const isOllamaEndpoint = localEndpoint.includes('11434') || localEndpoint.includes('ollama')
      
      if (isOllamaEndpoint) {
        // Test Ollama connection with /api/version endpoint
        const versionUrl = localEndpoint.replace(/\/api\/(generate|chat).*$/, '') + '/api/version'
        const response = await fetch(versionUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        })

        if (response.ok) {
          const data = await response.json()
          console.log('Ollama version:', data)
          setValidationResult('success')
        } else {
          setValidationResult('error')
        }
      } else {
        // Test custom LLM endpoint with a simple generate request
        const response = await fetch(localEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: localModelName || 'test',
            prompt: 'test',
            max_tokens: 1,
          }),
          signal: AbortSignal.timeout(5000),
        })

        if (response.ok || response.status === 422) {
          // 422 might be returned for invalid model but endpoint is reachable
          setValidationResult('success')
        } else {
          setValidationResult('error')
        }
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      setValidationResult('error')
    } finally {
      setIsValidating(false)
    }
  }

  const handleReset = () => {
    if (activeTab === 'ai') {
      setLocalApiKey('')
      setLocalModel('gpt-3.5-turbo')
      setLocalTemperature(0.7)
      setLocalMaxTokens(1000)
      setLocalProvider('openai')
      setLocalEndpoint('http://localhost:11434/api/generate')
      setLocalModelName('llama2')
      resetSettings()
    } else if (activeTab === 'theme') {
      setTheme('system')
      setStoreTheme('system')
    }
  }


  const isApiKeyValid = localApiKey.length > 0 && localApiKey.startsWith('sk-')

  const tabs = [
    { id: 'ai', label: 'AI Configuration', icon: Settings },
    { id: 'theme', label: 'Theme', icon: Monitor },
    { id: 'font', label: 'Font', icon: Type },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full mx-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex h-[500px]">
          {/* Sidebar */}
          <div className="w-64 border-r border-border bg-muted/20 flex flex-col">
            <nav className="p-4 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">AI Configuration</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure your AI provider and connection settings.
                  </p>
                </div>

                {/* Provider Selection */}
                <div className="space-y-4">
                  <Label>Provider</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { value: 'openai', label: 'OpenAI', description: 'GPT models via API' },
                      { value: 'custom', label: 'Custom LLM', description: 'Local or custom endpoints (Ollama, etc.)' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setLocalProvider(option.value as 'openai' | 'custom')
                          setValidationResult(null) // Reset test connection status
                        }}
                        className={`p-4 border rounded-lg text-left space-y-2 transition-colors ${
                          localProvider === option.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Server className="h-5 w-5" />
                          <span className="font-medium">{option.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* OpenAI Settings */}
                {localProvider === 'openai' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">OpenAI API Key</Label>
                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            id="apiKey"
                            type={showApiKey ? 'text' : 'password'}
                            value={localApiKey}
                            onChange={(e) => setLocalApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleValidateApiKey}
                            disabled={!isApiKeyValid || isValidating}
                          >
                            {isValidating ? 'Validating...' : 'Test Connection'}
                          </Button>
                          
                          {validationResult === 'success' && (
                            <div className="flex items-center text-green-600 text-sm">
                              <Check className="h-4 w-4 mr-1" />
                              Connected
                            </div>
                          )}
                          
                          {validationResult === 'error' && (
                            <div className="flex items-center text-red-600 text-sm">
                              <X className="h-4 w-4 mr-1" />
                              Connection Failed
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Get your API key from{' '}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          OpenAI Platform
                        </a>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="model">Model</Label>
                      <Select value={localModel} onValueChange={setLocalModel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Custom LLM Settings */}
                {localProvider === 'custom' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="endpoint">Endpoint URL</Label>
                      <Input
                        id="endpoint"
                        value={localEndpoint}
                        onChange={(e) => setLocalEndpoint(e.target.value)}
                        placeholder="http://localhost:11434/api/generate"
                      />
                      <p className="text-xs text-muted-foreground">
                        For Ollama: <code>http://localhost:11434/api/generate</code><br/>
                        For other custom endpoints: Your API endpoint URL
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="localModel">Model Name</Label>
                      <Input
                        id="localModel"
                        value={localModelName}
                        onChange={(e) => setLocalModelName(e.target.value)}
                        placeholder="llama2"
                      />
                      <p className="text-xs text-muted-foreground">
                        Common Ollama models: <code>llama2</code>, <code>mistral</code>, <code>llama3</code>, <code>codellama</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleTestLocalConnection}
                        disabled={!localEndpoint || isValidating}
                      >
                        {isValidating ? 'Testing...' : 'Test Connection'}
                      </Button>
                      
                      {validationResult === 'success' && (
                        <div className="flex items-center text-green-600 text-sm">
                          <Check className="h-4 w-4 mr-1" />
                          Connected
                        </div>
                      )}
                      
                      {validationResult === 'error' && (
                        <div className="flex items-center text-red-600 text-sm">
                          <X className="h-4 w-4 mr-1" />
                          Connection Failed
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Common Settings */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="temperature">
                      Temperature: {localTemperature}
                    </Label>
                    <input
                      id="temperature"
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={localTemperature}
                      onChange={(e) => setLocalTemperature(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Precise</span>
                      <span>Creative</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxTokens">Max Tokens</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      min="1"
                      max="4000"
                      value={localMaxTokens}
                      onChange={(e) => setLocalMaxTokens(parseInt(e.target.value) || 1000)}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={handleReset}>
                    Reset AI Settings
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'theme' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Appearance</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose how the application looks. You can select a theme that matches your preferences.
                  </p>
                </div>

                <div className="space-y-4">
                  <Label>Theme</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { value: 'light', label: 'Light', icon: Sun, description: 'Light mode' },
                      { value: 'dark', label: 'Dark', icon: Moon, description: 'Dark mode' },
                      { value: 'system', label: 'System', icon: Monitor, description: 'Use system setting' },
                    ].map((option) => {
                      const Icon = option.icon
                      return (
                        <button
                          key={option.value}
                          onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
                          className={`p-4 border rounded-lg text-left space-y-2 transition-colors ${
                            theme === option.value
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-accent/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-5 w-5" />
                            <span className="font-medium">{option.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Theme Action Buttons */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={handleReset}>
                    Reset Theme
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'font' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Typography</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose the font family that makes reading comfortable for you.
                  </p>
                </div>

                <div className="space-y-4">
                  <Label>Font Family</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { value: 'inter', label: 'Inter', description: 'Modern and clean' },
                      { value: 'noto-sans-kr', label: 'Noto Sans KR', description: 'Korean optimized' },
                      { value: 'open-sans', label: 'Open Sans', description: 'Friendly and readable' },
                      { value: 'roboto', label: 'Roboto', description: 'Google Material Design' },
                      { value: 'poppins', label: 'Poppins', description: 'Geometric and modern' },
                      { value: 'nunito', label: 'Nunito', description: 'Rounded and soft' },
                      { value: 'comfortaa', label: 'Comfortaa', description: 'Very rounded and comfortable' },
                      { value: 'quicksand', label: 'Quicksand', description: 'Light and airy' },
                      { value: 'lato', label: 'Lato', description: 'Humanist and warm' },
                      { value: 'source-sans-3', label: 'Source Sans 3', description: 'Professional and clear' },
                      { value: 'noto-serif-kr', label: 'Noto Serif KR', description: 'Korean serif, elegant' },
                      { value: 'ibm-plex-sans-kr', label: 'IBM Plex Sans KR', description: 'Technical and modern' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setFont(option.value as typeof font)}
                        className={`p-4 border rounded-lg text-left space-y-2 transition-colors ${
                          font === option.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-accent/50'
                        }`}
                        style={{ fontFamily: option.value === 'inter' ? 'var(--font-inter), var(--font-noto-sans-kr)' : 
                                             option.value === 'noto-sans-kr' ? 'var(--font-noto-sans-kr)' :
                                             option.value === 'open-sans' ? 'var(--font-open-sans), var(--font-noto-sans-kr)' :
                                             option.value === 'roboto' ? 'var(--font-roboto), var(--font-noto-sans-kr)' :
                                             option.value === 'poppins' ? 'var(--font-poppins), var(--font-noto-sans-kr)' :
                                             option.value === 'nunito' ? 'var(--font-nunito), var(--font-noto-sans-kr)' :
                                             option.value === 'comfortaa' ? 'var(--font-comfortaa), var(--font-noto-sans-kr)' :
                                             option.value === 'quicksand' ? 'var(--font-quicksand), var(--font-noto-sans-kr)' :
                                             option.value === 'lato' ? 'var(--font-lato), var(--font-noto-sans-kr)' :
                                             option.value === 'source-sans-3' ? 'var(--font-source-sans-3), var(--font-noto-sans-kr)' :
                                             option.value === 'noto-serif-kr' ? 'var(--font-noto-serif-kr)' :
                                             option.value === 'ibm-plex-sans-kr' ? 'var(--font-ibm-plex-sans-kr)' : 'inherit' }}
                      >
                        <div className="flex items-center gap-2">
                          <Type className="h-5 w-5" />
                          <span className="font-medium">{option.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                        <p className="text-sm">The quick brown fox jumps over the lazy dog</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Action Buttons */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setFont('inter')}>
                    Reset Font
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => {
                      setStoreFont(font)
                      onOpenChange(false)
                    }}>
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}