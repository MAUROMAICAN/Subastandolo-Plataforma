import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";

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
        <CheckCircle2 className="h-4 w-4 text-green-400" />
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
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white shadow-2xl px-4 py-3 pr-10">
            <ToastIcon variant={props.variant} />
            <div className="flex-1 min-w-0 pt-0.5">
              {title && <ToastTitle className="text-sm font-semibold text-white leading-tight">{title}</ToastTitle>}
              {description && <ToastDescription className="text-xs text-white/50 mt-0.5 leading-relaxed">{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose className="text-white/30 hover:text-white/70" />
          </Toast>
        );
      })}
      <ToastViewport className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[90vw] max-w-sm z-[100] flex flex-col gap-2" />
    </ToastProvider>
  );
}
