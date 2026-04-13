import React, { useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { DocumentType, AbsenceRecord, Employee } from '../types';
import { CalendarX, Plus, Trash2, Edit2, LayoutDashboard, FileText, AlertTriangle, Activity, Users, Clock, Download, FileSpreadsheet, Database, Sparkles, X, Info, ChevronLeft, ChevronRight, ShieldAlert, ChevronDown, ChevronUp, Baby } from 'lucide-react';
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
  
  // --- ESTADOS DOS MODAIS E IA ---
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditYear, setAuditYear] = useState(new Date().getFullYear());

  // --- ESTADOS DE PAGINAÇÃO ---
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

  // =========================================================================
  // MOTOR DE CÁLCULO (IGNORA FINAIS DE SEMANA, EXCETO PARA LICENÇA LEGAL)
  // =========================================================================
  const calculateWorkingHours = (record: Partial<AbsenceRecord>, emp: Employee | undefined) => {
    const workload = emp?.dailyWorkload || 8.8;
    const workDays = (emp as any)?.workDays || [1, 2, 3, 4, 5]; 
    
    let amount = record.durationAmount || 0;
    let unit = record.durationUnit;
    
    if (!unit && record.documentDuration) {
      const match = record.documentDuration.match(/(\d+(?:\.\d+)?)\s*(dia|hora)/i);
      if (match) {
        amount = parseFloat(match[1]);
        unit = match[2].toLowerCase().startsWith('dia') ? 'Dias' : 'Horas';
      } else { unit = 'Dias'; amount = 1; }
    }

    if (unit === 'Horas') return amount; 

    // SE FOR LICENÇA (QUALQUER UMA), É DIA CORRIDO (NÃO DESCONTA FINAL DE SEMANA)
    if (record.documentType?.startsWith('Licença')) {
        return amount * workload;
    }

    // Se for outro documento (Atestado/Injustificada/Acompanhante), varre o calendário
    let workingDays = 0;
    const safeDateStr = formatToYMD(record.absenceDate);
    if (!safeDateStr) return amount * workload; 

    let currentDate = new Date(safeDateStr + 'T12:00:00Z');
    let daysLeft = amount;

    while(daysLeft > 0) {
        const currentDayOfWeek = currentDate.getDay();
        
        if (daysLeft < 1) {
            if (workDays.includes(currentDayOfWeek)) {
                workingDays += daysLeft;
            }
            daysLeft = 0;
        } else {
            if (workDays.includes(currentDayOfWeek)) {
                workingDays += 1;
            }
            daysLeft -= 1;
            currentDate.setDate(currentDate.getDate() + 1); 
        }
    }

    return workingDays * workload;
  };

  const filteredAbsences = useMemo(() => {
    return absences.filter((record: AbsenceRecord) => {
      const safeDate = formatToYMD(record.absenceDate);
      if (!safeDate) return false;
      return safeDate >= startDate && safeDate <= endDate;
    });
  }, [absences, startDate, endDate]);

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
    if (h === 0 && m === 0) return `0h`;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // --- LÓGICA DE AUDITORIA GERAL (ACOMPANHANTES) ---
  const companionAuditData = useMemo(() => {
    const auditMap: Record<string, { name: string, totalHours: number, records: AbsenceRecord[] }> = {};

    absences.forEach((a: AbsenceRecord) => {
      if (a.documentType !== 'Acompanhante de Dependente') return;
      const safeDate = formatToYMD(a.absenceDate);
      if (!safeDate) return;
      
      const recordYear = parseInt(safeDate.split('-')[0], 10);
      if (recordYear !== auditYear) return;

      const empName = a.employeeName || 'Sem Nome';
      const emp = employees.find((e: Employee) => e.name.toLowerCase() === empName.toLowerCase());
      
      const hours = calculateWorkingHours(a, emp);

      if (!auditMap[empName]) {
        auditMap[empName] = { name: empName, totalHours: 0, records: [] };
      }
      auditMap[empName].totalHours += hours;
      auditMap[empName].records.push(a);
    });

    return Object.values(auditMap).sort((a, b) => b.totalHours - a.totalHours);
  }, [absences, employees, auditYear]);

  // --- LÓGICA DE CONTROLE INDIVIDUAL NO FORMULÁRIO ---
  const currentEntryHours = useMemo(() => {
    const emp = employees.find((e: Employee) => e.name.toLowerCase() === formData.employeeName?.toLowerCase());
    return calculateWorkingHours(formData as AbsenceRecord, emp);
  }, [formData.employeeName, formData.durationAmount, formData.durationUnit, formData.absenceDate, formData.documentType, employees]);

  const usedCompanionHoursThisYear = useMemo(() => {
    if (!formData.employeeName || !formData.absenceDate) return 0;
    const safeFormDate = formatToYMD(formData.absenceDate);
    const targetYear = safeFormDate ? parseInt(safeFormDate.split('-')[0], 10) : new Date().getFullYear();
    
    const emp = employees.find((e: Employee) => e.name.toLowerCase() === formData.employeeName?.toLowerCase());

    return absences.filter((a: AbsenceRecord) => {
      if (isEditing && a.id === formData.id) return false; 
      if (a.employeeName?.toLowerCase() !== formData.employeeName?.toLowerCase()) return false;
      if (a.documentType !== 'Acompanhante de Dependente') return false;
      
      const safeRecordDate = formatToYMD(a.absenceDate);
      if (!safeRecordDate) return false;
      return parseInt(safeRecordDate.split('-')[0], 10) === targetYear;
    }).reduce((total: number, record: AbsenceRecord) => {
      return total + calculateWorkingHours(record, emp);
    }, 0);
  }, [formData.employeeName, formData.absenceDate, absences, employees, isEditing, formData.id]);

  const totalCompanionHours = usedCompanionHoursThisYear + currentEntryHours;

  const stats = useMemo(() => {
    let atestados = 0; let atestadosHours = 0;
    let declaracoes = 0; let declaracoesHours = 0;
    let injustificadas = 0; let injustificadasHours = 0;
    let acompanhamentos = 0; let acompanhamentosHours = 0;
    let licencas = 0; let licencasHours = 0;
    
    let totalLostHours = 0;

    const reasonCounts: Record<string, number> = {};
    const nameCounts: Record<string, number> = {};

    filteredAbsences.forEach((record: AbsenceRecord) => {
      const emp = employees.find((e: Employee) => e.name.toLowerCase() === record.employeeName?.toLowerCase());
      const hours = calculateWorkingHours(record, emp);

      if (record.documentType === 'Atestado') { atestados++; atestadosHours += hours; }
      else if (record.documentType === 'Declaração') { declaracoes++; declaracoesHours += hours; }
      else if (record.documentType === 'Falta Injustificada') { injustificadas++; injustificadasHours += hours; }
      else if (record.documentType === 'Acompanhante de Dependente') { acompanhamentos++; acompanhamentosHours += hours; }
      else if (record.documentType?.startsWith('Licença')) { licencas++; licencasHours += hours; }

      // Nenhuma licença (Seja maternidade, obito ou casamento) conta no absenteísmo
      if (!record.documentType?.startsWith('Licença')) {
        totalLostHours += hours;
        if (record.reason) reasonCounts[record.reason] = (reasonCounts[record.reason] || 0) + hours;
        if (record.employeeName) nameCounts[record.employeeName!] = (nameCounts[record.employeeName!] || 0) + hours;
      }
    });

    return {
      atestados, atestadosHours,
      declaracoes, declaracoesHours,
      injustificadas, injustificadasHours,
      acompanhamentos, acompanhamentosHours,
      licencas, licencasHours,
      totalLostHours,
      topReasons: Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topNames: Object.entries(nameCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    };
  }, [filteredAbsences, employees]);

  // --- IA DE AGRUPAMENTO ---
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
      { name: '🏢 Assuntos Pessoais (Admin)', regex: /(cnh|boletim|ocorrência|faculdade|matrícula|particular|casamento|obito|óbito)/i },
      { name: '⚠️ Dores Gerais e Mal Estar', regex: /(mal estar|r52|dor aguda|dor na)/i }
    ];

    const categories: Record<string, { hours: number, reasons: Set<string>, records: any[] }> = {};
    
    const pureKeys = ['Acompanhante', 'Maternidade', 'Ortopedia', 'Respiratorio', 'Gastrointestinal', 'Oftalmologia', 'Cirurgia', 'SaudeMental', 'Odontologia', 'Cardiovascular', 'Urologia', 'Endocrino', 'Exames', 'AssuntosPessoais', 'DoresGerais', 'Injustificada', 'Outros'];
    pureKeys.forEach(k => { categories[k] = { hours: 0, reasons: new Set(), records: [] }; });

    filteredAbsences.forEach((record: AbsenceRecord) => {
        if (record.documentType?.startsWith('Licença')) return;

        const reason = (record.reason || '').toLowerCase();
        const emp = employees.find((e: Employee) => e.name.toLowerCase() === record.employeeName?.toLowerCase());
        const hours = calculateWorkingHours(record, emp);

        let matchedCategory = 'Outros';
        
        if (record.documentType === 'Falta Injustificada') {
           matchedCategory = 'Injustificada';
        } else if (record.documentType === 'Acompanhante de Dependente') {
           matchedCategory = 'Acompanhante';
        } else {
           for (const rule of categoryRules) {
             if (rule.regex.test(reason)) {
               if (rule.name.includes('Acompanhamento')) matchedCategory = 'Acompanhante';
               else if (rule.name.includes('Maternidade')) matchedCategory = 'Maternidade';
               else if (rule.name.includes('Ortopedia')) matchedCategory = 'Ortopedia';
               else if (rule.name.includes('Respiratório')) matchedCategory = 'Respiratorio';
               else if (rule.name.includes('Gastrointestinal')) matchedCategory = 'Gastrointestinal';
               else if (rule.name.includes('Oftalmologia')) matchedCategory = 'Oftalmologia';
               else if (rule.name.includes('Cirurgias')) matchedCategory = 'Cirurgia';
               else if (rule.name.includes('Mental')) matchedCategory = 'SaudeMental';
               else if (rule.name.includes('Odontologia')) matchedCategory = 'Odontologia';
               else if (rule.name.includes('Cardiovascular')) matchedCategory = 'Cardiovascular';
               else if (rule.name.includes('Urologia')) matchedCategory = 'Urologia';
               else if (rule.name.includes('Endócrino')) matchedCategory = 'Endocrino';
               else if (rule.name.includes('Exames')) matchedCategory = 'Exames';
               else if (rule.name.includes('Assuntos')) matchedCategory = 'AssuntosPessoais';
               else if (rule.name.includes('Dores')) matchedCategory = 'DoresGerais';
               break;
             }
           }
        }

        if (!categories[matchedCategory]) {
           matchedCategory = 'Outros';
        }

        categories[matchedCategory].hours += hours;
        categories[matchedCategory].reasons.add(record.reason || 'Sem descrição');
        
        categories[matchedCategory].records.push({
           name: record.employeeName,
           reason: record.reason,
           duration: record.documentDuration,
           date: formatToYMD(record.absenceDate)
        });
    });

    const displayNames: Record<string, string> = {
      'Maternidade': '🤰 Gestação e Pré-Natal',
      'Ortopedia': '🦴 Ortopedia e Dores Musculares',
      'Respiratorio': '😷 Respiratório e Otorrino',
      'Gastrointestinal': '🤢 Gastrointestinal e Viroses',
      'Oftalmologia': '👁️ Oftalmologia',
      'Cirurgia': '🏥 Procedimentos e Cirurgias',
      'SaudeMental': '🧠 Saúde Mental e Emocional',
      'Odontologia': '🦷 Tratamento Odontológico',
      'Cardiovascular': '❤️ Cardiovascular',
      'Urologia': '💧 Urologia e Nefrologia',
      'Endocrino': '💊 Endócrino e Nutricional',
      'Exames': '🩸 Exames de Rotina / Sangue',
      'AssuntosPessoais': '🏢 Assuntos Pessoais (Admin)',
      'DoresGerais': '⚠️ Dores Gerais e Mal Estar',
      'Acompanhante': '👨‍👩‍👧 Acompanhamento Familiar',
      'Injustificada': '🚫 Falta Injustificada',
      'Outros': '❓ Outros Motivos / Diversos'
    };

    return Object.entries(categories)
      .filter(([_, data]) => data.hours > 0)
      .map(([key, data]) => ({
        category: displayNames[key],
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

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setShowAuditModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all bg-amber-100 hover:bg-amber-200 text-amber-800 shadow-sm"
          >
            <ShieldAlert size={18} />
            Auditoria de Acompanhantes
          </button>

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
                        <p className="text-sm text-indigo-700">Clique nas categorias abaixo para expandir e ver quem causou as ocorrências no período selecionado. (Licenças legais são omitidas aqui).</p>
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
                          
                          {/* CABEÇALHO DO CARD CLICÁVEL */}
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
                              <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2" title={result.reasons.join(', ')}>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Faltas Injustificadas</p>
                <div className="p-2 bg-red-50 text-red-600 rounded-xl"><AlertTriangle size={20} /></div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{formatHours(stats.injustificadasHours)}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">em {stats.injustificadas} registros</p>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Atestados (Médico)</p>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Activity size={20} /></div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{formatHours(stats.atestadosHours)}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">em {stats.atestados} registros</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Declarações (Horas)</p>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><FileText size={20} /></div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{formatHours(stats.declaracoesHours)}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">em {stats.declaracoes} registros</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Acompanhamentos</p>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={20} /></div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{formatHours(stats.acompanhamentosHours)}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">em {stats.acompanhamentos} registros</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-purple-100 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-purple-900 pointer-events-none"><Baby size={100}/></div>
              <div className="flex justify-between items-start mb-2 relative z-10">
                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest leading-tight">Licenças Legais<br/>(Isentas)</p>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl shrink-0"><Baby size={20} /></div>
              </div>
              <div className="relative z-10">
                <p className="text-2xl font-black text-slate-800">{formatHours(stats.licencasHours)}</p>
                <p className="text-[10px] font-bold text-purple-400 mt-1">Não debita no absenteísmo</p>
              </div>
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
                  <option value="Dias">Dias (Calcula úteis automaticamente)</option>
                  <option value="Horas">Horas Fixas</option>
                </select>
              </label>

              {formData.durationUnit === 'Dias' ? (
                <label className="flex flex-col text-sm font-medium text-slate-700">
                  Total de Dias (O sistema irá descontar os Finais de Semana)
                  <input type="number" step="0.5" min="0" name="durationAmount" value={formData.durationAmount || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: 5" />
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
                <select name="documentType" value={formData.documentType || 'Atestado'} onChange={handleInputChange} className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold">
                  <option value="Atestado">Atestado Médico</option>
                  <option value="Declaração">Declaração de Horas</option>
                  <option value="Acompanhante de Dependente">Acompanhante de Dependente</option>
                  <option value="Falta Injustificada">Falta Injustificada</option>
                  
                  <optgroup label="Licenças Legais (Não Desconta Horas)">
                    <option value="Licença Prevista em Lei" className="text-purple-600">Licença Maternidade / Paternidade</option>
                    <option value="Licença - Casamento" className="text-purple-600">Licença Casamento (Gala)</option>
                    <option value="Licença - Óbito" className="text-purple-600">Licença Óbito (Nojo)</option>
                  </optgroup>
                </select>
              </label>
              
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Motivo da Ausência / CID
                <input type="text" name="reason" list="absence-reasons" value={formData.reason || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Dor de cabeça, Casamento, Óbito do pai..." />
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
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 bg-white">
                      <th className="py-3 px-4">Colaborador / Motivo</th>
                      <th className="py-3 px-4 text-center">Data e Duração</th>
                      <th className="py-3 px-4 text-center">Tipo</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedAbsences.map((record: AbsenceRecord) => (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors text-sm text-slate-700">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800">{record.employeeName}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[200px]" title={record.reason}>{record.reason}</p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <p className="font-medium text-slate-700">{formatDateToBR(record.absenceDate)}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {record.documentDuration}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider inline-block ${
                            record.documentType === 'Atestado' ? 'bg-blue-100 text-blue-700' : 
                            record.documentType === 'Declaração' ? 'bg-amber-100 text-amber-700' : 
                            record.documentType === 'Falta Injustificada' ? 'bg-red-100 text-red-700' :
                            record.documentType?.startsWith('Licença') ? 'bg-purple-100 text-purple-700' :
                            'bg-indigo-100 text-indigo-700'
                          }`}>
                            {record.documentType?.startsWith('Licença') ? 'Licença Legal' : record.documentType}
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

      {/* MODAL DE AUDITORIA DE ACOMPANHANTES */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-6 bg-gradient-to-r from-amber-500 to-orange-600 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <ShieldAlert size={28} className="text-amber-200" />
                <div>
                  <h2 className="text-xl font-bold">Auditoria de Acompanhantes</h2>
                  <p className="text-amber-100 text-sm">Verificação do limite legal de 16h/Ano por colaborador.</p>
                </div>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="text-amber-100 hover:text-white transition-colors bg-white/10 p-2 rounded-full">
                <X size={24} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
              <span className="font-bold text-slate-700 text-sm uppercase tracking-wider">Ano Base:</span>
              <select 
                className="bg-white border border-slate-300 py-1.5 px-3 rounded-lg font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                value={auditYear}
                onChange={e => setAuditYear(Number(e.target.value))}
              >
                {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="p-0 overflow-y-auto flex-1 bg-slate-50">
              {companionAuditData.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <ShieldAlert size={48} className="mx-auto mb-3 opacity-20" />
                  <p>Nenhum registo de acompanhante encontrado para o ano de {auditYear}.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 sticky top-0 shadow-sm">
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="p-4 font-bold">Colaborador</th>
                      <th className="p-4 font-bold text-center">Registos no Ano</th>
                      <th className="p-4 font-bold text-center">Total Utilizado</th>
                      <th className="p-4 font-bold text-right pr-6">Status (Limite 16h)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {companionAuditData.map((data, idx) => {
                      const isExceeded = data.totalHours > 16;
                      const exceededAmount = data.totalHours - 16;

                      return (
                        <tr key={idx} className={`transition-colors ${isExceeded ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50'}`}>
                          <td className="p-4 font-bold text-slate-800">{data.name}</td>
                          <td className="p-4 text-center text-slate-500 font-medium">{data.records.length}</td>
                          <td className="p-4 text-center">
                            <span className="font-black text-slate-700">{formatHours(data.totalHours)}</span>
                          </td>
                          <td className="p-4 text-right pr-6">
                            {isExceeded ? (
                              <div className="flex flex-col items-end">
                                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider">
                                  Estourou Limite
                                </span>
                                <span className="text-[10px] font-bold text-red-500 mt-1">
                                  Descontar {formatHours(exceededAmount)} do B.H.
                                </span>
                              </div>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                                Ok (Restam {formatHours(16 - data.totalHours)})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowAuditModal(false)} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Absenteismo;