import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary via-primary to-signal text-primary-foreground shadow-[0_10px_22px_-8px_color-mix(in_oklab,var(--primary)_80%,transparent)]",
        className,
      )}
    >
      <Radar className="size-4" aria-hidden />
    </span>
  );
}
