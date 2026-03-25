import React, { useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Employee, SettingItem } from '../types';
import { 
  Users, Save, Edit3, Building2, TrendingDown, TrendingUp, AlertCircle, FileSpreadsheet, Download, UploadCloud, Copy, Info, X, Search, CalendarDays
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const QuadroPessoal: React.FC = () => {
  const { user, employees = [], updateEmployee, settings = [], addSetting, updateSetting } = useData() as any;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Permite que MASTER e GESTOR acessem a tela
  if (user?.role !== 'MASTER' && user?.role !== 'GESTOR') {
    return <Navigate to="/" replace />;
  }

  // Cria uma variável para bloquear os botões de edição do Gestor
  const canEdit = user?.role === 'MASTER';

  // --- ESTADOS DE PERÍODO CUSTOMIZÁVEL ---
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  const [isEditing, setIsEditing] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<Record<string, number>>({});
  const [modalData, setModalData] = useState<{ sector: string, type: 'ativos' | 'afastados', list: any[] } | null>(null);

  const officialSectors = useMemo(() => {
    return settings.filter((s: SettingItem) => s.type === 'SECTOR').map((s: SettingItem) => s.name).sort();
  }, [settings]);

  // A chave de salvamento do orçamento baseada no mês/ano da Data Final
  const budgetKey = useMemo(() => endDate.substring(0, 7), [endDate]); 

  const currentBudgetSetting = useMemo(() => {
    return settings.find((s: SettingItem) => s.type === 'HEADCOUNT_BUDGET' && s.name === budgetKey);
  }, [settings, budgetKey]);

  const savedBudget: Record<string, number> = useMemo(() => {
    if (currentBudgetSetting?.value) {
      try { return JSON.parse(currentBudgetSetting.value); } catch (e) { return {}; }
    }
    return {};
  }, [currentBudgetSetting]);

  // --- MÁQUINA DO TEMPO: FOTOGRAFIA NA DATA FINAL ---
  const headcountData = useMemo(() => {
    const data: Record<string, { ativos: number, afastados: number, list: any[] }> = {};
    
    officialSectors.forEach((s: string) => data[s] = { ativos: 0, afastados: 0, list: [] });
    
    const invalidKey = '⚠️ Setor Inválido ou Antigo';
    data[invalidKey] = { ativos: 0, afastados: 0, list: [] };

    employees.forEach((emp: Employee) => {
      const formatToYMD = (dateVal: any) => {
        if (!dateVal) return '';
        let str = String(dateVal).trim().split('T')[0].split(' ')[0];
        const parts = str.split(/[\/\-]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return str; 
      };

      const adDate = formatToYMD(emp.admissionDate);
      const termDate = formatToYMD(emp.terminationDate);

      // REGRA 1 (ADMISSÃO): Foi admitido DEPOIS da Data Final selecionada? 
      if (adDate && adDate > endDate) return; 

      // REGRA 2 (DEMISSÃO): Foi demitido ANTES da Data Final?
      // O quadro FTE tira a fotografia do último dia do período. Se a pessoa saiu antes, a cadeira abriu!
      if (termDate && termDate < endDate) return; 

      let snapshotSector = emp.sector || 'Sem Setor';
      let snapshotStatus = 'Ativo'; 
      
      if (emp.status === 'Afastado' && (emp as any).leaveStartDate && formatToYMD((emp as any).leaveStartDate) <= endDate) {
          snapshotStatus = 'Afastado';
      }

      if (emp.history && emp.history.length > 0) {
          // Filtra o histórico ATÉ a Data Final do período
          const pastEvents = emp.history
              .filter((h: any) => h.date <= endDate)
              .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          pastEvents.forEach((h: any) => {
              const sectorMatch = h.description.match(/Setor:\s*([^|]+)/i);
              if (sectorMatch) {
                  snapshotSector = sectorMatch[1].trim();
              }
              if (h.description.includes('[INÍCIO DE AFASTAMENTO]')) {
                  snapshotStatus = 'Afastado';
              } else if (h.description.includes('[FIM DE AFASTAMENTO]')) {
                  snapshotStatus = 'Ativo';
              }
          });
      }

      if (!officialSectors.includes(snapshotSector)) {
          snapshotSector = invalidKey;
      }

      const empSnapshot = { ...emp, snapshotStatus };

      if (snapshotStatus === 'Afastado') {
        data[snapshotSector].afastados += 1;
      } else {
        data[snapshotSector].ativos += 1;
      }
      data[snapshotSector].list.push(empSnapshot);
    });

    return data;
  }, [employees, endDate, officialSectors]);

  const handleEditClick = () => {
    setBudgetDraft({ ...savedBudget });
    setIsEditing(true);
  };

  const handleSaveBudget = async () => {
    const jsonValue = JSON.stringify(budgetDraft);
    if (currentBudgetSetting) {
      await updateSetting({ ...currentBudgetSetting, value: jsonValue });
    } else {
      await addSetting({ id: crypto.randomUUID(), type: 'HEADCOUNT_BUDGET', name: budgetKey, value: jsonValue });
    }
    setIsEditing(false);
  };

  const handleCopyPreviousMonth = () => {
    const [yearStr, monthStr] = budgetKey.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);

    if (month === 1) {
      month = 12;
      year -= 1;
    } else {
      month -= 1;
    }

    const prevPeriod = `${year}-${String(month).padStart(2, '0')}`;
    const prevSetting = settings.find((s: SettingItem) => s.type === 'HEADCOUNT_BUDGET' && s.name === prevPeriod);
    
    if (prevSetting && prevSetting.value) {
      try {
        const prevBudget = JSON.parse(prevSetting.value);
        setBudgetDraft(prevBudget);
        alert(`Orçamento de ${prevPeriod} copiado com sucesso! Verifique os números e clique em "Salvar Orçamento".`);
      } catch (e) {
        alert("Erro ao ler o orçamento do mês anterior.");
      }
    } else {
      alert(`Ainda não existe um orçamento salvo para o mês de ${prevPeriod}.`);
    }
  };

  // --- NOVA LÓGICA DE EXPORTAÇÃO "ESTILO POWER BI" ---
  const handleExportList = () => {
    const workbook = XLSX.utils.book_new();
    let hasData = false;

    // 1. ABA RESUMO (Visão Macro)
    const resumoData = Object.keys(headcountData).map(sector => {
        const orcado = isEditing && sector !== '⚠️ Setor Inválido ou Antigo' ? (budgetDraft[sector] || 0) : (savedBudget[sector] || 0);
        const ativos = headcountData[sector].ativos;
        const afastados = headcountData[sector].afastados;
        const saldo = orcado - ativos;
        
        if (ativos > 0 || afastados > 0 || orcado > 0) hasData = true;

        return {
            'Setor': sector,
            'Vagas Orçadas': orcado,
            'Total Ativos': ativos,
            'Total Afastados': afastados,
            'Saldo de Vagas': saldo
        };
    });

    if (!hasData) {
        alert('Nenhum colaborador computado neste período com os filtros atuais.');
        return;
    }

    const wsResumo = XLSX.utils.json_to_sheet(resumoData);
    // Ajusta o tamanho das colunas do resumo
    wsResumo['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, wsResumo, "1. Resumo Macro");

    // 2. ABAS INDIVIDUAIS POR SETOR
    Object.keys(headcountData).forEach(sector => {
        const empList = headcountData[sector].list;
        
        if (empList.length > 0) {
            // Ordena alfabeticamente
            const sortedList = [...empList].sort((a, b) => a.name.localeCompare(b.name));

            const sectorData = sortedList.map(emp => ({
                'Nome do Colaborador': emp.name,
                'Cargo Atual': emp.role,
                'Status no Período': emp.snapshotStatus === 'Afastado' ? 'Afastado' : 'Ativo',
                'Data de Admissão': formatDateToBR(emp.admissionDate),
                'Desligamento (se houver)': emp.terminationDate ? formatDateToBR(emp.terminationDate) : '-'
            }));

            const wsSector = XLSX.utils.json_to_sheet(sectorData);
            
            // Estética: Ajusta a largura das colunas da aba do setor
            wsSector['!cols'] = [
                { wch: 40 }, // Nome
                { wch: 35 }, // Cargo
                { wch: 20 }, // Status
                { wch: 20 }, // Admissao
                { wch: 25 }, // Desligamento
            ];

            // Limpa o nome da aba para não dar erro no Excel (max 31 caracteres e sem símbolos inválidos)
            const safeSheetName = sector.replace(/[\\/?*[\]:]/g, '').substring(0, 31);
            XLSX.utils.book_append_sheet(workbook, wsSector, safeSheetName);
        }
    });

    XLSX.writeFile(workbook, `Quadro_FTE_${startDate}_ate_${endDate}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
        { 'Nome': 'João da Silva', 'Data': '01/01/2026', 'Setor': 'RH', 'Cargo': 'Analista de RH' },
        { 'Nome': 'Maria Souza', 'Data': '15/02/2026', 'Setor': 'Tecnologia', 'Cargo': 'Desenvolvedor' }
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "CargaHistorica");
    XLSX.writeFile(workbook, "Modelo_Carga_Historica_Setores.xlsx");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            let updatedCount = 0;
            let notFound: string[] = [];
            const empUpdates = new Map<string, Employee>();

            for (const row of jsonData as any[]) {
                const nome = row['Nome']?.toString().trim();
                let dataStr = row['Data'];
                const setor = row['Setor']?.toString().trim();
                const cargo = row['Cargo']?.toString().trim();

                if (!nome || !dataStr || !setor) continue;

                if (typeof dataStr === 'number') {
                    const jsDate = new Date(Math.round((dataStr - 25569) * 86400 * 1000));
                    dataStr = jsDate.toISOString().split('T')[0];
                } else if (dataStr.includes('/')) {
                    const parts = dataStr.split('/');
                    dataStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }

                let emp = empUpdates.get(nome.toLowerCase()) || employees.find((e: Employee) => e.name.toLowerCase() === nome.toLowerCase());
                if (!emp) {
                    if (!notFound.includes(nome)) notFound.push(nome);
                    continue;
                }

                const historyRecord = {
                    id: crypto.randomUUID(),
                    date: dataStr,
                    type: 'Mudança de Setor' as any,
                    description: `[CARGA HISTÓRICA] Setor: ${setor} | Cargo: ${cargo || emp.role}`,
                    createdBy: user?.name || 'Sistema'
                };

                const updatedHistory = [...(emp.history || []), historyRecord];

                empUpdates.set(nome.toLowerCase(), {
                    ...emp,
                    history: updatedHistory
                });
            }

            for (const [_, empToSave] of empUpdates) {
                await updateEmployee(empToSave);
                updatedCount++;
            }

            alert(`Importação concluída com sucesso!\n\n✔️ ${updatedCount} históricos atualizados.\n${notFound.length > 0 ? `❌ Não encontrados na base: ${notFound.join(', ')}` : ''}`);

        } catch (err) {
            console.error(err);
            alert("Erro ao processar o arquivo. Verifique se as colunas estão exatas: Nome, Data, Setor, Cargo.");
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const formatDateToBR = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const totals = Object.keys(headcountData).reduce((acc: any, sector: string) => {
    if (sector !== '⚠️ Setor Inválido ou Antigo') {
       acc.orcado += (savedBudget[sector] || 0);
    }
    acc.ativos += (headcountData[sector]?.ativos || 0);
    acc.afastados += (headcountData[sector]?.afastados || 0);
    return acc;
  }, { orcado: 0, ativos: 0, afastados: 0 });

  const sectorsToRender = [...officialSectors];
  if (headcountData['⚠️ Setor Inválido ou Antigo'].ativos > 0 || headcountData['⚠️ Setor Inválido ou Antigo'].afastados > 0) {
      sectorsToRender.push('⚠️ Setor Inválido ou Antigo');
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in relative">
      <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleImportExcel} className="hidden" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-900 text-white rounded-xl shadow-lg shadow-indigo-200">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tighter">Quadro de Pessoal Flexível (FTE)</h1>
            <p className="text-slate-500 text-sm font-medium">Análise de vagas e ocupação por período</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleExportList}
            className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm text-sm"
          >
            <FileSpreadsheet size={18} />
            Exportar Nominal
          </button>
          {canEdit && (
            <>
              <button 
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm text-sm"
              >
                <Download size={18} />
                Baixar Modelo
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm text-sm"
              >
                <UploadCloud size={18} />
                Subir Histórico
              </button>
            </>
          )}
        </div>
      </div>

      {/* AVISO DE REGRA DE NEGÓCIO */}
      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3 shadow-sm text-blue-800 mb-2">
        <Info className="mt-0.5 shrink-0" size={20} />
        <div className="text-sm leading-relaxed">
          <span className="font-bold uppercase tracking-wider text-[11px] block mb-1">Regras de Exibição (Fotografia da Data Final)</span>
          Os números abaixo refletem quem estava ocupando a vaga no último dia do período selecionado.<br/>
          <b>1. Admissão:</b> Contabiliza quem foi admitido ATÉ a <i>Data Final</i>.<br/>
          <b>2. Demissão:</b> A pessoa não entra na conta se foi desligada ANTES da <i>Data Final</i> (pois a cadeira dela já está vazia).
        </div>
      </div>

      {/* CONTROLE DE PERÍODO CUSTOMIZADO E AÇÕES */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* SELETOR DE DATAS */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <CalendarDays size={18} className="text-indigo-600" />
            <span className="text-sm font-bold text-slate-600">De:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent font-bold text-indigo-900 outline-none cursor-pointer text-sm"
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <span className="text-sm font-bold text-slate-600">Até:</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent font-bold text-indigo-900 outline-none cursor-pointer text-sm"
            />
          </div>
        </div>

        <div>
          {canEdit && (
            isEditing ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={handleCopyPreviousMonth} className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-colors flex items-center gap-2 border border-indigo-200" title="Puxar as vagas orçadas do mês anterior">
                  <Copy size={18}/> <span className="hidden sm:inline">Copiar Mês Anterior</span>
                </button>
                <button onClick={() => setIsEditing(false)} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors">Cancelar</button>
                <button onClick={handleSaveBudget} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95"><Save size={18}/> Salvar Orçamento</button>
              </div>
            ) : (
              <button onClick={handleEditClick} className="px-6 py-2 bg-white border border-slate-200 hover:border-indigo-300 text-indigo-600 font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all">
                <Edit3 size={18}/> Editar Orçamento (FTE)
              </button>
            )
          )}
        </div>
      </div>

      {/* TOTAIS GLOBAIS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-indigo-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-center">
            <Users className="absolute -right-4 -bottom-4 opacity-10 size-32"/>
            <h3 className="font-bold text-indigo-200 uppercase tracking-widest text-[10px] mb-2">Total Orçado</h3>
            <p className="text-5xl font-black relative z-10">{totals.orcado}</p>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
            <h3 className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-2">Total Ativos no Período</h3>
            <p className="text-4xl font-black text-slate-800">{totals.ativos}</p>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
            <h3 className="font-bold text-amber-500 uppercase tracking-widest text-[10px] mb-2">Total Afastados</h3>
            <p className="text-4xl font-black text-amber-600">{totals.afastados}</p>
        </div>
        <div className={`rounded-3xl p-6 border shadow-sm flex flex-col justify-center ${totals.ativos > totals.orcado ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <h3 className={`font-bold uppercase tracking-widest text-[10px] mb-2 ${totals.ativos > totals.orcado ? 'text-red-600' : 'text-emerald-600'}`}>Saldo (Orçado - Ativos)</h3>
            <div className="flex items-center gap-2">
              <p className={`text-4xl font-black ${totals.ativos > totals.orcado ? 'text-red-700' : 'text-emerald-700'}`}>
                {totals.orcado - totals.ativos}
              </p>
              {totals.ativos > totals.orcado && <AlertCircle className="text-red-500" size={24} />}
            </div>
            <p className={`text-[10px] font-bold mt-1 ${totals.ativos > totals.orcado ? 'text-red-500' : 'text-emerald-600'}`}>
              {totals.ativos > totals.orcado ? 'Quadro Excedente!' : 'Vagas Disponíveis'}
            </p>
        </div>
      </div>

      {/* GRID DE SETORES */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sectorsToRender.map((sector: string) => {
          const isInvalid = sector === '⚠️ Setor Inválido ou Antigo';
          const orcado = isEditing && !isInvalid ? (budgetDraft[sector] || 0) : (savedBudget[sector] || 0);
          const ativos = headcountData[sector]?.ativos || 0;
          const afastados = headcountData[sector]?.afastados || 0;
          const saldo = orcado - ativos;

          return (
            <div key={sector} className={`bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md ${isInvalid ? 'border-red-300' : 'border-slate-200'}`}>
              
              <div className={`p-5 border-b flex items-center gap-3 ${isInvalid ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`p-2 rounded-lg shrink-0 ${isInvalid ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}><Building2 size={18}/></div>
                <h3 className={`font-black uppercase tracking-tighter leading-tight ${isInvalid ? 'text-red-700' : 'text-slate-700'}`}>{sector}</h3>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <div className="grid grid-cols-3 gap-2 mb-6">
                  
                  {/* INPUT DE ORÇAMENTO */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center flex flex-col justify-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Orçadas</span>
                    {isEditing && !isInvalid ? (
                      <input 
                        type="number" min="0" 
                        className="w-full bg-white border border-indigo-300 text-indigo-700 font-black text-xl text-center rounded-lg py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={budgetDraft[sector] || ''}
                        onChange={e => setBudgetDraft({...budgetDraft, [sector]: Number(e.target.value)})}
                      />
                    ) : (
                      <span className={`text-2xl font-black ${isInvalid ? 'text-slate-300' : 'text-indigo-900'}`}>{isInvalid ? '-' : orcado}</span>
                    )}
                  </div>

                  {/* ATIVOS (CLICÁVEL) */}
                  <div 
                    onClick={() => {
                        if (ativos > 0) {
                            setModalData({ 
                                sector, 
                                type: 'ativos', 
                                list: headcountData[sector].list.filter(e => e.snapshotStatus !== 'Afastado') 
                            });
                        }
                    }}
                    className={`p-3 rounded-xl border text-center flex flex-col justify-center transition-colors ${ativos > 0 ? 'cursor-pointer hover:bg-indigo-50 hover:border-indigo-200' : 'opacity-50'} ${isInvalid ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}
                  >
                    <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isInvalid ? 'text-red-400' : 'text-slate-400'}`}>Ativos <Search size={10} className="inline ml-0.5 opacity-50"/></span>
                    <span className={`text-2xl font-black ${isInvalid ? 'text-red-600' : 'text-slate-700'}`}>{ativos}</span>
                  </div>

                  {/* AFASTADOS (CLICÁVEL) */}
                  <div 
                    onClick={() => {
                        if (afastados > 0) {
                            setModalData({ 
                                sector, 
                                type: 'afastados', 
                                list: headcountData[sector].list.filter(e => e.snapshotStatus === 'Afastado') 
                            });
                        }
                    }}
                    className={`p-3 rounded-xl border text-center flex flex-col justify-center transition-colors ${afastados > 0 ? 'bg-amber-50 border-amber-200 cursor-pointer hover:bg-amber-100' : 'bg-slate-50 border-slate-100 opacity-50'}`}
                  >
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">Afast. <Search size={10} className="inline ml-0.5 opacity-50"/></span>
                    <span className="text-2xl font-black text-amber-600">{afastados}</span>
                  </div>
                </div>

                {/* BARRA DE SALDO */}
                {!isInvalid && (
                  <div className="mt-auto">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo do Setor</span>
                      <div className="flex items-center gap-1">
                        {saldo < 0 ? (
                          <span className="text-red-600 font-black flex items-center gap-1"><TrendingUp size={14}/> Excedente: {Math.abs(saldo)}</span>
                        ) : saldo > 0 ? (
                          <span className="text-emerald-600 font-black flex items-center gap-1"><TrendingDown size={14}/> Abertas: {saldo}</span>
                        ) : (
                          <span className="text-slate-400 font-black">No Limite (0)</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      {orcado > 0 ? (
                        <div 
                          className={`h-full transition-all ${saldo < 0 ? 'bg-red-500' : saldo === 0 ? 'bg-blue-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min((ativos / orcado) * 100, 100)}%` }}
                        ></div>
                      ) : (
                        <div className={`h-full w-full ${ativos > 0 ? 'bg-red-500' : 'bg-slate-200'}`}></div>
                      )}
                    </div>
                  </div>
                )}

                {isInvalid && (
                  <div className="mt-auto bg-red-100 p-2 rounded-lg text-[10px] text-red-800 font-medium">
                    ⚠️ Acesse a ficha destes colaboradores em "Colaboradores" e atualize o nome do setor no Histórico deles para corrigir este alerta.
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE LISTAGEM NOMINAL */}
      {modalData && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
               <div className="p-6 border-b border-slate-100 bg-slate-50 rounded-t-3xl flex justify-between items-center shrink-0">
                  <div>
                     <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg flex items-center gap-2">
                        <Users className="text-indigo-600"/> 
                        {modalData.type === 'ativos' ? 'Colaboradores Ativos' : 'Colaboradores Afastados'}
                     </h3>
                     <p className="text-xs text-slate-500 font-bold mt-1">
                        Setor Computado: <span className="text-indigo-600">{modalData.sector}</span>
                     </p>
                  </div>
                  <button onClick={() => setModalData(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-indigo-600 transition-colors"><X size={24} /></button>
               </div>
               
               <div className="p-0 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-white border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] sticky top-0">
                        <tr>
                           <th className="p-4 pl-6">Nome</th>
                           <th className="p-4">Cargo no Período</th>
                           <th className="p-4 text-center">Admissão</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {modalData.list.sort((a,b) => a.name.localeCompare(b.name)).map(emp => (
                           <tr key={emp.id} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="p-4 pl-6 font-bold text-slate-800">{emp.name}</td>
                              <td className="p-4 text-xs text-slate-600">{emp.role}</td>
                              <td className="p-4 text-center font-bold text-slate-500 text-xs">{formatDateToBR(emp.admissionDate)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
               <div className="p-4 bg-slate-50 rounded-b-3xl border-t border-slate-100 text-center text-xs text-slate-400 font-medium">
                   Mostrando {modalData.list.length} registros computados até a Data Final selecionada.
               </div>
            </div>
         </div>
      )}

    </div>
  );
};