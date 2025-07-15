'use client'

import React from 'react'
import { useChatStoreStats } from '@/app/store/normalized-chat-store'

export function PerformanceMonitor() {
  const chatStats = useChatStoreStats()

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const memoryUsage = (performance as any).memory?.usedJSHeapSize / 1024 / 1024

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-3 rounded-lg font-mono z-50">
      <div className="space-y-1">
        <div className="text-green-400 font-bold">Dev Monitor</div>
        {memoryUsage && (
          <div>Memory: {memoryUsage.toFixed(1)}MB</div>
        )}
        {chatStats && (
          <>
            <div className="text-blue-400 font-bold mt-2">Store Stats</div>
            <div>Chats: {chatStats.totalChats}</div>
            <div>Messages: {chatStats.totalMessages}</div>
            <div>Avg/Chat: {chatStats.averageMessagesPerChat.toFixed(1)}</div>
            <div>Store Size: {chatStats.memoryEstimate}</div>
          </>
        )}
      </div>
    </div>
  )
}

// React DevTools Profiler wrapper
export function withProfiler<T extends object>(
  Component: React.ComponentType<T>,
  componentName: string
) {
  if (process.env.NODE_ENV !== 'development') {
    return Component
  }

  const ProfiledComponent = (props: T) => {
    const onRender = (
      _id: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      console.log(`⚡ ${componentName} ${phase}:`, {
        actualDuration: `${actualDuration.toFixed(2)}ms`,
        baseDuration: `${baseDuration.toFixed(2)}ms`,
        startTime: `${startTime.toFixed(2)}ms`,
        commitTime: `${commitTime.toFixed(2)}ms`,
      })
    }

    return (
      <React.Profiler id={componentName} onRender={onRender}>
        <Component {...props} />
      </React.Profiler>
    )
  }

  ProfiledComponent.displayName = `withProfiler(${componentName})`
  return ProfiledComponent
}