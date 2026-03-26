import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils/cn'

const titleVariants = cva('font-bold tracking-tight', {
  variants: {
    size: {
      h1: 'text-4xl md:text-5xl',
      h2: 'text-3xl md:text-4xl',
      h3: 'text-2xl md:text-3xl',
      h4: 'text-xl md:text-2xl',
    },
  },
  defaultVariants: {
    size: 'h1',
  },
})

export interface TitleProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof titleVariants> {
  as?: 'h1' | 'h2' | 'h3' | 'h4'
}

function Title({ className, size, as, children, ...props }: TitleProps) {
  const Component = as || size || 'h1'
  return (
    <Component
      className={cn(titleVariants({ size, className }))}
      {...props}
    >
      {children}
    </Component>
  )
}

export { Title, titleVariants }
