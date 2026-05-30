import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';
//import localDBService from '../services/localDBService';

const toNumber = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (v: unknown) => `$${toNumber(v).toFixed(2)}`;

const AccountsReceivablePage: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [search, setSearch] = useState<string>('');

  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentReference, setPaymentReference] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiService.getAccountsReceivable();
      console.log(res.accounts);
      setAccounts(res.accounts || []);
    } catch (err) {
      // fall back local
      try {
        //const local = (await localDBService.getAccountsReceivable?.()) || [];
        //setAccounts(local);
      } catch {
        setAccounts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openAccount = (acc: any) => {
    setSelectedAccount(acc);
    setPayAmount('');
    setPaymentMethod('cash');
    setPaymentReference('');
    setShowModal(true);
  };

  const handleSubmitPayment = async () => {
    if (!selectedAccount) return;
    const amt = toNumber(payAmount);
    if (amt <= 0) return alert('Ingresa un monto válido');

    setPayingId(selectedAccount.id);
    try {
      const res = await apiService.payAccountReceivable(selectedAccount.id, amt, { paymentMethod, paymentReference });
      const updated = res.account;
      setAccounts(prev => prev.map(a => (a.id === updated.id ? updated : a)));
      setSelectedAccount(updated);
      alert('Abono registrado');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo registrar el abono';
      alert(message);
    } finally {
      setPayingId(null);
      setPayAmount('');
    }
  };

  const handlePrintPaymentReceipt = (payment: any, account: any) => {
    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) return alert('Permite ventanas emergentes para imprimir');

    const html = `
      <html>
        <head>
          <title>Recibo de abono ${payment.id}</title>
          <style>body{font-family:Arial,Helvetica,sans-serif;padding:12px;color:#111827} .center{text-align:center}</style>
        </head>
        <body>
          <div class='center'><h3>Recibo de abono</h3></div>
          <div>Recibo: ${payment.id}</div>
          <div>Fecha: ${new Date(payment.createdAt).toLocaleString()}</div>
          <div>Cliente: ${account.customer?.name || account.customerName}</div>
          <div>Factura: ${account.invoice?.invoiceNumber || `#${account.invoiceId}`}</div>
          <div>Monto abonado: ${formatCurrency(payment.amount)}</div>
          <div>Método: ${payment.paymentMethod || '—'}</div>
          <div>Referencia: ${payment.paymentReference || '—'}</div>
          <hr />
          <div>Saldo restante: ${formatCurrency(account.pendingAmount)}</div>
          <div class='center' style='margin-top:16px'>Gracias</div>
        </body>
      </html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  return (
    <div className='container mt-4'>
      <div className='d-flex justify-content-between align-items-center mb-3'>
        <h2>Cuentas por Cobrar</h2>
        <div>
          <button className='btn btn-outline-secondary me-2' onClick={() => navigate(-1)}>
            ← Volver
          </button>
          <button className='btn btn-primary' onClick={() => void load()}>
            Actualizar
          </button>
        </div>
      </div>

      <div className='mb-3 d-flex gap-2'>
        <input className='form-control' placeholder='Buscar por cliente o identificación' value={search} onChange={e => setSearch(e.target.value)} />
        <button className='btn btn-outline-secondary' onClick={() => void load()}>
          Recargar
        </button>
      </div>

      {loading ? (
        <div className='text-center'>Cargando...</div>
      ) : accounts.length === 0 ? (
        <div className='text-center text-muted'>No hay cuentas por cobrar pendientes.</div>
      ) : (
        <div className='row row-cols-1 row-cols-md-2 g-3'>
          {accounts
            .filter(acc => {
              const term = search.trim().toLowerCase();
              if (!term) return true;
              const name = (acc.customer?.name || acc.customerName || '').toLowerCase();
              const idnum = (acc.customer?.identificationNumber || acc.customerIdentification || '').toString().toLowerCase();
              const invoiceNumber = (acc.invoice?.invoiceNumber || `#${acc.invoiceId}`).toLowerCase();
              return name.includes(term) || idnum.includes(term) || invoiceNumber.includes(term);
            })
            .map(acc => (
              <div key={acc.id} className='col'>
                <div className='card h-100 shadow-sm'>
                  <div className='card-body d-flex flex-column'>
                    <div className='d-flex justify-content-between align-items-start mb-3'>
                      <div>
                        <h5 className='card-title mb-1'>{acc.customer?.name || acc.customerName || 'Cliente'} </h5>
                        <p className='card-subtitle text-muted'>{acc.invoice?.invoiceNumber || `#${acc.invoiceId}`}</p>
                      </div>
                      <span className='badge bg-warning text-dark'>{acc.status || 'pending'}</span>
                    </div>
                    <div className='mb-3'>
                      <p className='mb-1'>
                        <strong>Identificación:</strong> {acc.customer?.identificationNumber || acc.customerIdentification || '—'}
                      </p>
                      <p className='mb-1'>
                        <strong>Total:</strong> {formatCurrency(acc.totalAmount)}
                      </p>
                      <p className='mb-1'>
                        <strong>Pendiente:</strong> {formatCurrency(acc.pendingAmount)}
                      </p>
                      <p className='mb-0 text-muted'>
                        <strong>Creado:</strong> {new Date(acc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className='mt-auto d-flex flex-wrap gap-2'>
                      <button className='btn btn-sm btn-primary' onClick={() => openAccount(acc)}>
                        Ver / Abonar
                      </button>
                      <button className='btn btn-sm btn-outline-secondary' onClick={() => navigate('/invoices')}>
                        Ver facturas
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Modal: Detalle de cuenta y abonos */}
      {showModal && selectedAccount && (
        <div className='modal d-block' style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className='modal-dialog modal-dialog-centered modal-fullscreen-sm-down modal-lg'>
            <div className='modal-content h-100'>
              <div className='modal-header'>
                <h5 className='modal-title'>
                  Cuenta #{selectedAccount.id} — {selectedAccount.customer?.name || selectedAccount.customerName}
                </h5>
                <button className='btn-close' onClick={() => setShowModal(false)} />
              </div>
              <div className='modal-body overflow-auto' style={{ maxHeight: 'calc(100vh - 170px)' }}>
                <div className='mb-2'>
                  <div>
                    <strong>Factura:</strong> {selectedAccount.invoice?.invoiceNumber || `#${selectedAccount.invoiceId}`}
                  </div>
                  <div>
                    <strong>Total:</strong> {formatCurrency(selectedAccount.totalAmount)}
                  </div>
                  <div>
                    <strong>Pendiente:</strong> {formatCurrency(selectedAccount.pendingAmount)}
                  </div>
                  <div>
                    <strong>Estado:</strong> {selectedAccount.status}
                  </div>
                </div>

                <div className='mb-3'>
                  <h6>Abonar</h6>
                  <div className='row g-2'>
                    <div className='col-12 col-sm-6 col-md-3'>
                      <input className='form-control' placeholder='Monto' value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                    </div>
                    <div className='col-12 col-sm-6 col-md-3'>
                      <select className='form-select' value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                        <option value='cash'>Efectivo</option>
                        <option value='card'>Tarjeta</option>
                        <option value='transfer'>Transferencia</option>
                        <option value='check'>Cheque</option>
                        <option value='other'>Otro</option>
                      </select>
                    </div>
                    <div className='col-12 col-md-4'>
                      <input className='form-control' placeholder='Referencia (opcional)' value={paymentReference} onChange={e => setPaymentReference(e.target.value)} />
                    </div>
                    <div className='col-12 col-md-2 d-grid'>
                      <button className='btn btn-success' disabled={payingId === selectedAccount.id} onClick={handleSubmitPayment}>
                        {payingId === selectedAccount.id ? 'Registrando...' : 'Abonar'}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <h6>Historial de abonos</h6>
                  {Array.isArray(selectedAccount.payments) && selectedAccount.payments.length > 0 ? (
                    <ul className='list-group'>
                      {selectedAccount.payments.map((p: any) => (
                        <li key={p.id} className='list-group-item'>
                          <div className='d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2'>
                            <div>
                              <div>
                                <strong>{formatCurrency(p.amount)}</strong> — {new Date(p.createdAt).toLocaleString()}
                              </div>
                              <div className='small text-muted'>
                                Método: {p.paymentMethod || '—'} — Ref: {p.paymentReference || '—'}
                              </div>
                            </div>
                            <button className='btn btn-sm btn-outline-secondary' onClick={() => handlePrintPaymentReceipt(p, selectedAccount)}>
                              Imprimir
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className='text-muted'>No hay abonos registrados.</div>
                  )}
                </div>
              </div>
              <div className='modal-footer'>
                <button className='btn btn-secondary' onClick={() => setShowModal(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsReceivablePage;
