import React, { useEffect } from 'react';

/**
 * Bootstrap-styled modal wrapper. When show is true, renders modal with overlay.
 * onClose is called when overlay is clicked or close button is used.
 */
export default function Modal({
  show,
  onClose,
  title,
  children,
  footer,
  size = '',
  id,
}) {
  useEffect(() => {
    if (!show) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, [show, onClose]);

  if (!show) return null;

  const dialogClass = size ? `modal-dialog modal-${size}` : 'modal-dialog';

  return (
    <div
      className={`modal fade show ${id ? `modal-${id}` : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        backgroundColor: 'rgba(0,0,0,0.5)',
        overflowY: 'auto',
        padding: '1.75rem',
      }}
      id={id}
      tabIndex={-1}
      aria-modal
      aria-labelledby={id ? `${id}-title` : undefined}
      onClick={onClose}
    >
      <div
        className={dialogClass}
        style={{ margin: 0, maxHeight: 'calc(100vh - 3.5rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content bg-dark">
          <div className="modal-header">
            <h5 className="modal-title" id={id ? `${id}-title` : undefined}>
              {title}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              aria-label="Close"
              onClick={onClose}
            />
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
