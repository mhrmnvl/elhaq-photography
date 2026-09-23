import * as React from "react";

import {cn} from "cn";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(function Textarea({className, ...props}, ref) {
  return <textarea ref={ref} data-slot="textarea" className={cn("flex min-h-28 w-full min-w-0 resize-y rounded-[var(--radius)] border border-[var(--line)] bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-[var(--charcoal)] focus-visible:border-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--charcoal)] md:text-sm", className)} {...props} />;
});

export {Textarea};
