import React from 'react';
import { X, Clock } from 'lucide-react';

/**
 * TimePickerModal
 * 
 * A premium bottom-sheet style picker for selecting times in 30-min intervals.
 */
const TimePickerModal = ({ isOpen, onClose, onSelect, activeValue, label }) => {
  if (!isOpen) return null;

  const hours = [];
  for (let h = 0; h < 24; h++) {
    ['00', '30'].forEach(m => {
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const ampm = h < 12 ? 'AM' : 'PM';
      const val = `${String(h).padStart(2, '0')}:${m}`;
      const labelStr = `${displayH}:${m} ${ampm}`;
      hours.push({ val, label: labelStr });
    });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      padding: '2rem',
      animation: 'fadeIn 0.2s ease-out'
    }} onClick={onClose}>
      
      <div style={{
        width: '100%', maxWidth: '500px',
        background: 'var(--bg-main)',
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        padding: '2rem',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        animation: 'modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{label || 'Select Time'}</h4>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Choose a time in 30-min intervals</p>
          </div>
          <button onClick={onClose} style={{ 
            background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', 
            padding: '8px', borderRadius: '50%', cursor: 'pointer' 
          }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ 
          overflowY: 'auto', flex: 1, 
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem',
          paddingBottom: '1rem'
        }}>
          {hours.map(h => {
            const isSelected = h.val === activeValue;
            return (
              <button
                key={h.val}
                onClick={() => { onSelect(h.val); onClose(); }}
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  border: isSelected ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                  background: isSelected ? 'rgba(0,210,106,0.1)' : 'rgba(255,255,255,0.02)',
                  color: isSelected ? 'var(--brand-green)' : 'var(--text-main)',
                  textAlign: 'center', cursor: 'pointer', fontSize: '0.95rem',
                  fontWeight: isSelected ? '600' : '400',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <Clock size={14} opacity={isSelected ? 1 : 0.4} />
                {h.label}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideIn { 
          from { opacity: 0; transform: translateY(20px) scale(0.95); } 
          to { opacity: 1; transform: translateY(0) scale(1); } 
        }
      `}</style>
    </div>
  );
};

export default TimePickerModal;
