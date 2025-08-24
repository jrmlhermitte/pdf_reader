import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface PdfModalWrapperProps {
  children: React.ReactNode;
}

const PdfModalWrapper: React.FC<PdfModalWrapperProps> = ({ children }) => {
  const elRef = useRef<HTMLDivElement | null>(null);

  if (!elRef.current) {
    elRef.current = document.createElement('div');
  }

  useEffect(() => {
    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) {
      const newModalRoot = document.createElement('div');
      newModalRoot.setAttribute('id', 'modal-root');
      document.body.appendChild(newModalRoot);
      elRef.current && newModalRoot.appendChild(elRef.current);
    } else {
      elRef.current && modalRoot.appendChild(elRef.current);
    }

    return () => {
      elRef.current && elRef.current.remove();
    };
  }, []);

  return createPortal(children, elRef.current);
};

export default PdfModalWrapper;
