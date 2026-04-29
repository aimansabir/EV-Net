import React from 'react';

/**
 * A pulsing skeleton component for loading states.
 */
const Skeleton = ({ width, height, borderRadius = '8px', className = '', style = {} }) => {
  const baseStyle = {
    width: width || '100%',
    height: height || '1rem',
    borderRadius,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-pulse 1.5s infinite ease-in-out',
    ...style
  };

  return (
    <>
      <style>{`
        @keyframes skeleton-pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div className={`skeleton ${className}`} style={baseStyle} />
    </>
  );
};

export const CardSkeleton = () => (
  <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
    <Skeleton height="160px" borderRadius="0" />
    <div style={{ padding: '1rem' }}>
      <Skeleton width="60%" height="1.2rem" style={{ marginBottom: '0.6rem' }} />
      <Skeleton width="80%" height="0.8rem" style={{ marginBottom: '1rem' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton width="40%" height="1.2rem" />
        <Skeleton width="20%" height="1.2rem" />
      </div>
    </div>
  </div>
);

export const ListSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[1, 2, 3].map(i => (
            <div key={i} className="glass-card" style={{ padding: '1.2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Skeleton width="80px" height="60px" borderRadius="8px" />
                <div style={{ flex: 1 }}>
                    <Skeleton width="40%" height="1rem" style={{ marginBottom: '0.5rem' }} />
                    <Skeleton width="60%" height="0.8rem" />
                </div>
            </div>
        ))}
    </div>
);

export default Skeleton;
