import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { Employee } from '../types';
import { Gift, Calendar, FileSpreadsheet, Download, Search, Users, Award } from 'lucide-react';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx'; 

export const Aniversariantes: React.FC = () => {
  const { employees = [], settings = [], addSetting, updateSetting, removeSetting } = useData() as any;
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'BIRTHDAYS' | 'COMPANY'>('BIRTHDAYS'); // NOVO: Controle de Abas

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LÓGICA DE REDE (BANCO DE DADOS) ---
  const templateSetting = settings.find((s: any) => s.type === 'SYSTEM_TEMPLATE' && s.name === 'TEMPLATE_ANIVERSARIANTES');
  const hasTemplate = !!templateSetting?.value;

  const months = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' }, { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  // --- Extrator Seguro ---
  const extractMonthDay = (dateStr: any) => {
    if (!dateStr) return null;
    let str = String(dateStr).trim().split('T')[0].split(' ')[0];
    
    const corruptMatch = str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (corruptMatch) {
        const wrongYear = corruptMatch[1]; 
        const month = Number(corruptMatch[2]); 
        const actualDay = Number(wrongYear.substring(2)); 
        return { m: month, d: actualDay, y: Number(corruptMatch[3]) };
    }

    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
        let p0 = parts[0], p1 = parts[1], p2 = parts[2];
        if (p0.length === 4) return { y: Number(p0), m: Number(p1), d: Number(p2) }; 
        if (p2.length === 4) { 
            let m = Number(p1);
            if (m > 12) return { y: Number(p2), m: Number(p0), d: Number(p1) }; 
            return { y: Number(p2), m: Number(p1), d: Number(p0) }; 
        }
        if (p2.length === 2) {
            let m = Number(p1);
            if (m > 12) return { y: Number(p2)>50?1900+Number(p2):2000+Number(p2), m: Number(p0), d: Number(p1) }; 
            return { y: Number(p2)>50?1900+Number(p2):2000+Number(p2), m: Number(p1), d: Number(p0) }; 
        }
    }
    return null;
  };

  const activeEmployees = useMemo(() => {
    return employees.filter((emp: Employee) => emp.status === 'Ativo');
  }, [employees]);

  // PROCESSA ANIVERSARIANTES DE VIDA
  const filteredBirthdays = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return activeEmployees
      .filter((emp: Employee) => {
        const bd = extractMonthDay(emp.birthDate);
        if (!bd) return false;
        return bd.m === selectedMonth;
      })
      .map((emp: Employee) => {
        const bd = extractMonthDay(emp.birthDate)!;
        const age = bd.y ? currentYear - bd.y : null;
        return { ...emp, day: bd.d, displayExtra: age ? `${age} anos` : '-' };
      })
      .filter((emp: any) => emp.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a: any, b: any) => a.day - b.day);
  }, [activeEmployees, selectedMonth, searchTerm]);

  // PROCESSA TEMPO DE EMPRESA
  const filteredCompanyAnniversaries = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return activeEmployees
      .filter((emp: Employee) => {
        const ad = extractMonthDay(emp.admissionDate);
        // Só considera se tiver ano de admissão e for menor que o ano atual
        if (!ad || !ad.y || ad.y === currentYear) return false; 
        return ad.m === selectedMonth;
      })
      .map((emp: Employee) => {
        const ad = extractMonthDay(emp.admissionDate)!;
        const yearsOfService = currentYear - ad.y;
        return { ...emp, day: ad.d, displayExtra: `${yearsOfService} ${yearsOfService === 1 ? 'ano' : 'anos'}` };
      })
      .filter((emp: any) => emp.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a: any, b: any) => a.day - b.day);
  }, [activeEmployees, selectedMonth, searchTerm]);

  // Lista dinâmica baseada na aba
  const filteredList = activeTab === 'BIRTHDAYS' ? filteredBirthdays : filteredCompanyAnniversaries;

  // --- LÓGICA DO MODELO EXCEL NA REDE ---
  const handleTemplateClick = async () => {
    if (hasTemplate) {
      if (window.confirm("Você já possui um modelo Excel salvo na rede. Deseja substituí-lo para todos?\n\n(Clique em Cancelar caso queira apenas excluir o atual)")) {
        fileInputRef.current?.click();
      } else {
        if (window.confirm("Deseja EXCLUIR o modelo atual para todos os usuários do sistema?")) {
          await removeSetting(templateSetting.id);
          alert("Modelo removido do sistema com sucesso.");
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
    reader.onload = async (event) => {
      const base64 = event.target?.result?.toString().split(',')[1];
      if (base64) {
        if (templateSetting) {
          await updateSetting({ ...templateSetting, value: base64 });
        } else {
          await addSetting({ id: crypto.randomUUID(), type: 'SYSTEM_TEMPLATE', name: 'TEMPLATE_ANIVERSARIANTES', value: base64 });
        }
        alert('Modelo de Aniversariantes salvo na rede com sucesso! Todos os usuários já podem utilizá-lo.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
  };

  // EXPORTAÇÃO DO MÊS (Usa o modelo do Excel)
  const handleExportList = async () => {
    if (!hasTemplate || !templateSetting?.value) {
      alert("Nenhum modelo foi configurado no sistema. Por favor, suba o arquivo 'Modelo Lista de Aniversariantes.xlsx' primeiro!");
      return;
    }

    if (filteredList.length === 0) {
      alert("Não há celebrações neste mês para exportar.");
      return;
    }

    try {
      const templateBase64 = templateSetting.value;
      const byteString = atob(templateBase64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(ab);
      const sheet = workbook.worksheets[0];

      const monthName = months.find(m => m.value === selectedMonth)?.label.toUpperCase() || '';
      const c5 = sheet.getCell('C5'); 
      if (c5) {
          const title = activeTab === 'BIRTHDAYS' ? 'Aniversariantes de Vida' : 'Tempo de Empresa';
          c5.value = `${title} - ${monthName}`;
      }

      let startRow = 8;
      filteredList.forEach((emp: any, index: number) => {
        const dateStr = `${String(emp.day).padStart(2, '0')}/${String(selectedMonth).padStart(2, '0')}`;
        const row = sheet.getRow(startRow + index);
        row.getCell(1).value = emp.name;     
        row.getCell(4).value = dateStr;      
        // Se no seu Excel existir uma coluna para idade/tempo, pode injetar emp.displayExtra aqui
        row.commit();
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Celebracoes_${monthName}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      alert("Ocorreu um erro ao gerar a planilha. Verifique se o arquivo modelo salvo é válido.");
    }
  };

  // EXPORTAÇÃO GERAL 
  const handleExportAll = () => {
    if (activeEmployees.length === 0) {
      alert("Não há colaboradores ativos para exportar.");
      return;
    }

    const sortedEmployees = [...activeEmployees].sort((a: Employee, b: Employee) => {
      const bdA = extractMonthDay(a.birthDate);
      const bdB = extractMonthDay(b.birthDate);

      if (!bdA && !bdB) return a.name.localeCompare(b.name);
      if (!bdA) return 1;
      if (!bdB) return -1;
      if (bdA.m !== bdB.m) return bdA.m - bdB.m;
      if (bdA.d !== bdB.d) return bdA.d - bdB.d;
      return a.name.localeCompare(b.name);
    });

    const dataToExport = sortedEmployees.map((emp: Employee) => {
      const bd = extractMonthDay(emp.birthDate);
      const dateStr = bd ? `${String(bd.d).padStart(2, '0')}/${String(bd.m).padStart(2, '0')}` : '-';

      return {
        'Nome': emp.name,
        'Setor': emp.sector,
        'Unidade': emp.unit || '-',
        'Aniversário (Dia/Mês)': dateStr
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Todos os Aniversários");
    XLSX.writeFile(workbook, `Aniversarios_Geral_Ativos.xlsx`);
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
            <h1 className="text-2xl font-bold text-slate-800">Celebrações</h1>
            <p className="text-slate-500 text-sm">Controle de aniversários e tempo de casa</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleExportAll}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold transition-colors shadow-sm"
            title="Exporta uma planilha simples com todos os colaboradores ativos"
          >
            <Users size={18} />
            Exportar Geral
          </button>

          <button 
            onClick={handleTemplateClick}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border ${hasTemplate ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            <FileSpreadsheet size={18} />
            {hasTemplate ? 'Modelo Configurado na Rede' : 'Subir Modelo Excel'}
          </button>

          <button 
            onClick={handleExportList}
            className={`flex items-center justify-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm ${activeTab === 'BIRTHDAYS' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-amber-600 hover:bg-amber-700'}`}
          >
            <Download size={18} />
            Baixar Mês Atual
          </button>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('BIRTHDAYS')} 
          className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'BIRTHDAYS' ? 'border-pink-500 text-pink-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Gift size={18} /><span>Aniversários de Vida</span>
        </button>
        <button 
          onClick={() => setActiveTab('COMPANY')} 
          className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'COMPANY' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Award size={18} /><span>Tempo de Empresa</span>
        </button>
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
            className={`w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 ${activeTab === 'BIRTHDAYS' ? 'focus:ring-pink-500' : 'focus:ring-amber-500'}`} 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredList.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className={`font-bold uppercase tracking-wider text-[10px] ${activeTab === 'BIRTHDAYS' ? 'bg-pink-50 border-b border-pink-100 text-pink-700' : 'bg-amber-50 border-b border-amber-100 text-amber-700'}`}>
              <tr>
                <th className="p-4 pl-6 text-center w-24">Data</th>
                <th className="p-4">Colaborador</th>
                <th className="p-4 text-center">Setor</th>
                <th className="p-4 text-right pr-6">{activeTab === 'BIRTHDAYS' ? 'Idade' : 'Tempo'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.map((emp: any) => {
                const isToday = emp.day === new Date().getDate() && selectedMonth === (new Date().getMonth() + 1);
                
                return (
                  <tr key={emp.id} className={`transition-colors group ${activeTab === 'BIRTHDAYS' ? 'hover:bg-pink-50' : 'hover:bg-amber-50'}`}>
                    <td className="p-4 text-center">
                      <div className={`inline-flex flex-col items-center justify-center w-12 h-12 rounded-xl font-black text-lg shadow-sm border ${
                        isToday 
                          ? (activeTab === 'BIRTHDAYS' ? 'bg-pink-500 text-white border-pink-600 animate-pulse' : 'bg-amber-500 text-white border-amber-600 animate-pulse') 
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}>
                        {String(emp.day).padStart(2, '0')}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-800 text-base">{emp.name}</p>
                      {isToday && <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${activeTab === 'BIRTHDAYS' ? 'text-pink-600' : 'text-amber-600'}`}>🎉 É Hoje!</span>}
                    </td>
                    <td className="p-4 text-center">
                      <p className="font-bold text-slate-600">{emp.sector}</p>
                      <p className="text-xs text-slate-400">{emp.unit || '-'}</p>
                    </td>
                    <td className="p-4 text-right pr-6">
                      <span className={`px-3 py-1.5 rounded-lg font-black text-sm ${activeTab === 'BIRTHDAYS' ? 'bg-pink-50 text-pink-700' : 'bg-amber-50 text-amber-700'}`}>
                         {emp.displayExtra}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-slate-400">
            {activeTab === 'BIRTHDAYS' ? <Gift size={48} className="mx-auto mb-3 opacity-20" /> : <Award size={48} className="mx-auto mb-3 opacity-20" />}
            <p>Nenhuma celebração encontrada para este mês.</p>
          </div>
        )}
      </div>
    </div>
  );
};