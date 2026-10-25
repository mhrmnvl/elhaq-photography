"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type TabsVariant = "default" | "line"

const TabsVariantContext = React.createContext<TabsVariant>("default")

interface TabsProps extends React.ComponentProps<typeof TabsPrimitive.Root> {
  variant?: TabsVariant
}

function Tabs({
  className,
  orientation = "horizontal",
  variant = "default",
  ...props
}: TabsProps) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        data-variant={variant}
        className={cn(
          "group/tabs flex gap-2 data-horizontal:flex-col",
          className
        )}
        {...props}
      />
    </TabsVariantContext.Provider>
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex items-center text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default:
          "w-fit justify-center rounded-lg bg-muted p-[3px] group-data-horizontal/tabs:h-8",
        line:
          "w-full justify-start rounded-none border-b border-border bg-transparent p-0 gap-6 group-data-horizontal/tabs:h-auto",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface TabsListProps
  extends React.ComponentProps<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

function TabsList({
  className,
  variant: propVariant,
  ...props
}: TabsListProps) {
  const contextVariant = React.useContext(TabsVariantContext)
  const variant = propVariant ?? contextVariant

  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      />
    </TabsVariantContext.Provider>
  )
}

const tabsTriggerVariants = cva(
  "relative inline-flex items-center justify-center whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "h-[calc(100%-1px)] flex-1 gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-xs font-medium text-foreground/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs dark:data-[state=active]:bg-input/30",
        line:
          "-mb-px gap-2 rounded-none border-b-2 border-transparent bg-transparent pb-3 pt-1.5 px-0.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-0 focus-visible:outline-none focus-visible:border-foreground data-[state=active]:border-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface TabsTriggerProps
  extends React.ComponentProps<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

function TabsTrigger({
  className,
  variant: propVariant,
  ...props
}: TabsTriggerProps) {
  const contextVariant = React.useContext(TabsVariantContext)
  const variant = propVariant ?? contextVariant

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-variant={variant}
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  )
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
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants }
