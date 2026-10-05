import React from 'react'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rect' | 'circle'
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  className = '',
  ...props
}) => {
  const variantStyles = {
    text: 'h-4 w-full rounded',
    rect: 'h-24 w-full rounded-md',
    circle: 'h-10 w-10 rounded-full',
  }[variant]

  return (
    <div
      className={`animate-pulse bg-zinc-800/60 rounded-md ${variantStyles} ${className}`}
      {...props}
    />
  )
}
