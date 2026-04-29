import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';

/**
 * SearchableSelect
 * 
 * Reusable, controlled searchable dropdown with scrollable list.
 */
const SearchableSelect = ({ 
  label, 
  options = [], 
  value, 
  onChange, 
  placeholder = 'Select option', 
  searchPlaceholder = 'Search...',
  required = false, 
  disabled = false,
  error
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);

  const filteredOptions = useMemo(() => {
    return query === ''
      ? options
      : options.filter((opt) =>
          opt.toLowerCase().includes(query.toLowerCase())
        );
  }, [query, options]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSelect = (opt) => {
    onChange(opt);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="auth-field" style={{ marginBottom: '1.25rem', position: 'relative' }} ref={wrapperRef}>
      {label && (
        <label>
          {label} {required && <span style={{ color: 'var(--brand-cyan)' }}>*</span>}
        </label>
      )}

      <div 
        onClick={() => !disabled && setOpen(!open)}
        className={`auth-input ${error ? 'input-error' : ''}`}
        style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            userSelect: 'none',
            padding: '0.8rem 1rem'
        }}
      >
        <span style={{ color: value ? '#fff' : 'rgba(255, 255, 255, 0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value || placeholder}
        </span>
        <ChevronDown size={18} color="var(--text-secondary)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>

      {open && (
        <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            marginTop: '8px', background: '#111822', border: '1px solid var(--border-color)',
            borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
        }}>
            <div style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={14} color="var(--text-secondary)" />
                <input 
                    type="text" 
                    placeholder={searchPlaceholder} 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                    autoFocus
                />
            </div>
            
            <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px 0' }}>
                {filteredOptions.length === 0 ? (
                    <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>
                        No results found
                    </div>
                ) : (
                    filteredOptions.map((opt) => (
                        <div 
                            key={opt}
                            onClick={() => handleSelect(opt)}
                            style={{
                                padding: '10px 16px', cursor: 'pointer', fontSize: '0.85rem',
                                color: value === opt ? 'var(--brand-cyan)' : 'var(--text-secondary)',
                                background: value === opt ? 'rgba(0, 240, 255, 0.05)' : 'transparent',
                                transition: 'all 0.1s'
                            }}
                            onMouseEnter={(e) => {
                                if (value !== opt) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                            }}
                            onMouseLeave={(e) => {
                                if (value !== opt) e.currentTarget.style.background = 'transparent'
                            }}
                        >
                            {opt}
                        </div>
                    ))
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
