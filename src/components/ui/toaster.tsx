import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { CircleCheck, XCircle, AlertTriangle, Info } from "lucide-react";

function ToastIcon({ variant }: { variant?: string }) {
  if (variant === "destructive") {
    return (
      <div className="shrink-0 w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center">
        <XCircle className="h-4 w-4 text-red-400" />
      </div>
    );
  }
  if (variant === "success") {
    return (
      <div className="shrink-0 w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center">
        <CircleCheck className="h-4 w-4 text-green-400" />
      </div>
    );
  }
  if (variant === "warning") {
    return (
      <div className="shrink-0 w-8 h-8 rounded-full bg-yellow-400/15 flex items-center justify-center">
        <AlertTriangle className="h-4 w-4 text-yellow-400" />
      </div>
    );
  }
  return (
    <div className="shrink-0 w-8 h-8 rounded-full bg-blue-400/15 flex items-center justify-center">
      <Info className="h-4 w-4 text-blue-400" />
    </div>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={4000}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="flex items-start gap-4 rounded-2xl border border-white/20 bg-black/75 backdrop-blur-2xl text-white shadow-[0_8px_30px_rgb(0,0,0,0.5)] px-4 py-3.5 pr-10 pointer-events-auto">
            <ToastIcon variant={props.variant} />
            <div className="flex-1 min-w-0 pt-0.5">
              {title && <ToastTitle className="text-sm font-semibold text-white leading-tight">{title}</ToastTitle>}
              {description && <ToastDescription className="text-xs text-white/50 mt-0.5 leading-relaxed">{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose className="text-white/40 hover:text-white/90 transition-colors focus:opacity-100 focus:outline-none focus:ring-opacity-0" />
          </Toast>
        );
      })}
      <ToastViewport className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[90vw] max-w-sm z-[9999] flex flex-col gap-3 pointer-events-none" />
    </ToastProvider>
  );
}
