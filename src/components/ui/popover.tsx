"use client";

import * as React from "react";

import {cn} from "cn";
import {Popover as PopoverPrimitive} from "radix-ui";

function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>): React.ReactElement {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>): React.ReactElement {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({className, align = "start", sideOffset = 4, ...props}: React.ComponentProps<typeof PopoverPrimitive.Content>): React.ReactElement {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content data-slot="popover-content" align={align} sideOffset={sideOffset} className={cn("z-50 w-72 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--ivory)] p-4 text-[var(--charcoal)] shadow-md outline-none", className)} {...props} />
    </PopoverPrimitive.Portal>
  );
}

export {Popover, PopoverContent, PopoverTrigger};
