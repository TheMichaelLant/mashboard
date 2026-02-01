import { forwardRef, ButtonHTMLAttributes } from 'react';
import { LucideIcon } from 'lucide-react';

type Variant = 'default' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  variant?: Variant;
  size?: Size;
  label?: string;
}

const variantStyles: Record<Variant, string> = {
  default: 'bg-ink-800 border border-ink-700 text-ink-400 hover:bg-ink-700 hover:text-ink-200',
  danger: 'bg-ink-800 text-ink-400 hover:bg-red-900/50 hover:text-red-400',
  ghost: 'text-ink-400 hover:text-ink-200 hover:bg-ink-800',
};

const sizeStyles: Record<Size, { button: string; icon: number }> = {
  sm: { button: 'p-1.5 rounded-md', icon: 14 },
  md: { button: 'p-2 rounded-lg', icon: 16 },
  lg: { button: 'p-2.5 rounded-lg', icon: 18 },
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, variant = 'default', size = 'md', label, className = '', ...props }, ref) => {
    const variantClass = variantStyles[variant];
    const { button: sizeClass, icon: iconSize } = sizeStyles[size];

    return (
      <button
        ref={ref}
        className={`${sizeClass} ${variantClass} transition-colors ${className}`}
        title={label}
        aria-label={label}
        {...props}
      >
        <Icon size={iconSize} />
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
