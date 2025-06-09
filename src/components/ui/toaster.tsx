"use client"

import { useToast } from "@/hooks/use-toast"
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props} className="border-4 border-black shadow-[4px_4px_0px_0px_#000] bg-white">
          <div className="grid gap-1">
            {title && <ToastTitle className="font-black text-black">{title}</ToastTitle>}
            {description && <ToastDescription className="font-bold text-gray-700">{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose className="border-2 border-black bg-red-500 text-white hover:bg-red-600" />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
