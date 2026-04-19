import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, MapPin } from 'lucide-react';
import { PakistanCities } from '../../data/schema';

/**
 * AreaComboBox
 * 
 * Accessible, searchable dropdown tailored for complex location sets
 * like DHA Phases, Johar Town blocks, etc.
 */
const AreaComboBox = ({ 
  label, 
  city, 
  value, 
  onChange, 
  required = false, 
  disabled = false,
  error
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);

  const availableAreas = useMemo(() => {
    if (!city) return [];
    return PakistanCities.find(c => c.city === city)?.areas || [];
  }, [city]);

  const filteredAreas = useMemo(() => {
    return query === ''
      ? availableAreas
      : availableAreas.filter((area) =>
          area.toLowerCase().includes(query.toLowerCase())
        );
  }, [query, availableAreas]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // Reset value if city changes and current value isn't in new city
  useEffect(() => {
    if (city && value && !availableAreas.includes(value)) {
        onChange('');
    }
  }, [city]);

  const handleSelect = (area) => {
    onChange(area);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="auth-field" style={{ marginBottom: '1.25rem', position: 'relative' }} ref={wrapperRef}>
      <label>
        {label || 'Select Area'} {required && <span style={{ color: 'var(--brand-cyan)' }}>*</span>}
      </label>

      <div 
        onClick={() => !disabled && setOpen(!open)}
        className={`auth-input ${error ? 'input-error' : ''}`}
        style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
            <MapPin size={16} color={value ? 'var(--brand-cyan)' : 'var(--text-secondary)'} />
            <span style={{ color: value ? '#fff' : 'rgba(255, 255, 255, 0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {value || (city ? 'Select a neighborhood' : 'Select a city first')}
            </span>
        </div>
        <ChevronDown size={18} color="var(--text-secondary)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>

      {open && availableAreas.length > 0 && (
        <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            marginTop: '8px', background: '#111822', border: '1px solid var(--border-color)',
            borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
        }}>
            <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={16} color="var(--text-secondary)" />
                <input 
                    type="text" 
                    placeholder="Search areas..." 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%', fontSize: '0.9rem' }}
                    autoFocus
                />
            </div>
            
            <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '8px 0' }}>
                {filteredAreas.length === 0 ? (
                    <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem' }}>
                        No matching areas found
                    </div>
                ) : (
                    filteredAreas.map((area) => (
                        <div 
                            key={area}
                            onClick={() => handleSelect(area)}
                            style={{
                                padding: '10px 16px', cursor: 'pointer', fontSize: '0.9rem',
                                color: value === area ? '#fff' : 'var(--text-secondary)',
                                background: value === area ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
                                display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.1s'
                            }}
                            onMouseEnter={(e) => {
                                if (value !== area) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                            }}
                            onMouseLeave={(e) => {
                                if (value !== area) e.currentTarget.style.background = 'transparent'
                            }}
                        >
                            <span style={{ 
                                width: '6px', height: '6px', borderRadius: '50%', 
                                background: value === area ? 'var(--brand-cyan)' : 'transparent' 
                            }} />
                            {area}
                        </div>
                    ))
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default AreaComboBox;
