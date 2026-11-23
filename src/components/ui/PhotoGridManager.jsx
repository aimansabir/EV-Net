import React, { useRef, useState } from 'react';
import { Camera, X, Image as ImageIcon } from 'lucide-react';

/**
 * PhotoGridManager
 * 
 * Specialized multi-image upload manager for 
 * listing creation. Enforces minimum rules and visually
 * distinguishes the Cover Photo.
 */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const PhotoGridManager = ({
  files = [], // { file, preview, id }
  onChange,
  maxPhotos = 10,
  error
}) => {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [notice, setNotice] = useState('');

  const processFiles = (newFiles) => {
    const validFiles = [];
    const skipped = [];
    const all = Array.from(newFiles);
    // Only accept up to the max limit
    const remainingSlots = maxPhotos - files.length;

    for (const file of all) {
      if (validFiles.length >= remainingSlots) break;
      if (ACCEPTED_TYPES.includes((file.type || '').toLowerCase())) {
        validFiles.push({
          id: Math.random().toString(36).substring(7),
          file,
          preview: URL.createObjectURL(file)
        });
      } else {
        skipped.push(file.name);
      }
    }

    const messages = [];
    if (skipped.length) {
      messages.push(`Skipped ${skipped.join(', ')} — please use JPG, PNG or WebP (iPhone HEIC photos aren't supported).`);
    }
    if (all.length - skipped.length > validFiles.length) {
      messages.push(`You can add up to ${maxPhotos} photos.`);
    }
    setNotice(messages.join(' '));

    if (validFiles.length) onChange([...files, ...validFiles]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave' || e.type === 'drop') setDragActive(false);

    if (e.type === 'drop' && e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (id) => {
    const target = files.find(f => f.id === id);
    if (target?.preview) URL.revokeObjectURL(target.preview);
    onChange(files.filter(f => f.id !== id));
  };

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
        Listing Photos <span style={{ color: 'var(--brand-cyan)' }}>*</span>
      </label>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        The first photo must be the <strong>Charger Setup</strong>. Add others for socket, driveway, or signs.
      </div>

      <div style={{
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem'
      }}>
          {files.map((fileObj, idx) => (
             <div key={fileObj.id} style={{
                 position: 'relative', 
                 aspectRatio: '1',
                 borderRadius: '12px',
                 overflow: 'hidden',
                 border: idx === 0 ? '2px solid var(--brand-cyan)' : '1px solid var(--border-color)',
                 background: `url(${fileObj.preview}) center/cover`
             }}>
                {idx === 0 && (
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'rgba(0, 240, 255, 0.9)', color: '#000',
                        fontSize: '0.65rem', fontWeight: 800, textAlign: 'center', padding: '4px',
                        textTransform: 'uppercase'
                    }}>
                       Charger Setup (Mandatory)
                    </div>
                )}
                {idx === 1 && (
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'rgba(255, 255, 255, 0.8)', color: '#000',
                        fontSize: '0.65rem', fontWeight: 800, textAlign: 'center', padding: '4px',
                        textTransform: 'uppercase'
                    }}>
                       Socket View
                    </div>
                )}
                <button 
                  type="button"
                  aria-label={`Remove photo ${idx + 1}`}
                  onClick={(e) => { e.preventDefault(); removeFile(fileObj.id); }}
                  style={{
                      position: 'absolute', top: '6px', right: '6px',
                      background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
                      width: '24px', height: '24px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer'
                  }}
                ><X size={14} /></button>
             </div>
          ))}

          {files.length < maxPhotos && (
              <div 
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrag}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
                  role="button"
                  tabIndex={0}
                  aria-label="Add photos"
                  style={{
                      aspectRatio: '1', borderRadius: '12px',
                      border: `2px dashed ${dragActive ? 'var(--brand-cyan)' : 'var(--border-color)'}`,
                      background: dragActive ? 'rgba(0, 240, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.2s'
                  }}
              >
                 <input ref={inputRef} type="file" multiple accept="image/jpeg, image/png, image/webp" onChange={e => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
                 <Camera size={28} color="var(--text-secondary)" style={{ marginBottom: '8px' }} />
                 <span style={{ fontSize: '0.8rem', color: 'var(--brand-cyan)', fontWeight: 500 }}>Add Photos</span>
              </div>
          )}
      </div>

      {notice && (
        <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.75rem' }} role="status">
          {notice}
        </div>
      )}
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
};

export default PhotoGridManager;
