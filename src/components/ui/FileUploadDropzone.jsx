import React, { useState, useRef } from 'react';
import { UploadCloud, Camera, FileIcon, X, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * FileUploadDropzone
 * 
 * Reusable drag-and-drop zone for Files/Images.
 * Supports file size limits, mime type validation, and preview rendering.
 */
const FileUploadDropzone = ({
  label,
  description,
  accept = 'image/jpeg, image/png, application/pdf',
  maxSizeMB = 5,
  multiple = false,
  files = [], // Expected: Array of { file: File, preview: string, id: string }
  onChange,
  error: externalError,
  mode = 'document' // 'document' | 'image'
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [internalError, setInternalError] = useState('');
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndProcessFiles = (newFiles) => {
    setInternalError('');
    let validFiles = [];

    for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];

        // Validate size
        if (file.size > maxSizeMB * 1024 * 1024) {
            setInternalError(`File ${file.name} is too large. Max size is ${maxSizeMB}MB.`);
            continue;
        }

        // Generate object URL for preview if it's an image
        const isImage = file.type.startsWith('image/');
        const previewUrl = isImage ? URL.createObjectURL(file) : null;

        validFiles.push({
            id: Math.random().toString(36).substring(7),
            file,
            preview: previewUrl,
            isImage
        });
    }

    if (validFiles.length > 0) {
        if (multiple) {
            onChange([...files, ...validFiles]);
        } else {
            // Unload previous single file preview if exists to prevent memory leaks
            if (files.length > 0 && files[0].preview) URL.revokeObjectURL(files[0].preview);
            onChange([validFiles[0]]);
        }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFiles(e.target.files);
    }
  };

  const onButtonClick = () => {
    inputRef.current.click();
  };

  const removeFile = (idToRemove) => {
    const fileToRemove = files.find(f => f.id === idToRemove);
    if (fileToRemove && fileToRemove.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
    }
    onChange(files.filter(f => f.id !== idToRemove));
  };

  const displayError = externalError || internalError;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {(label || description) && (
        <div style={{ marginBottom: '0.75rem' }}>
          {label && <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>{label}</label>}
          {description && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{description}</div>}
        </div>
      )}

      {/* Upload Zone */}
      {(!files.length || multiple) && (
        <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
            style={{
                border: `2px dashed ${dragActive ? 'var(--brand-cyan)' : 'var(--border-color)'}`,
                borderRadius: '12px',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                background: dragActive ? 'rgba(0, 240, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
            }}
        >
            <input 
                ref={inputRef} type="file" multiple={multiple} accept={accept} 
                onChange={handleChange} style={{ display: 'none' }} 
            />
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                     {mode === 'image' ? <Camera size={24} /> : <UploadCloud size={24} />}
                </div>
            </div>
            
            <h4 style={{ margin: '0 0 0.25rem 0', color: '#fff' }}>
                {mode === 'image' ? 'Take Photo or Choose File' : 'Drag & Drop, or Browse'}
            </h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                Supported formats: {accept.replace(/[(image/)(application/)]/g, '').replace(/,/g, ', ')} (Max {maxSizeMB}MB)
            </p>
        </div>
      )}

      {/* File Previews */}
      {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              {files.map((fileObj) => (
                  <div key={fileObj.id} style={{
                      display: 'flex', alignItems: 'center', pading: '0.75rem',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px',
                      overflow: 'hidden'
                  }}>
                      {fileObj.isImage && fileObj.preview ? (
                          <div style={{ width: '60px', height: '60px', background: `url(${fileObj.preview}) center/cover` }} />
                      ) : (
                          <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}>
                              <FileIcon size={24} color="var(--brand-cyan)" />
                          </div>
                      )}
                      
                      <div style={{ flex: 1, padding: '0 1rem', overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {fileObj.file.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {(fileObj.file.size / 1024 / 1024).toFixed(2)} MB • Ready to upload
                          </div>
                      </div>

                      <button 
                         onClick={() => removeFile(fileObj.id)}
                         style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '0.75rem', cursor: 'pointer' }}
                         title="Remove File"
                      >
                         <X size={18} />
                      </button>
                  </div>
              ))}
          </div>
      )}

      {/* Error State */}
      {displayError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          color: '#fb7185', fontSize: '0.8rem', marginTop: '0.75rem'
        }}>
          <AlertCircle size={14} />
          {displayError}
        </div>
      )}
    </div>
  );
};

export default FileUploadDropzone;
