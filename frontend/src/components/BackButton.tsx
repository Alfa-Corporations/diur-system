import React from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const BackButton: React.FC<{ to?: string }> = ({ to }) => {
  const navigate = useNavigate();
  return (
    <Button
      variant='light'
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className='d-flex align-items-center gap-2 border-0 shadow-sm'
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        background: 'transparent',
        color: '#333'
      }}
    >
      <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <polyline points='15 18 9 12 15 6' />
      </svg>
      <span className='d-none d-md-inline' style={{ fontSize: 14 }}>
        Atrás
      </span>
    </Button>
  );
};

export default BackButton;
