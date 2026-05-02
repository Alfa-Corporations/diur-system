import type React from 'react';
import { useNavigate } from 'react-router-dom';

interface SalesOption {
  id: number;
  title: string;
  description: string;
  rute: string;
}

const Sales: React.FC = () => {
  const options: Array<SalesOption> = [
    { id: 1, title: 'Nueva Venta', description: 'Inicia una venta rápida en el punto de venta local.', rute: '/pos' },
    { id: 2, title: 'Lista Venta', description: 'Revisa y administra ventas recientes y pendientes.', rute: '/orders/local' }
  ];

  const navigate = useNavigate();

  return (
    <section className='sales-page page-shell'>
      <header className='sales-header'>
        <div>
          <span className='eyebrow'>Punto de venta</span>
          <h2 className='sales-title'>Ventas en Local</h2>
          <p className='sales-subtitle'>Selecciona una acción para comenzar a trabajar con las ventas y ver el historial de transacciones de manera rápida y visual.</p>
        </div>
      </header>

      <div className='sales-grid'>
        {options.map(({ id, title, description, rute }) => (
          <button key={id} type='button' className='sales-option-card' onClick={() => navigate(rute)}>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
            <span className='sales-option-note'>Haz clic para continuar</span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default Sales;
