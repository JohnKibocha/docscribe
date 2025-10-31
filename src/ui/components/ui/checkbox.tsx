/**
 * @fileoverview Checkbox component for form inputs.
 * 
 * This component provides a professional checkbox interface built on
 * top of Radix UI primitives. Features include:
 * - Accessible keyboard navigation
 * - Custom styling with check indicator
 * - Form integration
 * - Professional appearance
 * 
 * @module components/ui/checkbox
 */

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../../shared/lib/utils";

/**
 * Professional checkbox component with custom styling.
 * 
 * @param props - Checkbox props including className and other attributes
 * @returns {JSX.Element} Styled checkbox element with check indicator
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };