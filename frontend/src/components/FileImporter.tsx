import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { parseString } from 'xml2js';
import axios from 'axios';
import apiService from '../services/apiService';

const FileImporter = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

      const json = rows.slice(1).map(row => {
        const values = row.split(',');
        const obj: any = {};

        headers.forEach((h, i) => {
          obj[h.trim()] = values[i]?.trim();
        });

        return obj;
      });

      setData(json);
    };

    reader.readAsText(file);
  };

 const transformData = () => {
   return data.map((item, i) => {
     const base = {
       // 🔥 CAMPOS CLAVE (los que tu backend necesita sí o sí)
       partnumber: item.partnumber || item.codigo || `SKU-${i}`,
       name: item.name || item.nombre || `Producto ${i}`,
       price: Number(item.price || item.precio || 0),
       stock: Number(item.stock || 0),

       cost: Number(item.costavg || item.costlast || item.costo || 0),

       brand: item.brand || 'Genérico',
       category: item.grupo || item.categoria || 'General',

       iva: Boolean(item.iva),
       isservice: Boolean(item.isservice),

       interno: item.interno || i
     };

     // 🔥 IMPORTANTE: mantener TODOS los demás campos
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

      const transformed = transformData();

      const chunkSize = 50; // 🔥 puedes ajustar (50 - 200 recomendado)
      const total = transformed.length;

      let successCount = 0;
      let errorChunks: any[] = [];

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = transformed.slice(i, i + chunkSize);

        try {
          await apiService.createProductsBulk(chunk);
          successCount += chunk.length;
        } catch (err: any) {
          console.error(`Error en lote ${i / chunkSize + 1}`, err);
          errorChunks.push({
            chunkIndex: i / chunkSize,
            error: err.message,
            data: chunk
          });
        }

        // ✅ progreso
        const progress = Math.round(((i + chunk.length) / total) * 100);
        console.log(`Progreso: ${progress}%`);

        // 👉 opcional: si tienes estado visual
        // setProgress(progress);
      }

      // 🔥 resultado final
      if (errorChunks.length > 0) {
        alert(`Importación parcial ⚠️\n` + `✔️ Éxitos: ${successCount}\n` + `❌ Lotes con error: ${errorChunks.length}`);
      } else {
        alert(`Importación completa 🚀 (${successCount} productos)`);
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Error general');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Importador de Productos</h2>

      <input type='file' onChange={handleFile} />

      <br />
      <br />

      <button onClick={sendToAPI} disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar a Base de Datos'}
      </button>

      <pre style={{ maxHeight: 300, overflow: 'auto', background: '#eee', padding: 10 }}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};;

export default FileImporter;
