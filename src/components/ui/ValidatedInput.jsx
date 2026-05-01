import React, { useState, useCallback } from 'react';
import { AlertCircle, Plus, Minus } from 'lucide-react';

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
  disabled,
  forceError = false, // Trigger manual validation from parent
  compact = false      // Smaller, segmented stepper layout
}) => {
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const getValidationError = useCallback(() => {
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
      
      if (format === 'money' || format === 'numeric') {
          const numValue = Number(value);
          if (min !== undefined && numValue < min) newError = `Minimum value is ${min}`;
          if (max !== undefined && numValue > max) newError = `Maximum value is ${max}`;
      }
    }

    return newError;
  }, [format, max, min, required, value]);

  // Run final validation passes when user leaves the field
  const handleBlur = useCallback(() => {
    setTouched(true);
    const newError = getValidationError();
    setError(newError);
  }, [getValidationError]);

  const displayError = error || (forceError ? getValidationError() : '');

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

    onChange(val);
  };

  const handleStep = (amount) => {
    if (disabled) return;
    const numValue = Number(value || 0);
    const newValue = Math.max(min || 0, Math.min(max || 999999, numValue + amount));
    onChange(String(newValue));
    if (touched || forceError) handleBlur(); 
  };

  return (
    <div className="auth-field" style={{ 
      marginBottom: '1.25rem',
      maxWidth: compact ? '320px' : '100%',
      margin: compact ? '0 auto 1.25rem' : '0 0 1.25rem'
    }}>
      {label && (
        <label style={{ textAlign: compact ? 'center' : 'left', display: 'block', marginBottom: '0.8rem', opacity: 0.8, fontSize: '0.9rem' }}>
          {label} {required && <span style={{ color: 'var(--brand-cyan)' }}>*</span>}
        </label>
      )}
      
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {(format === 'money' || format === 'numeric') && !disabled && (
          <button 
            type="button"
            onClick={() => handleStep(-(format === 'money' ? 5 : 1))} // Smaller steps for money
            style={{
              position: 'absolute', left: '4px', zIndex: 5,
              width: compact ? '28px' : '32px', height: compact ? '28px' : '32px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.1s'
            }}
          >
            <Minus size={10} />
          </button>
        )}

        {format === 'money' && !compact && (
           <span style={{
             position: 'absolute', 
             left: '42px', 
             top: '50%', transform: 'translateY(-50%)',
             color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '500', zIndex: 2,
             opacity: 0.4
           }}>
             PKR
           </span>
        )}
        
        <input
          type={type}
          className={`auth-input ${displayError ? 'input-error' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          maxLength={maxLength || (format === 'cnic' ? 15 : undefined)}
          disabled={disabled}
          style={{
            ...(compact ? { height: '44px' } : {}),
            textAlign: compact ? 'center' : 'left',
            fontWeight: compact ? '600' : '500',
            fontSize: compact ? '1rem' : '1rem',
            paddingLeft: compact ? '34px' : (format === 'money' ? '78px' : (format === 'numeric' ? '38px' : '12px')),
            paddingRight: compact ? '34px' : ((format === 'money' || format === 'numeric') ? '38px' : '12px'),
            background: compact ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        />

        {(format === 'money' || format === 'numeric') && !disabled && (
          <button 
            type="button"
            onClick={() => handleStep(format === 'money' ? 5 : 1)}
            style={{
              position: 'absolute', right: '4px', zIndex: 5,
              width: compact ? '28px' : '32px', height: compact ? '28px' : '32px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.1s'
            }}
          >
            <Plus size={10} />
          </button>
        )}
      </div>

      {displayError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          color: '#fb7185', fontSize: '0.8rem', marginTop: '0.6rem',
          background: 'rgba(251, 113, 133, 0.08)', padding: '0.6rem 0.8rem',
          borderRadius: '8px', border: '1px solid rgba(251, 113, 133, 0.15)',
          justifyContent: compact ? 'center' : 'flex-start'
        }}>
          <AlertCircle size={14} />
          <span style={{ fontWeight: 500 }}>{displayError}</span>
        </div>
      )}
    </div>
  );
};

export default ValidatedInput;
