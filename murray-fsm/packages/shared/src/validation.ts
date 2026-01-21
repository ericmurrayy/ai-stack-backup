// Murray's FSM - Shared Validation Utilities
// ===========================================

/**
 * Validate email address format
 * @param email - Email address to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate US phone number format
 * @param phone - Phone number to validate
 * @returns true if valid US phone format
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned[0] === '1');
}

/**
 * Validate US ZIP code format
 * @param zip - ZIP code to validate
 * @returns true if valid ZIP format (5 digits or 5+4)
 */
export function isValidZip(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip);
}

/**
 * Validate required string field
 * @param value - Value to check
 * @returns true if non-empty string
 */
export function isRequired(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate positive number
 * @param value - Value to check
 * @returns true if positive number
 */
export function isPositiveNumber(value: number | null | undefined): boolean {
  return typeof value === 'number' && value > 0;
}

/**
 * Validate date string is in the future
 * @param dateString - ISO date string
 * @returns true if date is in the future
 */
export function isFutureDate(dateString: string | null): boolean {
  if (!dateString) return false;
  try {
    return new Date(dateString) > new Date();
  } catch {
    return false;
  }
}

/**
 * Validate date string is a valid ISO date
 * @param dateString - Date string to validate
 * @returns true if valid ISO date
 */
export function isValidDate(dateString: string | null): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

// ============================================================================
// Form Validation Helpers
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate customer form data
 */
export function validateCustomer(data: {
  name?: string;
  phone?: string;
  email?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (!isRequired(data.name)) {
    errors.push({ field: 'name', message: 'Name is required' });
  }

  if (data.phone && !isValidPhone(data.phone)) {
    errors.push({ field: 'phone', message: 'Invalid phone number format' });
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.push({ field: 'email', message: 'Invalid email address format' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate location form data
 */
export function validateLocation(data: {
  address1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (!isRequired(data.address1)) {
    errors.push({ field: 'address1', message: 'Address is required' });
  }

  if (!isRequired(data.city)) {
    errors.push({ field: 'city', message: 'City is required' });
  }

  if (!isRequired(data.state)) {
    errors.push({ field: 'state', message: 'State is required' });
  }

  if (data.postal_code && !isValidZip(data.postal_code)) {
    errors.push({ field: 'postal_code', message: 'Invalid ZIP code format' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate job scheduling data
 */
export function validateJobSchedule(data: {
  scheduled_start?: string;
  scheduled_end?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (data.scheduled_start && !isValidDate(data.scheduled_start)) {
    errors.push({ field: 'scheduled_start', message: 'Invalid start date' });
  }

  if (data.scheduled_end && !isValidDate(data.scheduled_end)) {
    errors.push({ field: 'scheduled_end', message: 'Invalid end date' });
  }

  if (data.scheduled_start && data.scheduled_end) {
    const start = new Date(data.scheduled_start);
    const end = new Date(data.scheduled_end);
    if (end <= start) {
      errors.push({ field: 'scheduled_end', message: 'End time must be after start time' });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate line item data
 */
export function validateLineItem(data: {
  description?: string;
  quantity?: number;
  unit_price_cents?: number;
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (!isRequired(data.description)) {
    errors.push({ field: 'description', message: 'Description is required' });
  }

  if (!isPositiveNumber(data.quantity)) {
    errors.push({ field: 'quantity', message: 'Quantity must be positive' });
  }

  if (data.unit_price_cents !== undefined && data.unit_price_cents < 0) {
    errors.push({ field: 'unit_price_cents', message: 'Price cannot be negative' });
  }

  return { valid: errors.length === 0, errors };
}
