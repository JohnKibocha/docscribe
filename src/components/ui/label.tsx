/**
 * @fileoverview Label component for form elements.
 * 
 * This component provides a professional label interface built on
 * top of Radix UI primitives. Features include:
 * - Proper accessibility attributes
 * - Form association
 * - Professional styling
 * - Variant support
 * 
 * @module components/ui/label
 */

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/**
 * Label variant styles using class-variance-authority.
 */
const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

/**
 * Professional label component with proper form association.
 * 
 * @param props - Label props including variant and className
 * @returns {JSX.Element} Styled label element
 */
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };