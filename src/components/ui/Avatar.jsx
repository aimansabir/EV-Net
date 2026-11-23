import React from 'react';
import { User } from 'lucide-react';

/**
 * Avatar Component
 * 
 * Centralized rendering for user profile pictures with multi-stage fallback:
 * 1. Specific image URL (from storage or legacy)
 * 2. First and last initial (styled circle)
 * 3. Generic Lucide user icon
 */
const Avatar = ({ 
  src, 
  name, 
  size = '40px', 
  className = '', 
  style = {} 
}) => {
  // Track which URL failed so a new src (e.g. after an upload) is retried.
  const [failedSrc, setFailedSrc] = React.useState(null);
  const hasError = Boolean(src) && failedSrc === src;
  const numericSize = parseFloat(size) || 40;

  // Fallback 1: Name initials
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : null;

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-color)',
    ...style
  };

  // If we have a source and no error, try rendering the image
  if (src && !hasError) {
    return (
      <div className={`avatar-container ${className}`} style={containerStyle}>
        <img 
          src={src} 
          alt={name || 'User avatar'} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setFailedSrc(src)}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  // Fallback 2: Initials
  if (initials) {
    return (
      <div className={`avatar-initials ${className}`} style={{
        ...containerStyle,
        background: 'linear-gradient(135deg, var(--brand-green), var(--brand-cyan))',
        color: '#000',
        fontWeight: 700,
        fontSize: `calc(${size} * 0.4)`,
        letterSpacing: '-0.5px'
      }}>
        {initials}
      </div>
    );
  }

  // Fallback 3: Generic User Icon
  return (
    <div className={`avatar-fallback ${className}`} style={containerStyle}>
      <User size={Math.round(numericSize * 0.6)} color="var(--text-secondary)" aria-hidden="true" />
    </div>
  );
};

export default Avatar;
