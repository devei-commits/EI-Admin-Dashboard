import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
 return (
  <input
   type={type}
   data-slot="input"
   className={cn(
    "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-gray-200 flex h-11 w-full min-w-0 rounded-xl border px-4 py-2 text-base bg-input-background shadow-sm transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm hover:border-gray-300 hover:shadow-md",
    "focus-visible:border-amber-400 focus-visible:ring-amber-100 focus-visible:ring-[3px] focus-visible:shadow-md",
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    className,
   )}
   {...props}
  />
 );
}

export { Input };
