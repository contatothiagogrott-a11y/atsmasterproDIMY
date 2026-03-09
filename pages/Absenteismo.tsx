import React, { useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { DocumentType, AbsenceRecord, Employee } from '../types';
import { CalendarX, Plus, Trash2, Edit2, LayoutDashboard, FileText, AlertTriangle, Activity, Users, Clock, Download, FileSpreadsheet, Database, Sparkles, X, Info, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

export const Absenteismo: React.FC = () => {
  const { user, absences = [], addAbsence, updateAbsence, removeAbsence, employees = [], settings = [], addSetting, updateSetting, removeSetting } = useData() as any;
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cadastro'>('dashboard');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<AbsenceRecord>>({
    documentType: 'Atestado',
    reason: '',
    durationUnit: 'Dias',
    durationAmount: 1,
    absenceDate: new Date().toISOString().split('T')[0]
  });

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // --- ESTADOS DE PAGINAÇÃO (Aba Cadastros) ---
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  if (user?.role !== 'MASTER' && user?.role !== 'AUXILIAR_RH') {
    return <Navigate to="/" replace />;
  }

  const templateSetting = settings.find((s: any) => s.type === 'SYSTEM_TEMPLATE' && s.name === 'TEMPLATE_ABSENTEISMO');
  const hasTemplate = !!templateSetting?.value;

  const uniqueNames = useMemo(() => {
    const namesFromEmployees = employees.map((emp: Employee) => emp.name);
    const namesFromAbsences = absences.map((a: AbsenceRecord) => a.employeeName);
    return Array.from(new Set([...namesFromEmployees, ...namesFromAbsences])).filter(Boolean).sort();
  }, [employees, absences]);

  const uniqueReasons = useMemo(() => {
    return Array.from(new Set(absences.map((a: AbsenceRecord) => a.reason))).filter(Boolean).sort();
  }, [absences]);

  // --- EXTRATOR DE DATAS SEGURO ---
  const formatToYMD = (dateVal: any) => {
    if (!dateVal) return '';
    let str = String(dateVal).trim();
    if (/^\d{4,5}$/.test(str)) {
      const jsDate = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
      return jsDate.toISOString().split('T')[0];
    }
    str = str.split('T')[0].split(' ')[0];
    const corruptMatch = str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (corruptMatch) return `${corruptMatch[3]}-${corruptMatch[2]}-${corruptMatch[1].substring(2)}`;
    
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
        if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        else if (parts[2].length === 4) { 
            let m = Number(parts[1]);
            if (m > 12) return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
            else return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else if (parts[2].length === 2) { 
            let y = Number(parts[2]) > 50 ? 1900 + Number(parts[2]) : 2000 + Number(parts[2]);
            return `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    return str; 
  };

  const formatDateToBR = (dateStr: string) => {
    const ymd = formatToYMD(dateStr);
    if (!ymd || ymd.length < 10) return dateStr;
    const [year, month, day] = ymd.split('-');
    return `${day}/${month}/${year}`;
  };

  // --- FILTRO DE DATAS (Apenas para o Dashboard e IA) ---
  const filteredAbsences = useMemo(() => {
    return absences.filter((record: AbsenceRecord) => {
      const safeDate = formatToYMD(record.absenceDate);
      if (!safeDate) return false;
      return safeDate >= startDate && safeDate <= endDate;
    });
  }, [absences, startDate, endDate]);

  // --- HISTÓRICO GERAL (Para a aba de Cadastros) ---
  const sortedAllAbsences = useMemo(() => {
    return [...absences].sort((a, b) => {
      const dateA = formatToYMD(a.absenceDate);
      const dateB = formatToYMD(b.absenceDate);
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [absences]);

  const totalPages = Math.ceil(sortedAllAbsences.length / itemsPerPage);
  const paginatedAbsences = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAllAbsences.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAllAbsences, currentPage, itemsPerPage]);

  const formatHours = (decimalHours: number) => {
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // --- LÓGICA DE CONTROLE: LIMITE 16H ACOMPANHANTE ---
  const currentEntryHours = useMemo(() => {
    const emp = employees.find((e: Employee) => e.name.toLowerCase() === formData.employeeName?.toLowerCase());
    const workload = emp?.dailyWorkload || 8.8;
    const amount = formData.durationAmount || 0;
    return formData.durationUnit === 'Dias' ? amount * workload : amount;
  }, [formData.employeeName, formData.durationAmount, formData.durationUnit, employees]);

  const usedCompanionHoursThisYear = useMemo(() => {
    if (!formData.employeeName || !formData.absenceDate) return 0;
    const safeFormDate = formatToYMD(formData.absenceDate);
    const targetYear = safeFormDate ? parseInt(safeFormDate.split('-')[0], 10) : new Date().getFullYear();
    
    const emp = employees.find((e: Employee) => e.name.toLowerCase() === formData.employeeName?.toLowerCase());
    const workload = emp?.dailyWorkload || 8.8;

    return absences.filter((a: AbsenceRecord) => {
      if (isEditing && a.id === formData.id) return false; 
      if (a.employeeName?.toLowerCase() !== formData.employeeName?.toLowerCase()) return false;
      if (a.documentType !== 'Acompanhante de Dependente') return false;
      
      const safeRecordDate = formatToYMD(a.absenceDate);
      if (!safeRecordDate) return false;
      return parseInt(safeRecordDate.split('-')[0], 10) === targetYear;
    }).reduce((total: number, record: AbsenceRecord) => {
      let amount = record.durationAmount || 0;
      let unit = record.durationUnit;
      if (!unit && record.documentDuration) {
        const match = record.documentDuration.match(/(\d+(?:\.\d+)?)\s*(dia|hora)/i);
        if (match) {
          amount = parseFloat(match[1]);
          unit = match[2].toLowerCase().startsWith('dia') ? 'Dias' : 'Horas';
        } else { unit = 'Dias'; amount = 1; }
      }
      return unit === 'Dias' ? total + (amount * workload) : total + amount;
    }, 0);
  }, [formData.employeeName, formData.absenceDate, absences, employees, isEditing, formData.id]);

  const totalCompanionHours = usedCompanionHoursThisYear + currentEntryHours;

  const stats = useMemo(() => {
    let atestados = 0; let atestadosHours = 0;
    let declaracoes = 0; let declaracoesHours = 0;
    let injustificadas = 0; let injustificadasHours = 0;
    let acompanhamentos = 0; let acompanhamentosHours = 0;
    let totalLostHours = 0;

    const reasonCounts: Record<string, number> = {};
    const nameCounts: Record<string, number> = {};

    filteredAbsences.forEach((record: AbsenceRecord) => {
      const emp = employees.find((e: Employee) => e.name.toLowerCase() === record.employeeName?.toLowerCase());
      const workload = emp?.dailyWorkload || 8.8;

      let amount = record.durationAmount || 0;
      let unit = record.durationUnit;

      if (!unit && record.documentDuration) {
        const match = record.documentDuration.match(/(\d+(?:\.\d+)?)\s*(dia|hora)/i);
        if (match) {
          amount = parseFloat(match[1]);
          unit = match[2].toLowerCase().startsWith('dia') ? 'Dias' : 'Horas';
        } else { unit = 'Dias'; amount = 1; }
      }

      let hours = unit === 'Dias' ? amount * workload : amount;
      totalLostHours += hours;

      if (record.documentType === 'Atestado') { atestados++; atestadosHours += hours; }
      if (record.documentType === 'Declaração') { declaracoes++; declaracoesHours += hours; }
      if (record.documentType === 'Falta Injustificada') { injustificadas++; injustificadasHours += hours; }
      if (record.documentType === 'Acompanhante de Dependente') { acompanhamentos++; acompanhamentosHours += hours; }

      if (record.reason) reasonCounts[record.reason] = (reasonCounts[record.reason] || 0) + hours;
      if (record.employeeName) nameCounts[record.employeeName!] = (nameCounts[record.employeeName!] || 0) + hours;
    });

    return {
      atestados, atestadosHours,
      declaracoes, declaracoesHours,
      injustificadas, injustificadasHours,
      acompanhamentos, acompanhamentosHours,
      totalLostHours,
      topReasons: Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topNames: Object.entries(nameCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    };
  }, [filteredAbsences, employees]);

  // --- IA DE AGRUPAMENTO COM LISTA DE OCORRÊNCIAS ---
  const aiResults = useMemo(() => {
    const categoryRules = [
      { name: '👨‍👩‍👧 Acompanhamento Familiar', regex: /(filh[oa]|mãe|pai|espos[oa]|marido|dependente|acompanhante|z76|z763)/i },
      { name: '🤰 Maternidade e Saúde da Mulher', regex: /(gravidez|gesta|pr[eé][\s\-]natal|maternidade|parto|mama|menopausa|aborto|z36|z34)/i },
      { name: '🦴 Ortopedia e Traumatologia', regex: /(coluna|pescoço|cervical|muscular|mialgia|ortop|tendinite|torcicolo|lombar|costas|ciátic[oa]|lesão|lesao|fratura|osso|articula|joelho|tornozelo|pé|dedo|m25|m23|s60|s93|entorse|luxação|radiculopatia|m54)/i },
      { name: '🫁 Respiratório e Otorrino', regex: /(gripe|resfriad|covid|asma|bronquite|sinusite|rinite|tosse|garganta|pneumonia|falta de ar|j03|amigdalite|otorrino)/i },
      { name: '🤢 Gastrointestinal e Viroses', regex: /(diarreia|virose|estômago|estomago|gastrit|gástric|v[oô]mito|enjoo|intoxicação|intestinal|cólic[oa]|a09|r11|n[aá]usea|vesícula|visicula|apendicite)/i },
      { name: '👁️ Oftalmologia', regex: /(olho|visão|visao|vista|catarata|conjuntivite|h10|h26|oftalm|optometria)/i },
      { name: '🏥 Procedimentos e Cirurgias', regex: /(cirurgi|operat|pós[\s\-]op|pos[\s\-]op|cateterismo|internação|repouso)/i },
      { name: '🧠 Saúde Mental e Neurológica', regex: /(ansiedade|depressão|depressivo|estresse|burnout|psiqui|psicol|pânico|tontura|instabilidade|r42|r51|cefal[eé]ia|cabeça|neuro|f32)/i },
      { name: '🦷 Odontologia', regex: /(dente|dentista|odontol|siso|canal)/i },
      { name: '❤️ Cardiovascular', regex: /(press[aã]o|hipertens[aã]o|coraç[aã]o|infarto|i10|sopro)/i },
      { name: '💧 Urologia e Nefrologia', regex: /(rim|rins|urin[aá]ri|n20|calculose)/i },
      { name: '💊 Endócrino e Nutricional', regex: /(diabetes|e14|tireoide|hipotireoidismo|e03|obesidade|e66|vitamina|e53)/i },
      { name: '🩸 Exames e Avaliações', regex: /(exame|sangue|rotina|check[\s\-]up|laborat|ultrasson|raio[\s\-]x|ressonância|ressonancia|coleta|biológico|z00|consulta de retorno|consulta para exame)/i },
      { name: '🏢 Assuntos Pessoais (Admin)', regex: /(cnh|boletim|ocorrência|faculdade|matrícula|particular)/i },
      { name: '⚠️ Dores Gerais e Mal Estar', regex: /(mal estar|r52|dor aguda|dor na)/i }
    ];

    const categories: Record<string, { hours: number, reasons: Set<string>, records: any[] }> = {};
    
    categoryRules.forEach(rule => { categories[rule.name] = { hours: 0, reasons: new Set(), records: [] }; });
    categories['🚫 Falta Injustificada'] = { hours: 0, reasons: new Set(), records: [] };
    categories['❓ Outros Motivos / Diversos'] = { hours: 0, reasons: new Set(), records: [] };

    filteredAbsences.forEach((record: AbsenceRecord) => {
        const reason = (record.reason || '').toLowerCase();
        const emp = employees.find((e: Employee) => e.name.toLowerCase() === record.employeeName?.toLowerCase());
        const workload = emp?.dailyWorkload || 8.8;
        
        let amount = record.durationAmount || 0;
        let unit = record.durationUnit;
        if (!unit && record.documentDuration) {
          const match = record.documentDuration.match(/(\d+(?:\.\d+)?)\s*(dia|hora)/i);
          if (match) {
            amount = parseFloat(match[1]);
            unit = match[2].toLowerCase().startsWith('dia') ? 'Dias' : 'Horas';
          } else { unit = 'Dias'; amount = 1; }
        }
        let hours = (unit === 'Dias') ? amount * workload : amount;

        let matchedCategory = '❓ Outros Motivos / Diversos';
        
        if (record.documentType === 'Falta Injustificada') {
           matchedCategory = '🚫 Falta Injustificada';
        } else if (record.documentType === 'Acompanhante de Dependente') {
           matchedCategory = '👨‍👩‍👧 Acompanhamento Familiar';
        } else {
           for (const rule of categoryRules) {
             if (rule.regex.test(reason)) {
               matchedCategory = rule.name;
               break;
             }
           }
        }

        if (!categories[matchedCategory]) {
           matchedCategory = '❓ Outros Motivos / Diversos';
        }

        categories[matchedCategory].hours += hours;
        categories[matchedCategory].reasons.add(record.reason || 'Sem descrição');
        categories[matchedCategory].records.push({
           name: record.employeeName,
           reason: record.reason,
           duration: record.documentDuration,
           date: record.absenceDate
        });
    });

    return Object.entries(categories)
      .filter(([_, data]) => data.hours > 0)
      .map(([category, data]) => ({
        category,
        hours: data.hours,
        reasons: Array.from(data.reasons),
        records: data.records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [filteredAbsences, employees]);

  // --- LÓGICA DO MODELO EXCEL ---
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
          await addSetting({ id: crypto.randomUUID(), type: 'SYSTEM_TEMPLATE', name: 'TEMPLATE_ABSENTEISMO', value: base64 });
        }
        alert('Modelo de Absenteísmo salvo na rede com sucesso!');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
  };

  const handleExportWithTemplate = async () => {
    if (!hasTemplate || !templateSetting?.value) {
      alert("Nenhum modelo foi configurado no sistema. Por favor, suba o seu modelo Excel primeiro clicando em 'Subir Modelo'!");
      return;
    }

    if (filteredAbsences.length === 0) {
      alert("Não há registros neste período para exportar.");
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

      const c5 = sheet.getCell('C5'); 
      if (c5) c5.value = `${formatDateToBR(startDate)} até ${formatDateToBR(endDate)}`;

      const exportData = filteredAbsences.map((record: AbsenceRecord) => {
        const emp = employees.find((e: Employee) => e.name.toLowerCase() === record.employeeName?.toLowerCase());
        return {
          date: formatDateToBR(record.absenceDate),
          name: record.employeeName || '',
          sector: emp?.sector || '-',
          unit: emp?.unit || '-',
          doc: record.documentType || '',
          reason: record.reason || '-',
          duration: record.documentDuration || '-'
        };
      }).sort((a, b) => {
        const [d1, m1, y1] = a.date.split('/');
        const [d2, m2, y2] = b.date.split('/');
        return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime();
      });

      let startRow = 8;
      exportData.forEach((rowObj, index) => {
        const row = sheet.getRow(startRow + index);
        row.getCell(1).value = rowObj.date;       
        row.getCell(2).value = rowObj.name;       
        row.getCell(4).value = rowObj.reason;     
        row.getCell(5).value = rowObj.doc;        
        row.getCell(6).value = rowObj.sector;     
        row.getCell(7).value = rowObj.unit;       
        row.getCell(8).value = rowObj.duration;   
        row.commit();
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const startStr = startDate.split('-').reverse().join('-');
      const endStr = endDate.split('-').reverse().join('-');
      a.download = `Absenteismo_${startStr}_a_${endStr}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      alert("Ocorreu um erro ao gerar a planilha. Verifique se o modelo salvo é válido.");
    }
  };

  const handleExportGeneral = () => {
    if (filteredAbsences.length === 0) {
      alert('Não há registros para exportar no período selecionado.');
      return;
    }
    const exportData = filteredAbsences.map((record: AbsenceRecord) => {
      const emp = employees.find((e: Employee) => e.name.toLowerCase() === record.employeeName?.toLowerCase());
      return {
        'Data da Falta': formatDateToBR(record.absenceDate),
        'Nome Colaborador': record.employeeName,
        'Setor': emp?.sector || 'Não Cadastrado',
        'Unidade': emp?.unit || 'Não Cadastrado',
        'Documento': record.documentType,
        'Motivo / CID': record.reason || '-',
        'Tempo': record.documentDuration || '-'
      };
    }).sort((a, b) => {
      const [d1, m1, y1] = a['Data da Falta'].split('/');
      const [d2, m2, y2] = b['Data da Falta'].split('/');
      return new Date(`${y2}-${m2}-${d2}`).getTime() - new Date(`${y1}-${m1}-${d1}`).getTime();
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Absenteísmo");
    
    const startStr = startDate.split('-').reverse().join('-');
    const endStr = endDate.split('-').reverse().join('-');
    XLSX.writeFile(workbook, `Absenteismo_Geral_${startStr}_a_${endStr}.xlsx`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: name === 'durationAmount' ? Number(value) : value }));
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUnit = e.target.value as 'Dias' | 'Horas';
    setFormData(prev => ({ ...prev, durationUnit: newUnit, durationAmount: newUnit === 'Dias' ? 1 : 0 }));
  };

  const currentHours = Math.floor(formData.durationAmount || 0);
  const currentMinutes = Math.round(((formData.durationAmount || 0) - currentHours) * 60);

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Number(e.target.value) || 0;
    setFormData(prev => ({ ...prev, durationAmount: h + (currentMinutes / 60) }));
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const m = Number(e.target.value) || 0;
    setFormData(prev => ({ ...prev, durationAmount: currentHours + (m / 60) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.absenceDate) {
      const safeDate = formatToYMD(formData.absenceDate);
      const selectedYear = safeDate ? parseInt(safeDate.split('-')[0], 10) : new Date().getFullYear();
      const currentYear = new Date().getFullYear();
      if (selectedYear < currentYear - 1 || selectedYear > currentYear + 1) {
        const confirmYear = window.confirm(`⚠️ AVISO DE SEGURANÇA ⚠️\n\nVocê selecionou o ano de ${selectedYear}.\n\nIsso está fora do padrão (ano passado ou próximo ano). Deseja realmente salvar o registro com este ano?`);
        if (!confirmYear) return;
      }
    }
    
    const unit = formData.durationUnit || 'Dias';
    const amount = formData.durationAmount || 0;
    
    let displayDuration = `${amount} ${unit}`;
    if (unit === 'Horas') {
      const h = Math.floor(amount);
      const m = Math.round((amount - h) * 60);
      if (h > 0 && m > 0) displayDuration = `${h}h ${m}m`;
      else if (h > 0) displayDuration = `${h}h`;
      else displayDuration = `${m}m`;
    } else {
      displayDuration = amount === 1 ? '1 Dia' : `${amount} Dias`;
    }
    
    const newAbsence: AbsenceRecord = {
      ...(formData as AbsenceRecord),
      durationUnit: unit,
      durationAmount: amount,
      documentDuration: displayDuration, 
      id: isEditing && formData.id ? formData.id : crypto.randomUUID(),
      createdAt: isEditing && formData.createdAt ? formData.createdAt : new Date().toISOString()
    };

    if (isEditing && formData.id) { await updateAbsence(newAbsence); } 
    else { await addAbsence(newAbsence); }
    
    setFormData({ documentType: 'Atestado', reason: '', durationUnit: 'Dias', durationAmount: 1, absenceDate: new Date().toISOString().split('T')[0] });
    setIsEditing(false);
  };

  const handleEdit = (record: AbsenceRecord) => {
    let amount = record.durationAmount;
    let unit = record.durationUnit;
    if (!unit && record.documentDuration) {
      const hMatch = record.documentDuration.match(/(\d+)h/i);
      const mMatch = record.documentDuration.match(/(\d+)m/i);
      if (hMatch || mMatch) {
          const h = hMatch ? parseInt(hMatch[1]) : 0;
          const m = mMatch ? parseInt(mMatch[1]) : 0;
          amount = h + (m / 60);
          unit = 'Horas';
      } else {
          const match = record.documentDuration.match(/(\d+(?:\.\d+)?)\s*(dia|hora)/i);
          if (match) {
              amount = parseFloat(match[1]);
              unit = match[2].toLowerCase().startsWith('dia') ? 'Dias' : 'Horas';
          } else {
              unit = 'Dias'; amount = 1;
          }
      }
    }
    
    const editSafeDate = formatToYMD(record.absenceDate) || record.absenceDate;
    
    setFormData({ 
      ...record, 
      absenceDate: editSafeDate,
      durationAmount: amount, 
      durationUnit: unit || 'Dias' 
    });
    setIsEditing(true);
    setActiveTab('cadastro');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      await removeAbsence(id);
      const isLastItemOnPage = paginatedAbsences.length === 1;
      if (isLastItemOnPage && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <input type="file" accept=".xlsx" className="hidden" ref={fileInputRef} onChange={handleTemplateUpload} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
            <CalendarX size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Absenteísmo</h1>
            <p className="text-slate-500 text-sm">Monitoramento de Faltas e Horas Perdidas</p>
          </div>
        </div>

        <button 
          onClick={() => setShowAiPanel(!showAiPanel)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${
            showAiPanel 
              ? 'bg-purple-100 text-purple-700 border border-purple-200' 
              : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-purple-200'
          }`}
        >
          <Sparkles size={18} />
          {showAiPanel ? 'Ocultar Análise IA' : 'Análise Inteligente (IA)'}
        </button>
      </div>

      <div className="flex space-x-2 border-b border-slate-200">
        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'dashboard' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <LayoutDashboard size={18} /><span>Dashboard Analítico</span>
        </button>
        <button onClick={() => setActiveTab('cadastro')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'cadastro' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <FileText size={18} /><span>Cadastros & Registros</span>
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col xl:flex-row xl:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="font-semibold text-slate-700 text-sm whitespace-nowrap">Período de Análise:</span>
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <span className="text-slate-400">até</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            <div className="xl:ml-auto flex flex-wrap items-center gap-3">
              <div className="text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-lg">
                <b>{filteredAbsences.length}</b> Ocorrências
              </div>
              <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg flex items-center gap-1.5">
                <Clock size={14}/> Total: {formatHours(stats.totalLostHours)} Perdidas
              </div>
              
              <div className="flex flex-wrap gap-2 ml-auto sm:ml-0 w-full sm:w-auto">
                <button onClick={handleExportGeneral} className="flex flex-1 sm:flex-none items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold text-sm transition-colors" title="Exporta uma planilha simples">
                  <Database size={16} /> Exportar Geral
                </button>
                <button onClick={handleTemplateClick} className={`flex flex-1 sm:flex-none items-center justify-center gap-2 px-3 py-2 rounded-lg font-bold text-sm transition-all border ${hasTemplate ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                  <FileSpreadsheet size={16} /> {hasTemplate ? 'Modelo Configurado' : 'Subir Modelo'}
                </button>
                <button onClick={handleExportWithTemplate} className="flex flex-1 sm:flex-none items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm">
                  <Download size={16} /> Exportar no Modelo
                </button>
              </div>
            </div>
          </div>

          {/* PAINEL EXPANSÍVEL DA IA (COM CLIQUE PARA DETALHES) */}
          {showAiPanel && (
            <div className="bg-white rounded-3xl shadow-sm border border-purple-200 overflow-hidden animate-in fade-in slide-in-from-top-4">
              <div className="p-6 border-b border-purple-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50">
                  <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md">
                          <Sparkles size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-indigo-900 uppercase tracking-tighter">
                            Análise Inteligente de Saúde
                        </h2>
                        <p className="text-sm text-indigo-700">Clique nas categorias abaixo para ver quem são os colaboradores de cada agrupamento.</p>
                      </div>
                  </div>
                  <button onClick={() => setShowAiPanel(false)} className="p-2 hover:bg-white rounded-full text-indigo-400 hover:text-purple-600 transition-all">
                      <X size={24} />
                  </button>
              </div>
              <div className="p-6 bg-slate-50/50">
                  {aiResults.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-medium">
                      Não há dados registrados neste período para gerar a análise.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
                      {aiResults.map((result, i) => (
                        <div key={i} className={`bg-white rounded-2xl border transition-colors flex flex-col overflow-hidden shadow-sm ${expandedCategory === result.category ? 'border-purple-400 ring-4 ring-purple-50' : 'border-slate-200 hover:border-purple-300'}`}>
                          <div 
                            className="p-5 cursor-pointer flex flex-col h-full select-none"
                            onClick={() => setExpandedCategory(expandedCategory === result.category ? null : result.category)}
                          >
                            <div className="flex-1">
                              <div className="flex justify-between items-start gap-2 mb-3">
                                <h4 className="font-bold text-slate-800 leading-tight">{result.category}</h4>
                                <div className={`p-1 rounded-full transition-colors ${expandedCategory === result.category ? 'bg-purple-100 text-purple-700' : 'bg-slate-50 text-slate-400'}`}>
                                   {expandedCategory === result.category ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                                <b className="text-slate-600">Termos lidos:</b> {result.reasons.join(', ')}.
                              </p>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-auto">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tempo Perdido</span>
                              <span className="font-black text-xl text-purple-700">{formatHours(result.hours)}</span>
                            </div>
                          </div>
                          
                          {/* LISTA EXPANDIDA DOS COLABORADORES DA CATEGORIA */}
                          {expandedCategory === result.category && (
                            <div className="bg-slate-50 border-t border-purple-100 p-4 animate-in slide-in-from-top-2">
                               <ul className="space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                                 {result.records.map((rec, idx) => (
                                   <li key={idx} className="text-xs flex flex-col gap-1.5 pb-3 border-b border-slate-200 last:border-0 last:pb-0">
                                      <div className="flex justify-between items-start gap-2">
                                         <span className="font-bold text-slate-800">{rec.name}</span>
                                         <span className="font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded shrink-0">{rec.duration}</span>
                                      </div>
                                      <div className="flex justify-between items-center gap-2">
                                         <span className="text-slate-500 truncate" title={rec.reason}>{rec.reason}</span>
                                         <span className="text-slate-400 font-medium shrink-0">{formatDateToBR(rec.date)}</span>
                                      </div>
                                   </li>
                                 ))}
                               </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-red-600">Faltas Injustificadas</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatHours(stats.injustificadasHours)}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">em {stats.injustificadas} registros</p>
              </div>
              <div className="p-3 bg-red-50 text-red-600 rounded-full"><AlertTriangle size={24} /></div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-600">Atestados (Médico)</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatHours(stats.atestadosHours)}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">em {stats.atestados} registros</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full"><Activity size={24} /></div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-600">Declarações (Horas)</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatHours(stats.declaracoesHours)}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">em {stats.declaracoes} registros</p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-full"><FileText size={24} /></div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-indigo-600">Acompanhamentos</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatHours(stats.acompanhamentosHours)}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">em {stats.acompanhamentos} registros</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full"><Users size={24} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Principais Motivos Originais</h3>
              {stats.topReasons.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">Nenhum dado registrado neste período.</p>
              ) : (
                <ul className="space-y-3">
                  {stats.topReasons.map(([reason, hours], index) => (
                    <li key={index} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-slate-700">{reason}</span>
                      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-bold">{formatHours(hours)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Colaboradores com mais Ausências</h3>
              {stats.topNames.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">Nenhum dado registrado neste período.</p>
              ) : (
                <ul className="space-y-3">
                  {stats.topNames.map(([name, hours], index) => (
                    <li key={index} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-slate-700">{name}</span>
                      <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full font-bold">{formatHours(hours)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cadastro' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
          
          <datalist id="employee-names">
            {uniqueNames.map((name, i) => <option key={i} value={name} />)}
          </datalist>
          <datalist id="absence-reasons">
            {uniqueReasons.map((reason, i) => <option key={i} value={reason} />)}
          </datalist>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus size={20} className="text-blue-600" />
              {isEditing ? 'Editar Registro' : 'Novo Registro'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4 flex flex-col">
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Nome do Colaborador
                <input type="text" name="employeeName" list="employee-names" value={formData.employeeName || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Selecione ou digite o nome..." />
              </label>

              <label className="flex flex-col text-sm font-medium text-slate-700">
                Data de Início
                <input type="date" name="absenceDate" value={formData.absenceDate || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </label>

              <label className="flex flex-col text-sm font-medium text-slate-700">
                Unidade de Tempo
                <select name="durationUnit" value={formData.durationUnit || 'Dias'} onChange={handleUnitChange} className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="Dias">Dias (Jornada Integral)</option>
                  <option value="Horas">Horas Fixas</option>
                </select>
              </label>

              {formData.durationUnit === 'Dias' ? (
                <label className="flex flex-col text-sm font-medium text-slate-700">
                  Quantidade de Dias
                  <input type="number" step="0.5" min="0" name="durationAmount" value={formData.durationAmount || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: 2" />
                </label>
              ) : (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="flex flex-col text-sm font-bold text-slate-600">
                    Horas
                    <input type="number" min="0" value={currentHours} onChange={handleHourChange} className="mt-1 border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white" placeholder="Ex: 2" />
                  </label>
                  <label className="flex flex-col text-sm font-bold text-slate-600">
                    Minutos
                    <input type="number" min="0" max="59" value={currentMinutes} onChange={handleMinuteChange} className="mt-1 border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white" placeholder="Ex: 30" />
                  </label>
                </div>
              )}

              <label className="flex flex-col text-sm font-medium text-slate-700">
                Tipo de Registro
                <select name="documentType" value={formData.documentType || 'Atestado'} onChange={handleInputChange} className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="Atestado">Atestado Médico</option>
                  <option value="Declaração">Declaração de Horas</option>
                  <option value="Acompanhante de Dependente">Acompanhante de Dependente</option>
                  <option value="Falta Injustificada">Falta Injustificada</option>
                </select>
              </label>
              
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Motivo da Ausência / CID
                <input type="text" name="reason" list="absence-reasons" value={formData.reason || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Dor de cabeça, Conjuntivite..." />
              </label>

              {formData.documentType === 'Acompanhante de Dependente' && (
                <div className="flex flex-col gap-3 bg-blue-50/50 p-4 border border-blue-100 rounded-lg mt-2">
                  <label className="flex flex-col text-sm font-medium text-slate-700">
                    Nome do Dependente
                    <input type="text" name="companionName" value={formData.companionName || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                  </label>
                  <label className="flex flex-col text-sm font-medium text-slate-700">
                    Vínculo (Ex: Filho)
                    <input type="text" name="companionBond" value={formData.companionBond || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                  </label>
                </div>
              )}

              {/* AVISO DO LIMITE DE 16H ANUAIS P/ ACOMPANHANTE */}
              {formData.documentType === 'Acompanhante de Dependente' && formData.employeeName && formData.absenceDate && (
                <div className={`p-4 rounded-xl border mt-4 ${totalCompanionHours > 16 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                  <div className="flex items-start gap-3">
                    <Info className="shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="text-sm font-bold">Limite Legal (16h/Ano)</p>
                      <p className="text-xs mt-1">Este colaborador já utilizou <b>{formatHours(usedCompanionHoursThisYear)}</b> neste ano.</p>
                      
                      {totalCompanionHours > 16 ? (
                        <p className="text-xs mt-1 font-medium text-amber-700">
                          Com este registro ({formatHours(currentEntryHours)}), o total passará para <b>{formatHours(totalCompanionHours)}</b>.<br/><br/>
                          ⚠️ As <b>{formatHours(totalCompanionHours - 16)} excedentes</b> devem ser debitadas do Banco de Horas.
                        </p>
                      ) : (
                        <p className="text-xs mt-1 text-blue-700">
                          Com este registro ({formatHours(currentEntryHours)}), o total será <b>{formatHours(totalCompanionHours)}</b>. <br/>Ainda restam {formatHours(16 - totalCompanionHours)}.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white font-semibold p-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                  {isEditing ? 'Salvar Alterações' : 'Registrar Ausência'}
                </button>
                {isEditing && (
                  <button type="button" onClick={() => { setIsEditing(false); setFormData({ documentType: 'Atestado', reason: '', durationUnit: 'Dias', durationAmount: 1, absenceDate: new Date().toISOString().split('T')[0] }); }} className="bg-slate-200 text-slate-700 font-semibold p-2.5 rounded-lg hover:bg-slate-300 transition-colors">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Histórico Geral de Registros</h2>
            </div>
            
            <div className="overflow-x-auto flex-1">
              {sortedAllAbsences.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-400 py-10">
                  <CalendarX size={48} className="mb-3 opacity-20" />
                  <p>Nenhum registro no banco de dados.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-white">
                      <th className="py-3 px-4 font-semibold">Colaborador / Motivo</th>
                      <th className="py-3 px-4 font-semibold">Data e Duração</th>
                      <th className="py-3 px-4 font-semibold">Tipo</th>
                      <th className="py-3 px-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedAbsences.map((record: AbsenceRecord) => (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors text-sm text-slate-700">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800">{record.employeeName}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[200px]" title={record.reason}>{record.reason}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{formatDateToBR(record.absenceDate)}</p>
                          <p className="text-xs font-bold text-slate-400">
                            {record.documentDuration}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider inline-block ${
                            record.documentType === 'Atestado' ? 'bg-blue-100 text-blue-700' : 
                            record.documentType === 'Declaração' ? 'bg-amber-100 text-amber-700' : 
                            record.documentType === 'Falta Injustificada' ? 'bg-red-100 text-red-700' :
                            'bg-indigo-100 text-indigo-700'
                          }`}>
                            {record.documentType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button onClick={() => handleEdit(record)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded mr-1" title="Editar">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(record.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* --- CONTROLES DE PAGINAÇÃO --- */}
            {sortedAllAbsences.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2 text-slate-500 font-medium">
                  <span>Mostrar</span>
                  <select 
                    className="border border-slate-300 rounded-lg p-1.5 outline-none bg-white font-bold text-slate-700 cursor-pointer"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span>por página</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-slate-500 font-medium">
                    Página <b className="text-slate-700">{currentPage}</b> de <b className="text-slate-700">{totalPages || 1}</b> ({sortedAllAbsences.length} registros)
                  </span>
                  <div className="flex gap-1">
                    <button 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 hover:text-blue-600 transition-colors"
                      title="Página Anterior"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button 
                      disabled={currentPage === totalPages || totalPages === 0}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 hover:text-blue-600 transition-colors"
                      title="Próxima Página"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Absenteismo;