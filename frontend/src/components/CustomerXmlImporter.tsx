import React, { useMemo, useState } from 'react';
import { Alert, Button, Form, Modal, ProgressBar, Table } from 'react-bootstrap';
import { parseStringPromise } from 'xml2js';
import apiService from '../services/apiService';

type CustomerField = 'name' | 'identificationNumber' | 'identificationType' | 'email' | 'phone' | 'address';
type XmlRow = { fields: Record<string, string>; file: string; row: number };
type ImportError = { file?: string; row: number; message: string };
type CustomerPayload = {
  row: number;
  source: string;
  name: string;
  identificationType: 'none' | 'cedula' | 'ruc' | 'passport';
  identificationNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
};

const FIELD_LABELS: Record<CustomerField, string> = {
  name: 'Nombre del cliente',
  identificationNumber: 'Identificación',
  identificationType: 'Tipo de identificación',
  email: 'Correo',
  phone: 'Teléfono',
  address: 'Dirección',
};

// Agrega aquí etiquetas de tu ERP para que la detección automática las reconozca.
const FIELD_ALIASES: Record<CustomerField, string[]> = {
  name: ['nombre', 'name', 'customername', 'clientename', 'razonsocial', 'nombrecliente'],
  identificationNumber: ['identificationnumber', 'identificacion', 'cedula', 'ruc', 'taxid', 'documento', 'numeroidentificacion'],
  identificationType: ['identificationtype', 'tipoidentificacion', 'tipodocumento'],
  email: ['email', 'correo', 'mail', 'correoelectronico'],
  phone: ['phone', 'telefono', 'celular', 'mobile', 'movil'],
  address: ['address', 'direccion', 'domicilio'],
};

const savedMappingKey = 'customer-xml-field-mapping';

const isXmlObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeTag = (tag: string) => tag
  .split('.')
  .pop()!
  .replace(/^@_/, '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const flattenXmlRow = (value: unknown, path = '', output: Record<string, string> = {}): Record<string, string> => {
  if (Array.isArray(value)) {
    if (value.length === 1) return flattenXmlRow(value[0], path, output);
    if (path && value.every(item => ['string', 'number', 'boolean'].includes(typeof item))) {
      output[path] = value.map(String).join(', ');
    }
    return output;
  }
  if (isXmlObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenXmlRow(child, path ? `${path}.${key}` : key, output);
    }
    return output;
  }
  if (path && value !== null && value !== undefined) output[path] = String(value).trim();
  return output;
};

const hasCustomerName = (fields: Record<string, string>) =>
  Object.keys(fields).some(key => FIELD_ALIASES.name.includes(normalizeTag(key)));

const getRowsFromXml = (xml: unknown): Record<string, string>[] => {
  let bestRows: Record<string, string>[] = [];
  let bestScore = -1;

  const consider = (values: unknown[]) => {
    const rows = values
      .filter(isXmlObject)
      .map(value => flattenXmlRow(value))
      .filter(fields => Object.keys(fields).length >= 2);
    if (!rows.length) return;
    const score = rows.length * 10
      + rows.filter(hasCustomerName).length * 100
      + rows.reduce((total, fields) => total + Object.keys(fields).length, 0);
    if (score > bestScore) {
      bestRows = rows;
      bestScore = score;
    }
  };

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      consider(value);
      value.forEach(visit);
      return;
    }
    if (!isXmlObject(value)) return;
    const row = flattenXmlRow(value);
    if (Object.keys(row).length >= 2) consider([value]);
    Object.values(value).forEach(visit);
  };

  visit(xml);
  return bestRows;
};

const loadSavedMapping = (): Partial<Record<CustomerField, string>> => {
  try {
    const saved = localStorage.getItem(savedMappingKey);
    return saved ? JSON.parse(saved) as Partial<Record<CustomerField, string>> : {};
  } catch (error) {
    console.error('Could not load the saved XML field mapping:', error);
    return {};
  }
};

