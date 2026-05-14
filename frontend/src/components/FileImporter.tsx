import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { parseString } from 'xml2js';
import apiService from '../services/apiService';
import { ProgressBar, Modal, Button, Alert, Table } from 'react-bootstrap';

const FileImporter = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [importErrors, setImportErrors] = useState<any[]>([]);
  const [showErrorReport, setShowErrorReport] = useState(false);

  // 📥 Leer archivo
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.name.split('.').pop()?.toLowerCase();

    if (fileType === 'xls' || fileType === 'xlsx') {
      readExcel(file);
    } else if (fileType === 'xml') {
      readXML(file);
    } else if (fileType === 'txt') {
      readTXT(file);
    } else {
      alert('Formato no soportado');
    }
  };

  // 📊 EXCEL
  const readExcel = (file: File) => {
    const reader = new FileReader();

    reader.onload = (evt: any) => {
      const bstr = evt.target.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(sheet);
      setData(jsonData);
    };

    reader.readAsBinaryString(file);
  };

  // 📄 XML
  const readXML = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      const xml = e.target.result;

      parseString(xml, (err, result) => {
        if (err) {
          console.error(err);
          return;
        }

        // Ajusta según estructura de tu XML
        const parsed = result;
        setData(parsed);
      });
    };

    reader.readAsText(file);
  };

  // 📝 TXT
  const readTXT = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      const text = e.target.result;

      // ejemplo: CSV simple
      const rows = text.split('\n');
      const headers = rows[0].split(',');

      const json = rows.slice(1).map((row: any) => {
        const values = row.split(',');
        const obj: any = {};

        headers.forEach((h: string, i: number) => {
          obj[h.trim()] = values[i]?.trim();
        });

        return obj;
      });

      setData(json);
    };

    reader.readAsText(file);
  };

  /* 
  {
    "interno": 125,
    "partnumber": "578282",
    "name": "1  CM ROSA ESPECIAL 100X200X1",
    "brand": "RESORPEDIC",
    "price": 2.1739000045,
    "pricecaja": 2.1739000045,
    "priceb": 2.1739000045,
    "costiva": 1.9549999999999998,
    "util": 11.2,
    "stock": 97,
    "piezas": 0,
    "importacion": 0,
    "grupo": "1.01.003  ESPONJAS",
    "supplier": "INVENTARIO INICIAL",
    "costlast": 1.7,
    "costavg": 1.7,
    "iva": 1,
    "isservice": 0,
    "esnota": 0,
    "gasto": 0,
    "baja": 0,
    "idbrand": "00000010",
    "qpendout": 0,
    "salidapend": 0,
    "entradapend": 0,
    "combo": 0,
    "formula": 0,
    "pricec": 1.9565000025,
    "priced": 1.9565000025,
    "pricee": 1.9565000025,
    "pricef": 0,
    "priceg": 0,
    "priceh": 0,
    "ubicacion": "ACOPIO PRINCIPAL",
    "costo": 1.7,
    "pesoitem": 0,
    "foto": "",
    "foto2": "",
    "simboloa": "",
    "codigo2": "",
    "codigo3": "",
    "codigo4": "",
    "noteunidad": "UN",
    "otraunidad": "",
    "otraunidad2": "",
    "monedapvpa": 1,
    "monedapvpb": 1,
    "monedapvpc": 1,
    "monedapvpd": 1,
    "porcentaje": 15,
    "unidadescaja": 1,
    "laboratorio": "",
    "ubicaciones": "",
    "modelo": "",
    "pvpapublico": 0,
    "pvpbpublico": 0,
    "pvpcpublico": 0,
    "pvpdpublico": 0,
    "descesp": 0,
    "pricea2": 2.17,
    "priceb2": 2.17,
    "pricec2": 1.96,
    "priced2": 1.96
  }
  
  */

  const transformData = () => {
    return data.map((item, i) => {
      const base = {
        // 🔥 CAMPOS CLAVE (los que tu backend necesita sí o sí)
        partnumber: item.partnumber || item.codigo || `partnumber-${i}`,
        name: item.name || item.nombre || `Producto ${i}`,
        price: Number(item.price || item.precio || 0),
        stock: Number(item.stock || 0),
        providerName: item.supplier || item.proveedor || item.nombre_proveedor || item.supplierName || null,

        // 🔥 CAMPOS ADICIONALES DEL ERP
        interno: item.interno || i,
        codigo2: item.codigo2 || '',
        codigo3: item.codigo3 || '',
        codigo4: item.codigo4 || '',
        brand: item.brand || 'Genérico',
        pricecaja: Number(item.pricecaja || item.price || 0),
        priceb: Number(item.priceb || item.price || 0),
        costiva: Number(item.costiva || 0),
        util: Number(item.util || 0),
        piezas: Number(item.piezas || 0),
        importacion: Boolean(item.importacion),
        categoria: item.grupo || item.categoria || 'General',
        costlast: Number(item.costlast || 0),
        costavg: Number(item.costavg || item.costo || 0),
        iva: Boolean(item.iva),
        isservice: Boolean(item.isservice),
        esnota: Boolean(item.esnota),
        gasto: Boolean(item.gasto),
        baja: Boolean(item.baja),
        idbrand: item.idbrand || null,
        ubicacion: item.ubicacion || '',
        foto: item.foto || '',
        modelo: item.modelo || '',
        porcentaje: Number(item.porcentaje || 0),

        // 🔥 CAMPOS ADICIONALES DE PRECIOS
        pricec: Number(item.pricec || item.pricecaja || 0),
        priced: Number(item.priced || item.pricecaja || 0),
        pricee: Number(item.pricee || item.pricecaja || 0),
        pricef: Number(item.pricef || 0),
        priceg: Number(item.priceg || 0),
        priceh: Number(item.priceh || 0),

        // 🔥 CAMPOS ADICIONALES VARIOS
        pesoitem: Number(item.pesoitem || 0),
        foto2: item.foto2 || '',
        simboloa: item.simboloa || '',
        noteunidad: item.noteunidad || 'UN',
        otraunidad: item.otraunidad || '',
        otraunidad2: item.otraunidad2 || '',
        monedapvpa: Number(item.monedapvpa || 1),
        monedapvpb: Number(item.monedapvpb || 1),
        monedapvpc: Number(item.monedapvpc || 1),
        monedapvpd: Number(item.monedapvpd || 1),
        unidadescaja: Number(item.unidadescaja || 1),
        laboratorio: item.laboratorio || '',
        ubicaciones: item.ubicaciones || '',

        // 🔥 CAMPOS DE PRECIOS PÚBLICOS
        pvpapublico: Number(item.pvpapublico || 0),
        pvpbpublico: Number(item.pvpbpublico || 0),
        pvpcpublico: Number(item.pvpcpublico || 0),
        pvpdpublico: Number(item.pvpdpublico || 0),
        descesp: Number(item.descesp || 0),

        // 🔥 CAMPOS ADICIONALES DE PRECIOS 2
        pricea2: Number(item.pricea2 || item.price || 0),
        priceb2: Number(item.priceb2 || item.price || 0),
        pricec2: Number(item.pricec2 || item.pricecaja || 0),
        priced2: Number(item.priced2 || item.pricecaja || 0),

        // 🔥 CAMPOS PENDIENTES
        qpendout: Number(item.qpendout || 0),
        salidapend: Number(item.salidapend || 0),
        entradapend: Number(item.entradapend || 0),
        combo: Boolean(item.combo),
        formula: Boolean(item.formula)
      };

      // 🔥 IMPORTANTE: mantener TODOS los demás campos del archivo original
      return {
        ...item, // 👈 conserva TODO el JSON original
        ...base // 👈 sobreescribe lo importante normalizado
      };
    });
  };

  // 🚀 Enviar a API usando apiService
  const sendToAPI = async () => {
    try {
      setLoading(true);
      setProgress(0);
      setProcessedCount(0);
      setImportErrors([]);

      const transformed = transformData();
      setTotalCount(transformed.length);

      const chunkSize = 70; // 🔥 puedes ajustar (50 - 200 recomendado)
      const total = transformed.length;

      let successCount = 0;
      let allErrors: any[] = [];

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = transformed.slice(i, i + chunkSize);
        const chunkIndex = Math.floor(i / chunkSize) + 1;

        try {
          await apiService.createProductsBulk(chunk);
          successCount += chunk.length;
        } catch (err: any) {
          console.error(`Error en lote ${chunkIndex}`, err);

          // 🔥 Capturar errores detallados
          const errorDetails = {
            chunkIndex,
            chunkSize: chunk.length,
            error: err.message || 'Error desconocido',
            statusCode: err.response?.status,
            serverError: err.response?.data?.message,
            validationErrors: err.response?.data?.errors,
            failedProducts: chunk.map((product: any, index: number) => ({
              index: i + index + 1, // Número de fila original
              name: product.name || 'Sin nombre',
              partnumber: product.partnumber || 'Sin código',
              price: product.price,
              stock: product.stock,
              providerName: product.providerName,
              issues: []
            }))
          };

          // 🔥 Intentar identificar problemas específicos
          if (err.response?.data?.message) {
            errorDetails.failedProducts.forEach((product: any) => {
              // Verificar campos requeridos
              if (!product.name) product.issues.push('Nombre requerido');
              if (!product.partnumber) product.issues.push('Código/partnumber requerido');
              if (!product.price || product.price <= 0) product.issues.push('Precio inválido');
              if (!product.stock || product.stock < 0) product.issues.push('Stock inválido');
              if (!product.providerName) product.issues.push('Proveedor requerido');
            });
          }

          allErrors.push(errorDetails);
        }

        // ✅ progreso
        const currentProgress = Math.round(((i + chunk.length) / total) * 100);
        setProgress(currentProgress);
        setProcessedCount(i + chunk.length);
        console.log(`Progreso: ${currentProgress}%`);
      }

      // 🔥 resultado final
      setImportErrors(allErrors);

      if (allErrors.length > 0) {
        setShowErrorReport(true);
        alert(`Importación parcial ⚠️\n` + `✔️ Éxitos: ${successCount}\n` + `❌ Lotes con error: ${allErrors.length}\n` + `📋 Revisa el reporte de errores para detalles`);
      } else {
        alert(`Importación completa 🚀 (${successCount} productos)`);
      }
    } catch (error: any) {
      console.error('Error general:', error);
      alert(`Error general: ${error.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
      setProgress(0);
      setProcessedCount(0);
      setTotalCount(0);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Importador de Productos</h2>

      <input type='file' onChange={handleFile} className='btn' />

      <br />
      <br />

      {data.length > 0 && (
        <div className='mb-3'>
          <p>
            <strong>📊 Productos encontrados: {data.length}</strong>
          </p>
        </div>
      )}

      <button onClick={sendToAPI} disabled={loading || data.length === 0} className='btn btn-success mb-3'>
        {loading ? 'Enviando...' : 'Enviar a Base de Datos'}
      </button>

      {loading && (
        <div className='mb-3'>
          <div className='d-flex justify-content-between align-items-center mb-2'>
            <span>
              <strong>📤 Importando productos...</strong>
            </span>
            <span>
              {processedCount} / {totalCount} productos
            </span>
          </div>
          <ProgressBar now={progress} label={`${progress}%`} variant='success' animated striped style={{ height: '25px', fontSize: '14px' }} />
          <div className='text-muted mt-1'>
            Procesando lote {Math.ceil(processedCount / 70)} de {Math.ceil(totalCount / 70)}
          </div>
        </div>
      )}

      <pre style={{ maxHeight: '60vh', overflow: 'auto', background: '#eee', padding: 10 }}>{JSON.stringify(data, null, 2)}</pre>

      {/* 🔥 MODAL REPORTE DE ERRORES */}
      <Modal show={showErrorReport} onHide={() => setShowErrorReport(false)} size='xl' centered>
        <Modal.Header closeButton>
          <Modal.Title>📋 Reporte de Errores de Importación</Modal.Title>
        </Modal.Header>

        <Modal.Body style={{ maxHeight: '70vh', overflow: 'auto' }}>
          {importErrors.length > 0 && (
            <div>
              <Alert variant='warning'>
                <strong>⚠️ Se encontraron {importErrors.length} lote(s) con errores</strong>
                <br />
                Revisa los detalles abajo para identificar y corregir los problemas.
              </Alert>

              {importErrors.map((errorChunk, chunkIdx) => (
                <div key={chunkIdx} className='mb-4'>
                  <h5 className='text-danger'>
                    ❌ Lote #{errorChunk.chunkIndex} - {errorChunk.chunkSize} productos
                  </h5>

                  <Alert variant='danger'>
                    <strong>Error del servidor:</strong> {errorChunk.serverError || errorChunk.error}
                    {errorChunk.statusCode && (
                      <div>
                        <strong>Código HTTP:</strong> {errorChunk.statusCode}
                      </div>
                    )}
                  </Alert>

                  {errorChunk.validationErrors && (
                    <Alert variant='info'>
                      <strong>Errores de validación:</strong>
                      <ul className='mb-0'>
                        {Object.entries(errorChunk.validationErrors).map(([field, messages]: [string, any]) => (
                          <li key={field}>
                            <strong>{field}:</strong> {Array.isArray(messages) ? messages.join(', ') : messages}
                          </li>
                        ))}
                      </ul>
                    </Alert>
                  )}

                  <div className='table-responsive'>
                    <Table striped bordered hover size='sm'>
                      <thead>
                        <tr>
                          <th># Fila</th>
                          <th>Producto</th>
                          <th>Código</th>
                          <th>Precio</th>
                          <th>Stock</th>
                          <th>Proveedor</th>
                          <th>Problemas Detectados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errorChunk.failedProducts.map((product: any, idx: number) => (
                          <tr key={idx}>
                            <td>{product.index}</td>
                            <td className='text-truncate' style={{ maxWidth: '150px' }}>
                              {product.name}
                            </td>
                            <td>{product.partnumber}</td>
                            <td className={product.price <= 0 ? 'text-danger' : ''}>${product.price}</td>
                            <td className={product.stock < 0 ? 'text-danger' : ''}>{product.stock}</td>
                            <td className={!product.providerName ? 'text-danger' : ''}>{product.providerName || 'Sin proveedor'}</td>
                            <td>
                              {product.issues.length > 0 ? (
                                <ul className='mb-0 text-danger'>
                                  {product.issues.map((issue: string, i: number) => (
                                    <li key={i} style={{ fontSize: '0.85em' }}>
                                      {issue}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className='text-muted'>Revisar servidor</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              ))}

              <Alert variant='info'>
                <strong>💡 Consejos para solucionar errores:</strong>
                <ul className='mb-0 mt-2'>
                  <li>Verifica que todos los productos tengan nombre, código y precio válido</li>
                  <li>Asegúrate de que el proveedor esté registrado o se pueda crear automáticamente</li>
                  <li>Revisa que los códigos de producto sean únicos</li>
                  <li>Verifica que los precios sean números positivos</li>
                  <li>Para archivos grandes, considera dividirlos en lotes más pequeños</li>
                </ul>
              </Alert>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant='secondary' onClick={() => setShowErrorReport(false)}>
            Cerrar
          </Button>
          <Button
            variant='primary'
            onClick={() => {
              setShowErrorReport(false);
              setImportErrors([]);
            }}
          >
            Entendido
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default FileImporter;
