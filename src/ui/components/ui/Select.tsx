/**
 * @fileoverview Provides a styled and accessible native HTML select component.
 *
 * @description
 * This module exports two primary components: `Select` and `SelectItem`.
 * The `Select` component renders a native `<select>` element wrapped in a styled container,
 * offering a consistent look and feel while retaining the accessibility and browser
 * features of native form controls. It is designed to be lightweight and does not
 * rely on external UI libraries for its core functionality.
 *
 * The `SelectItem` component is a simple wrapper for the native `<option>` element,
 * used as children within the `Select` component.
 *
 * For API compatibility with certain UI patterns (e.g., Radix UI's Select), dummy
 * `SelectTrigger`, `SelectValue`, and `SelectContent` components are provided.
 * These are `React.Fragment`s and do not render any additional DOM elements,
 * serving purely as placeholders for structural consistency.
 *
 * @module components/ui/Select
 */

import * as React from 'react';

/**
 * Props interface for the `Select` component.
 * Extends standard HTML `select` attributes for full compatibility.
 */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * The currently selected value of the dropdown.
   * This prop makes the component a controlled component.
   */
  value: string;

  /**
   * Callback function invoked when the selected value changes.
   * It receives the new value as its argument.
   * @param {string} value - The new value of the select input.
   * @returns {void}
   */
  onValueChange: (value: string) => void;

  /**
   * React children, typically `SelectItem` components, that represent the options in the dropdown.
   */
  children: React.ReactNode;
}

/**
 * A styled and accessible native HTML select dropdown component.
 *
 * @description
 * This component renders a `<select>` element along with a custom-styled dropdown arrow.
 * It is built on native HTML elements to ensure maximum accessibility and browser compatibility.
 * The component is a controlled component, requiring `value` and `onValueChange` props.
 *
 * @param {SelectProps} props - The properties for the component.
 * @param {React.Ref<HTMLDivElement>} ref - A ref to the outermost `div` element of the component.
 * @returns {JSX.Element} The rendered select dropdown.
 *
 * @example
 * ```tsx
 * import { Select, SelectItem } from './components/ui/Select';
 * import { useState } from 'react';
 *
 * function MyForm() {
 *   const [fruit, setFruit] = useState('apple');
 *
 *   return (
 *     <Select value={fruit} onValueChange={setFruit} aria-label="Select a fruit">
 *       <SelectItem value="apple">Apple</SelectItem>
 *       <SelectItem value="banana">Banana</SelectItem>
 *       <SelectItem value="orange">Orange</SelectItem>
 *     </Select>
 *   );
 * }
 * ```
 */
export const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ value, onValueChange, children, disabled, className, ...props }, ref) => {
    /**
     * Handles the change event of the native select element.
     * Extracts the new value and passes it to the `onValueChange` callback.
     * @param {React.ChangeEvent<HTMLSelectElement>} e - The change event object.
     * @returns {void}
     */
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onValueChange(e.target.value);
    };

    return (
      <div ref={ref} className={`relative inline-block ${className || ''}`}>
        <select
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="
            w-full px-3 py-2 pr-8
            bg-white border border-gray-300 rounded-md
            text-sm text-gray-900
            appearance-none cursor-pointer
            hover:border-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          {...props}
        >
          {children}
        </select>
        {/* Custom dropdown arrow for consistent styling across browsers */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';

/**
 * Props interface for the `SelectItem` component.
 * Extends standard HTML `option` attributes.
 */
interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
  /**
   * The value associated with this option. This is the value that will be returned by the `Select` component when this item is chosen.
   */
  value: string;

  /**
   * The content to be displayed within the option, typically text.
   */
  children: React.ReactNode;
}

/**
 * A component representing an individual option within a `Select` dropdown.
 *
 * @description
 * This component renders a native `<option>` element. It is intended to be used as a child
 * of the `Select` component. It accepts standard HTML `option` attributes.
 *
 * @param {SelectItemProps} props - The properties for the component.
 * @param {React.Ref<HTMLOptionElement>} ref - A ref to the underlying `option` element.
 * @returns {JSX.Element} The rendered option element.
 *
 * @example
 * ```tsx
 * // Used within a Select component:
 * <Select value={...} onValueChange={...}>
 *   <SelectItem value="option1">Option 1 Display</SelectItem>
 *   <SelectItem value="option2" disabled>Option 2 (Disabled)</SelectItem>
 * </Select>
 * ```
 */
export const SelectItem = React.forwardRef<HTMLOptionElement, SelectItemProps>(
  ({ value, children, ...props }, ref) => {
    return (
      <option ref={ref} value={value} {...props}>
        {children}
      </option>
    );
  }
);

SelectItem.displayName = 'SelectItem';

/**
 * A dummy component for API compatibility with certain UI patterns.
 * This component renders a `React.Fragment` and does not produce any DOM elements.
 * It is functionally equivalent to the `Select` component for direct usage.
 * @type {React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLDivElement>>}
 */
export const SelectTrigger = Select;

/**
 * A dummy component for API compatibility with certain UI patterns.
 * This component renders a `React.Fragment` and does not produce any DOM elements.
 * It is used as a placeholder for the selected value display.
 * @type {React.ExoticComponent<{ children?: React.ReactNode }>}
 */
export const SelectValue = React.Fragment;

/**
 * A dummy component for API compatibility with certain UI patterns.
 * This component renders a `React.Fragment` and does not produce any DOM elements.
 * It is used as a container for `SelectItem` components.
 * @type {React.ExoticComponent<{ children?: React.ReactNode }>}
 */
export const SelectContent = React.Fragment;
