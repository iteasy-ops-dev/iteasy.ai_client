'use client'

import { memo } from 'react'

interface WaveTextProps {
  text: string
  className?: string
  duration?: number
  delay?: number
}

const WaveText = memo(function WaveText({ 
  text, 
  className = '', 
  duration = 1.2, 
  delay = 0.08 
}: WaveTextProps) {
  const chars = text.split('')
  
  return (
    <span className={`inline-flex ${className}`}>
      {chars.map((char, index) => (
        <span
          key={index}
          className="inline-block animate-bounce"
          style={{
            animationDelay: `${index * delay}s`,
            animationDuration: `${duration}s`,
            animationIterationCount: 'infinite',
            // Preserve space for space characters
            minWidth: char === ' ' ? '0.25em' : 'auto'
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  )
})

export default WaveText