const inferIdentificationType = (typeValue: string, identificationNumber: string): CustomerPayload['identificationType'] => {
  const normalizedType = typeValue.trim().toLowerCase();
  if (normalizedType.includes('ruc')) return 'ruc';
  if (normalizedType.includes('pasaporte') || normalizedType.includes('passport')) return 'passport';
  if (normalizedType.includes('cedula') || normalizedType.includes('cédula')) return 'cedula';
  if (!identificationNumber) return 'none';
  return identificationNumber.length > 10 ? 'ruc' : 'cedula';
};

interface CustomerXmlImporterProps {
  show: boolean;
  onHide: () => void;
  onImported: () => void;
}

const CustomerXmlImporter: React.FC<CustomerXmlImporterProps> = ({ show, onHide, onImported }) => {
  const [rows, setRows] = useState<XmlRow[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<CustomerField, string>>>(() => loadSavedMapping());
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: ImportError[] } | null>(null);
  const [error, setError] = useState('');

  const availableFields = useMemo(
    () => [...new Set(rows.flatMap(row => Object.keys(row.fields)))].sort(),
    [rows]
  );

  const updateMapping = (field: CustomerField, value: string) => {
    const next = { ...mapping, [field]: value };
    setMapping(next);
    try {
      localStorage.setItem(savedMappingKey, JSON.stringify(next));
    } catch (storageError) {
      console.error('Could not save the XML field mapping:', storageError);
    }
  };

  const readFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setLoadingFiles(true);
    setError('');
    setImportResult(null);
    setRows([]);
    try {
      if (files.length > 20) throw new Error('Selecciona un máximo de 20 archivos por importación.');
      const totalBytes = Array.from(files).reduce((total, file) => total + file.size, 0);
      if (totalBytes > 20 * 1024 * 1024) throw new Error('El tamaño combinado de los XML no puede superar 20 MB.');
      const importedRows: XmlRow[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} supera el límite de 5 MB.`);
        }
        const parsed = await parseStringPromise(await file.text(), { explicitArray: false, trim: true });
        const fileRows = getRowsFromXml(parsed);
        if (!fileRows.length) {
          throw new Error(`No se encontraron registros XML para mapear en ${file.name}.`);
        }
        fileRows.forEach((fields, index) => importedRows.push({
          fields,
          file: file.name,
          row: index + 1,
        }));
      }

      const allFields = [...new Set(importedRows.flatMap(row => Object.keys(row.fields)))];
      setMapping(current => {
        const next = { ...current };
        (Object.keys(FIELD_LABELS) as CustomerField[]).forEach(field => {
          if (!next[field] || !allFields.includes(next[field]!)) {
            next[field] = allFields.find(tag => FIELD_ALIASES[field].includes(normalizeTag(tag))) || '';
          }
        });
        try {
          localStorage.setItem(savedMappingKey, JSON.stringify(next));
        } catch (storageError) {
          console.error('Could not save the detected XML field mapping:', storageError);
        }
        return next;
      });
      setRows(importedRows);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'No se pudieron leer los archivos XML.');
    } finally {
      setLoadingFiles(false);
    }
  };

  const makePayload = (row: XmlRow): CustomerPayload => {
    const value = (field: CustomerField) => (mapping[field] ? row.fields[mapping[field]!] || '' : '').trim();
    const identificationNumber = value('identificationNumber');
    return {
      row: row.row,
      source: row.file,
      name: value('name'),
      identificationNumber: identificationNumber || undefined,
      identificationType: inferIdentificationType(value('identificationType'), identificationNumber),
      email: value('email') || undefined,
      phone: value('phone') || undefined,
      address: value('address') || undefined,
    };
  };

  const previewRows = rows.slice(0, 8).map(makePayload);

  const importCustomers = async () => {
    const customers = rows.map(makePayload);
    if (!customers.length) return;
    setImporting(true);
    setProgress(0);
    setError('');
    const result = { created: 0, updated: 0, errors: [] as ImportError[] };
    const chunkSize = 250;
    try {
      for (let start = 0; start < customers.length; start += chunkSize) {
        const response = await apiService.importCustomers(customers.slice(start, start + chunkSize));
        result.created += response.created;
        result.updated += response.updated;
        result.errors.push(...response.errors);
        setProgress(Math.round((Math.min(start + chunkSize, customers.length) / customers.length) * 100));
      }
      setImportResult(result);
      onImported();
    } catch (importError) {
      setImportResult(result);
      setError(importError instanceof Error ? importError.message : 'La importación se interrumpió.');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setRows([]);
    setImportResult(null);
    setError('');
    setProgress(0);
    onHide();
  };

  return (
    <Modal show={show} onHide={reset} size='xl' centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Importar clientes desde XML</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className='text-muted'>
          Selecciona uno o varios XML de hasta 5 MB cada uno. Los clientes con la misma identificación
          se actualizarán; si no tienen identificación, se comparará el nombre.
        </p>
        <Form.Group className='mb-3'>
          <Form.Label>Archivos XML</Form.Label>
          <Form.Control
            type='file'
            accept='.xml,application/xml,text/xml'
            multiple
            disabled={loadingFiles || importing}
            onChange={event => {
              const input = event.currentTarget as HTMLInputElement;
              void readFiles(input.files);
              input.value = '';
            }}
          />
        </Form.Group>

        {loadingFiles && <ProgressBar animated now={100} label='Leyendo XML...' className='mb-3' />}
        {error && <Alert variant='danger'>{error}</Alert>}
        {importResult && (
          <Alert variant={importResult.errors.length ? 'warning' : 'success'}>
            Importación terminada: {importResult.created} creados, {importResult.updated} actualizados
            {importResult.errors.length ? ` y ${importResult.errors.length} con error.` : '.'}
          </Alert>
        )}
        {importing && <ProgressBar now={progress} label={`${progress}%`} className='mb-3' />}

        {rows.length > 0 && (
          <>
            <h6>Relacionar etiquetas XML con datos del cliente</h6>
            <div className='customer-xml-mapping'>
              {(Object.keys(FIELD_LABELS) as CustomerField[]).map(field => (
                <Form.Group key={field}>
                  <Form.Label>{FIELD_LABELS[field]}</Form.Label>
                  <Form.Select
                    value={mapping[field] || ''}
                    onChange={event => updateMapping(field, event.target.value)}
                    disabled={importing}
                  >
                    <option value=''>No importar</option>
                    {availableFields.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                  </Form.Select>
                </Form.Group>
              ))}
            </div>

            <div className='table-responsive mt-3'>
              <Table striped hover size='sm'>
                <thead>
                  <tr><th>Archivo / fila</th><th>Nombre</th><th>Identificación</th><th>Correo</th><th>Teléfono</th></tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={`${rows[index].file}-${rows[index].row}-${index}`}>
                      <td>{row.source} · {rows[index].row}</td>
                      <td>{row.name || <span className='text-danger'>Falta nombre</span>}</td>
                      <td>{row.identificationNumber || '—'}</td>
                      <td>{row.email || '—'}</td>
                      <td>{row.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <small className='text-muted'>
              Vista previa de {previewRows.length} de {rows.length} clientes. Las etiquetas seleccionadas se guardan en este dispositivo.
            </small>
          </>
        )}

        {importResult && importResult.errors.length > 0 && (
          <details className='mt-3'>
            <summary>Ver errores por archivo y fila</summary>
            <ul className='mt-2 mb-0'>
              {importResult.errors.map((item, index) => (
                <li key={`${item.file}-${item.row}-${index}`}>
                  {item.file || 'XML'} · fila {item.row}: {item.message}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant='secondary' onClick={reset} disabled={importing}>Cerrar</Button>
        <Button
          variant='primary'
          onClick={() => void importCustomers()}
          disabled={!rows.length || importing || loadingFiles}
        >
          {importing ? 'Importando...' : `Importar ${rows.length} clientes`}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CustomerXmlImporter;
