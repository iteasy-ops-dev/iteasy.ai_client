'use client'

import { useState, useEffect } from 'react'
import { useSettingsStore } from '@/app/store/settings-store'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import { Eye, EyeOff, Check, X } from 'lucide-react'

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
    setApiKey,
    setModel,
    setTemperature,
    setMaxTokens,
    validateApiKey,
    resetSettings,
  } = useSettingsStore()

  const [localApiKey, setLocalApiKey] = useState('')
  const [localModel, setLocalModel] = useState('')
  const [localTemperature, setLocalTemperature] = useState(0.7)
  const [localMaxTokens, setLocalMaxTokens] = useState(1000)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<'success' | 'error' | null>(null)

  // Load current settings when modal opens
  useEffect(() => {
    if (open) {
      setLocalApiKey(apiKey)
      setLocalModel(model)
      setLocalTemperature(temperature)
      setLocalMaxTokens(maxTokens)
      setValidationResult(null)
    }
  }, [open, apiKey, model, temperature, maxTokens])

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
    onOpenChange(false)
  }

  const handleReset = () => {
    setLocalApiKey('')
    setLocalModel('gpt-3.5-turbo')
    setLocalTemperature(0.7)
    setLocalMaxTokens(1000)
    resetSettings()
  }

  const isApiKeyValid = localApiKey.length > 0 && localApiKey.startsWith('sk-')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full mx-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* API Key Section */}
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
                  {isValidating ? 'Validating...' : 'Validate Key'}
                </Button>
                
                {validationResult === 'success' && (
                  <div className="flex items-center text-green-600 text-sm">
                    <Check className="h-4 w-4 mr-1" />
                    Valid
                  </div>
                )}
                
                {validationResult === 'error' && (
                  <div className="flex items-center text-red-600 text-sm">
                    <X className="h-4 w-4 mr-1" />
                    Invalid
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

          {/* Model Selection */}
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

          {/* Temperature */}
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

          {/* Max Tokens */}
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

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleReset}>
              Reset
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
      </DialogContent>
    </Dialog>
  )
}