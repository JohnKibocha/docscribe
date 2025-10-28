/**
 * @fileoverview Input component for form fields.
 * 
 * This component provides a professional input interface with consistent
 * styling and behavior. Features include:
 * - Standard text input styling
 * - Focus states and transitions
 * - Disabled state handling
 * - Form integration
 * - Professional appearance
 * 
 * @module components/ui/input
 */

import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Input component props extending standard HTML input attributes.
 */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Professional input component with consistent styling.
 * 
 * @param props - Input props including className and standard HTML attributes
 * @returns {JSX.Element} Styled input element
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };