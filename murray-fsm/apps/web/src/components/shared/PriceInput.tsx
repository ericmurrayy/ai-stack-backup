'use client';

import { useState } from 'react';

interface PriceInputProps {
  cents: number;
  onChange: (cents: number) => void;
  className?: string;
  'aria-label'?: string;
}

function centsToDisplay(c: number): string {
  if (c === 0) return '';
  return (c / 100).toFixed(2);
}

/**
 * Price input that stores cents internally but lets the user type
 * dollar values naturally (e.g. "150", "29.99").
 *
 * - While focused the user types freely (no reformatting on every keystroke)
 * - On blur the raw text is parsed → cents and the display is reformatted
 * - External changes (e.g. ServicePicker) update the display immediately
 */
export function PriceInput({ cents, onChange, className, ...props }: PriceInputProps) {
  const [displayValue, setDisplayValue] = useState(() => centsToDisplay(cents));
  const [isFocused, setIsFocused] = useState(false);
  const value = isFocused ? displayValue : centsToDisplay(cents);

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setIsFocused(true);
    setDisplayValue(centsToDisplay(cents));
    // Select all text for easy replacement
    e.target.select();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow only digits, one decimal point, and empty string
    if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
      setDisplayValue(raw);
      // Live-update cents so totals reflect while typing
      const num = parseFloat(raw);
      onChange(isNaN(num) ? 0 : Math.round(num * 100));
    }
  }

  function handleBlur() {
    setIsFocused(false);
    // Reformat on blur
    const num = parseFloat(displayValue);
    const newCents = isNaN(num) ? 0 : Math.round(num * 100);
    onChange(newCents);
    setDisplayValue(centsToDisplay(newCents));
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder="0.00"
      className={className}
      aria-label={props['aria-label']}
    />
  );
}
