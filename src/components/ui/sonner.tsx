"use client";

import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

/** Emerald #00895B + marengo #394A51 toasts, aligned with brand tokens. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-ink group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:border-l-[3px] group-[.toaster]:border-l-primary",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toaster]:bg-primary group-[.toaster]:text-primary-foreground",
          cancelButton: "group-[.toaster]:bg-muted group-[.toaster]:text-muted-foreground",
          success: "group-[.toaster]:border-l-primary",
          error: "group-[.toaster]:border-l-destructive",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
