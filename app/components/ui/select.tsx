import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/app/lib/utils'

interface SelectContextType {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SelectContext = React.createContext<SelectContextType | undefined>(undefined)

const useSelectContext = () => {
  const context = React.useContext(SelectContext)
  if (!context) {
    throw new Error('Select components must be used within a Select provider')
  }
  return context
}

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}

interface SelectContentProps {
  children: React.ReactNode
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
}

interface SelectTriggerProps {
  className?: string
  children: React.ReactNode
}

interface SelectValueProps {
  placeholder?: string
}

const Select = ({ value, onValueChange, children }: SelectProps) => {
  const [open, setOpen] = React.useState(false)
  
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen } = useSelectContext()
    
    const handleClick = () => {
      setOpen(!open)
    }
    
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    )
  }
)
SelectTrigger.displayName = 'SelectTrigger'

const SelectValue = ({ placeholder }: SelectValueProps) => {
  const { value } = useSelectContext()
  return <span>{value || placeholder}</span>
}
SelectValue.displayName = 'SelectValue'

const SelectContent = ({ children }: SelectContentProps) => {
  const { open } = useSelectContext()
  
  if (!open) return null
  
  return (
    <div className="absolute top-full left-0 z-50 w-full mt-1 bg-background border rounded-md shadow-md">
      {children}
    </div>
  )
}
SelectContent.displayName = 'SelectContent'

const SelectItem = ({ value, children }: SelectItemProps) => {
  const { onValueChange, setOpen } = useSelectContext()
  
  const handleClick = () => {
    onValueChange(value)
    setOpen(false)
  }
  
  return (
    <div
      className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
      onClick={handleClick}
    >
      {children}
    </div>
  )
}
SelectItem.displayName = 'SelectItem'

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }