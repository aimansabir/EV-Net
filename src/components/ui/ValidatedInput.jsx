import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * ValidatedInput
 * 
 * Centralized schema input wrapper for EV-Net.
 * Supports restricting characters via onChange and validating completeness onBlur.
 * Enforces the dark premium styling inherently.
 */
const ValidatedInput = ({
  label,
  type = 'text',
  placeholder,
  format,      // 'name' | 'numeric' | 'phone' | 'cnic' | 'email' | 'password' | 'money'
  value,
  onChange,
  required = false,
  maxLength,
  min,
  max,
  disabled
}) => {
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  // Strip invalid characters immediately upon typing
  const handleChange = (e) => {
    let val = e.target.value;

    if (format === 'numeric' || format === 'money') {
      val = val.replace(/[^0-9]/g, ''); // Numbers only
    } else if (format === 'phone') {
      val = val.replace(/[^0-9+]/g, ''); // '+' and numbers
    } else if (format === 'name') {
      val = val.replace(/[^a-zA-Z\s\-']/g, ''); // Letters, spaces, hyphens, ticks
    } else if (format === 'cnic') {
      val = val.replace(/[^0-9-]/g, ''); // Numbers and hyphens
      // Auto-format for Pakistan CNIC: 5-7-1 (XXXXX-XXXXXXX-X)
      const cleanVal = val.replace(/-/g, '');
      if (cleanVal.length > 0) {
        val = cleanVal.match(new RegExp('.{1,5}', 'g'))[0];
        if (cleanVal.length > 5) val += '-' + cleanVal.substring(5, 12);
        if (cleanVal.length > 12) val += '-' + cleanVal.substring(12, 13);
      }
    }

    if (error && touched) {
      setError(''); // Clear error while typing
    }

    // Trigger parent callback
    if (format === 'money' || format === 'numeric') {
        const numPattern = val === '' ? '' : Number(val);
        // Only return if it matches min/max if they are tightly bound to state,
        // Wait, for inputs, it's better to allow typing and validate bounds on blur.
        onChange(val);
    } else {
        onChange(val);
    }
  };

  // Run final validation passes when user leaves the field
  const handleBlur = () => {
    setTouched(true);
    let newError = '';

    if (required && (!value || String(value).trim() === '')) {
      newError = 'This field is required';
    } else if (value) {
      if (format === 'phone' && value.length < 11) {
        newError = 'Invalid phone format (e.g. 03XXXXXXXXX)';
      } else if (format === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) newError = 'Please enter a valid email';
      } else if (format === 'cnic' && value.length !== 15) {
        newError = 'CNIC must be 13 digits (XXXXX-XXXXXXX-X)';
      } else if (format === 'password' && value.length < 8) {
        newError = 'Password must be at least 8 characters';
      }
      
      // Min/max validation for money/numeric
      if (format === 'money' || format === 'numeric') {
          const numValue = Number(value);
          if (min !== undefined && numValue < min) newError = `Minimum value is ${min}`;
          if (max !== undefined && numValue > max) newError = `Maximum value is ${max}`;
      }
    }

    setError(newError);
  };

  return (
    <div className="auth-field" style={{ marginBottom: '1.25rem' }}>
      {label && (
        <label>
          {label} {required && <span style={{ color: 'var(--brand-cyan)' }}>*</span>}
        </label>
      )}
      
      <div style={{ position: 'relative' }}>
        {format === 'money' && (
           <span style={{
             position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
             color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500'
           }}>
             PKR
           </span>
        )}
        
        <input
          type={type}
          className={`auth-input ${error ? 'input-error' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          maxLength={maxLength || (format === 'cnic' ? 15 : undefined)}
          disabled={disabled}
          style={format === 'money' ? { paddingLeft: '3rem' } : undefined}
        />
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          color: '#fb7185', fontSize: '0.8rem', marginTop: '0.4rem',
          background: 'rgba(225, 29, 72, 0.1)', padding: '0.4rem 0.6rem',
          borderRadius: '4px', border: '1px solid rgba(225, 29, 72, 0.2)'
        }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
};

export default ValidatedInput;
