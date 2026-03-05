import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Employee } from '../types';
import { Gift, Calendar, FileSpreadsheet, Download, Search } from 'lucide-react';
import ExcelJS from 'exceljs';

export const Aniversariantes: React.FC = () => {
  const { employees = [] } = useData() as any;
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [searchTerm, setSearchTerm] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasTemplate, setHasTemplate] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('ats_excel_template_aniversariantes')) {
      setHasTemplate(true);
    }
  }, []);

  const months = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' }, { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  // --- Extrator Seguro (Resolve as datas corrompidas do BD) ---
  const extractMonthDay = (dateStr: any) => {
    if (!dateStr) return null;
    let str = String(dateStr).trim().split('T')[0].split(' ')[0];
    
    // Corrige instantaneamente as datas com o bug do ano trocado (Ex: 2028-03-1970)
    const corruptMatch = str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (corruptMatch) {
        const wrongYear = corruptMatch[1]; 
        const month = Number(corruptMatch[2]); 
        const actualDay = Number(wrongYear.substring(2)); // Pega os últimos 2 dígitos do falso ano
        return { m: month, d: actualDay };
    }

    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
        let p0 = parts[0], p1 = parts[1], p2 = parts[2];
        
        if (p0.length === 4) return { m: Number(p1), d: Number(p2) }; 
        if (p2.length === 4) { 
            let m = Number(p1);
            if (m > 12) return { m: Number(p0), d: Number(p1) }; 
            return { m: Number(p1), d: Number(p0) }; 
        }
        if (p2.length === 2) {
            let m = Number(p1);
            if (m > 12) return { m: Number(p0), d: Number(p1) }; 
            return { m: Number(p1), d: Number(p0) }; 
        }
    }
    return null;
  };

  const filteredEmployees = useMemo(() => {
    return employees
      .filter((emp: Employee) => emp.status === 'Ativo') 
      .filter((emp: Employee) => {
        const bd = extractMonthDay(emp.birthDate);
        if (!bd) return false;
        return bd.m === selectedMonth;
      })
      .filter((emp: Employee) => emp.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a: Employee, b: Employee) => {
        const bdA = extractMonthDay(a.birthDate)!;
        const bdB = extractMonthDay(b.birthDate)!;
        return bdA.d - bdB.d;
      });
  }, [employees, selectedMonth, searchTerm]);

  // --- LÓGICA DO MODELO EXCEL ---
  const handleTemplateClick = () => {
    if (hasTemplate) {
      if (window.confirm("Você já possui um modelo Excel salvo. Deseja substituí-lo?\n\n(Clique em Cancelar caso queira excluir o atual)")) {
        fileInputRef.current?.click();
      } else {
        if (window.confirm("Deseja EXCLUIR o modelo atual?")) {
          localStorage.removeItem('ats_excel_template_aniversariantes');
          setHasTemplate(false);
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result?.toString().split(',')[1];
      if (base64) {
        localStorage.setItem('ats_excel_template_aniversariantes', base64);
        setHasTemplate(true);
        alert('Modelo de Aniversariantes salvo com sucesso!');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
  };

  const handleExportList = async () => {
    const templateBase64 = localStorage.getItem('ats_excel_template_aniversariantes');

    if (!templateBase64) {
      alert("Por favor, suba o seu arquivo 'Modelo Lista de Aniversariantes.xlsx' clicando no botão branco antes de exportar!");
      return;
    }

    if (filteredEmployees.length === 0) {
      alert("Não há aniversariantes neste mês para exportar.");
      return;
    }

    try {
      const byteString = atob(templateBase64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(ab);
      const sheet = workbook.worksheets[0];

      const monthName = months.find(m => m.value === selectedMonth)?.label.toUpperCase() || '';
      
      const c5 = sheet.getCell('C5'); 
      if (c5) c5.value = monthName;

      let startRow = 8;
      filteredEmployees.forEach((emp: Employee, index) => {
        const bd = extractMonthDay(emp.birthDate);
        const dateStr = bd ? `${String(bd.d).padStart(2, '0')}/${String(bd.m).padStart(2, '0')}` : '';

        const row = sheet.getRow(startRow + index);
        row.getCell(1).value = emp.name;     
        row.getCell(4).value = dateStr;      
        row.commit();
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Aniversariantes_${monthName}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      alert("Ocorreu um erro ao gerar a planilha. Verifique se o arquivo modelo está correto.");
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      <input type="file" accept=".xlsx" className="hidden" ref={fileInputRef} onChange={handleTemplateUpload} />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-pink-600 text-white rounded-xl shadow-lg shadow-pink-200">
            <Gift size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Aniversariantes</h1>
            <p className="text-slate-500 text-sm">Controle de aniversários e exportação da lista</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleTemplateClick}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border ${hasTemplate ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            <FileSpreadsheet size={18} />
            {hasTemplate ? 'Modelo Configurado' : 'Subir Modelo Excel'}
          </button>

          <button 
            onClick={handleExportList}
            className="flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm"
          >
            <Download size={18} />
            Exportar Mês Atual
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg border border-slate-200 flex-1 sm:flex-none">
          <Calendar size={18} className="text-slate-400" />
          <select 
            className="bg-transparent py-2.5 text-sm font-bold outline-none cursor-pointer w-full text-slate-700"
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
          >
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome..." 
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredEmployees.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4 pl-6">Data</th>
                <th className="p-4">Colaborador</th>
                <th className="p-4 text-center">Setor</th>
                <th className="p-4 text-right pr-6">Unidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp: Employee) => {
                const bd = extractMonthDay(emp.birthDate);
                const isToday = bd && bd.m === (new Date().getMonth() + 1) && bd.d === new Date().getDate();
                
                return (
                  <tr key={emp.id} className="hover:bg-pink-50 transition-colors group">
                    <td className="p-4 pl-6 font-black text-pink-600">
                      {bd ? `${String(bd.d).padStart(2, '0')}/${String(bd.m).padStart(2, '0')}` : '-'}
                      {isToday && <span className="ml-2 bg-pink-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase animate-pulse">Hoje!</span>}
                    </td>
                    <td className="p-4 font-bold text-slate-700">{emp.name}</td>
                    <td className="p-4 text-center text-slate-500">{emp.sector}</td>
                    <td className="p-4 text-right pr-6 text-slate-500">{emp.unit || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-slate-400">
            <Gift size={48} className="mx-auto mb-3 opacity-20" />
            <p>Nenhum aniversariante encontrado neste mês.</p>
          </div>
        )}
      </div>
    </div>
  );
};