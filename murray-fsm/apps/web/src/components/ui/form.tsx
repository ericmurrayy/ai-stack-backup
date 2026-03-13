// Murray's FSM - Form Components
// ================================

'use client';

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ---- Shared styles ----

const inputBase =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ' +
  'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ' +
  'transition-colors';

const labelBase = 'block text-sm font-medium text-slate-700 mb-1';
const errorBase = 'text-xs text-red-600 mt-1';
const helperBase = 'text-xs text-slate-500 mt-1';

// ---- FormField Wrapper ----

interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  helperText,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-0', className)}>
      {label && (
        <label htmlFor={htmlFor} className={labelBase}>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className={errorBase}>{error}</p>}
      {!error && helperText && <p className={helperBase}>{helperText}</p>}
    </div>
  );
}

// ---- Input ----

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, required, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <FormField
        label={label}
        htmlFor={inputId}
        error={error}
        helperText={helperText}
        required={required}
      >
        <input
          ref={ref}
          id={inputId}
          required={required}
          className={cn(inputBase, error && 'border-red-300 focus:ring-red-500 focus:border-red-500', className)}
          {...props}
        />
      </FormField>
    );
  }
);
Input.displayName = 'Input';

// ---- Select ----

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder, className, id, required, ...props }, ref) => {
    const selectId = id || props.name;
    return (
      <FormField
        label={label}
        htmlFor={selectId}
        error={error}
        helperText={helperText}
        required={required}
      >
        <select
          ref={ref}
          id={selectId}
          required={required}
          className={cn(inputBase, error && 'border-red-300 focus:ring-red-500 focus:border-red-500', className)}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>
    );
  }
);
Select.displayName = 'Select';

// ---- Textarea ----

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, showCount, maxLength, value, className, id, required, ...props }, ref) => {
    const textareaId = id || props.name;
    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <FormField
        label={label}
        htmlFor={textareaId}
        error={error}
        required={required}
      >
        <textarea
          ref={ref}
          id={textareaId}
          required={required}
          maxLength={maxLength}
          value={value}
          className={cn(
            inputBase,
            'min-h-[80px] resize-y',
            error && 'border-red-300 focus:ring-red-500 focus:border-red-500',
            className
          )}
          {...props}
        />
        <div className="flex justify-between mt-1">
          {!error && helperText && <p className={helperBase}>{helperText}</p>}
          {showCount && maxLength && (
            <p className={cn(helperBase, 'ml-auto', currentLength >= maxLength && 'text-red-500')}>
              {currentLength}/{maxLength}
            </p>
          )}
        </div>
      </FormField>
    );
  }
);
Textarea.displayName = 'Textarea';

// ---- DatePicker ----

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, helperText, className, id, required, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <FormField
        label={label}
        htmlFor={inputId}
        error={error}
        helperText={helperText}
        required={required}
      >
        <input
          ref={ref}
          type="date"
          id={inputId}
          required={required}
          className={cn(inputBase, error && 'border-red-300 focus:ring-red-500 focus:border-red-500', className)}
          {...props}
        />
      </FormField>
    );
  }
);
DatePicker.displayName = 'DatePicker';
