import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/app/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface DialogContentProps {
  className?: string
  children: React.ReactNode
}

interface DialogHeaderProps {
  children: React.ReactNode
}

interface DialogTitleProps {
  children: React.ReactNode
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50 w-full max-w-screen-lg">
        {children}
      </div>
    </div>
  )
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'w-full bg-background p-6 rounded-lg border shadow-lg',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ children }: DialogHeaderProps) => (
  <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
    {children}
  </div>
)

const DialogTitle = ({ children }: DialogTitleProps) => (
  <h3 className="text-lg font-semibold leading-none tracking-tight">
    {children}
  </h3>
)

export { Dialog, DialogContent, DialogHeader, DialogTitle }