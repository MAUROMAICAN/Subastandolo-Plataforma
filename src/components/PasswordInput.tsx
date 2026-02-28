import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends React.ComponentProps<typeof Input> {
  /** Texto para aria-label del botón cuando la contraseña está oculta */
  showLabel?: string;
  /** Texto para aria-label del botón cuando la contraseña está visible */
  hideLabel?: string;
  /** Contenido opcional a la izquierda (ej: icono Lock) */
  startAdornment?: React.ReactNode;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showLabel = "Ver contraseña", hideLabel = "Ocultar contraseña", startAdornment, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="relative">
        {startAdornment && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
            {startAdornment}
          </div>
        )}
        <Input
          ref={ref}
          type={showPassword ? "text" : "password"}
          className={cn("pr-11", startAdornment && "pl-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((p) => !p)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
          tabIndex={-1}
          aria-label={showPassword ? hideLabel : showLabel}
          title={showPassword ? hideLabel : showLabel}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <Eye className="h-4 w-4 shrink-0" aria-hidden />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
