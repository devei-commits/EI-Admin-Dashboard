"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "./utils";

function Tabs({
 className,
 ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
 return (
  <TabsPrimitive.Root
   data-slot="tabs"
   className={cn("flex flex-col gap-2", className)}
   {...props}
  />
 );
}

function TabsList({
 className,
 ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
 return (
  <TabsPrimitive.List
   data-slot="tabs-list"
   className={cn(
    "bg-surface-3/80 text-muted-foreground inline-flex h-12 w-fit items-center justify-center rounded-2xl p-1.5 shadow-inner",
    className,
   )}
   {...props}
  />
 );
}

function TabsTrigger({
 className,
 ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
 return (
  <TabsPrimitive.Trigger
   data-slot="tabs-trigger"
   className={cn(
    "text-ink-2 data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-md focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 inline-flex h-full flex-1 items-center justify-center gap-2 rounded-xl border border-transparent px-5 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200 focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 hover:text-ink",
    className,
   )}
   {...props}
  />
 );
}

function TabsContent({
 className,
 ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
 return (
  <TabsPrimitive.Content
   data-slot="tabs-content"
   className={cn("flex-1 outline-none", className)}
   {...props}
  />
 );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
