import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { 
  Trash2, Plus, Download, Upload, Edit2, Check, X, Key, ShieldCheck, 
  UserPlus, Users, Save, RotateCcw, FileQuestion, XCircle, 
  FileSpreadsheet, DownloadCloud, UploadCloud, Settings, Lock
} from 'lucide-react';
import { SettingItem, User, UserRole, Employee, ContractType, EmployeeStatus, AppModule, PermissionLevel, RoleConfig } from '../types';
import * as XLSX from 'xlsx';

// Lista de Módulos (Páginas) que podem ser bloqueadas/liberadas
const APP_MODULES: { id: AppModule, label: string }[] = [
  { id: 'COLABORADORES', label: 'Lista de Colaboradores' },
  { id: 'VAGAS', label: 'Gestão de Vagas' },
  { id: 'QUADRO_PESSOAL', label: 'Quadro FTE / Orçamento' },
  { id: 'ENTREVISTAS_GERAIS', label: 'Entrevistas Gerais' },
  { id: 'EXPERIENCIA_DESLIGAMENTO', label: 'Avaliações (Exp. e Desligamento)' },
  { id: 'DASHBOARD', label: 'Dashboard Geral' },
];

export const SettingsPage: React.FC = () => {
  const { 
    settings, addSetting, removeSetting, updateSetting, 
    users, addUser, user: currentUser, changePassword, adminResetPassword,
    jobs, talents, candidates, employees, addEmployee, updateEmployee, 
    trash, restoreItem, permanentlyDeleteItem 
  } = useData() as any; // Usando any para facilitar o bypass de tipagens temporárias durante o refatoramento
  
  // Adicionado CUSTOM_ROLE nas abas
  const [activeTab, setActiveTab] = useState<'SECTOR' | 'UNIT' | 'RESOURCE' | 'CUSTOM_ROLE'>('SECTOR');
  const [newSettingName, setNewSettingName] = useState('');
  
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'RECRUITER' });
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [resetData, setResetData] = useState({ new: '', confirm: '' });
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // --- ESTADOS DO MODAL DE CARGOS DINÂMICOS ---
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleConfig | null>(null);

  const isMaster = currentUser?.role?.toUpperCase() === 'MASTER';
  const isAuxiliar = currentUser?.role === 'AUXILIAR_RH';

  const customRoles = settings
    .filter((s: SettingItem) => s.type === 'CUSTOM_ROLE')
    .map((s: SettingItem) => ({ ...JSON.parse(s.value || '{}'), dbId: s.id }));

  const formatToYMD = (dateVal: any) => {
    if (!dateVal) return '';
    let str = String(dateVal).trim();

    if (/^\d{4,5}$/.test(str)) {
      const jsDate = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
      return jsDate.toISOString().split('T')[0];
    }

    str = str.split('T')[0].split(' ')[0];

    const corruptMatch = str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (corruptMatch) {
        const wrongYear = corruptMatch[1]; 
        const month = corruptMatch[2]; 
        const actualYear = corruptMatch[3]; 
        const actualDay = wrongYear.substring(2); 
        return `${actualYear}-${month}-${actualDay}`;
    }

    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
        let p0 = parts[0], p1 = parts[1], p2 = parts[2];
        if (p0.length === 4) return `${p0}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
        else if (p2.length === 4) { 
            let m = Number(p1);
            if (m > 12) return `${p2}-${p0.padStart(2, '0')}-${p1.padStart(2, '0')}`;
            else return `${p2}-${p1.padStart(2, '0')}-${p0.padStart(2, '0')}`;
        } else if (p2.length === 2) { 
            let y = Number(p2) > 50 ? 1900 + Number(p2) : 2000 + Number(p2);
            return `${y}-${p1.padStart(2, '0')}-${p0.padStart(2, '0')}`;
        }
    }
    try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch(e) {}
    return '';
  };

  const formatToBR = (dateVal: any) => {
    const ymd = formatToYMD(dateVal); 
    if (!ymd) return '';
    const parts = ymd.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`; 
    return String(dateVal);
  };

  // --- LÓGICA DE EXCEL: EXPORTAR (COM JORNADA E HORÁRIO) ---
  const handleExportEmployeesExcel = () => {
    const activeEmployees = employees.filter((emp: Employee) => emp.status !== 'Inativo');

    const dataToExport = activeEmployees.length > 0 ? activeEmployees.map((emp: Employee) => ({
      Nome: emp.name,
      Cargo: emp.role,
      Setor: emp.sector,
      Unidade: emp.unit || '', 
      Telefone: emp.phone,
      Contrato: emp.contractType,
      Status: emp.status,
      Horário: (emp as any).workSchedule || '', 
      Jornada: emp.dailyWorkload || 8.8, 
      Nascimento: formatToBR(emp.birthDate),
      Admissao: formatToBR(emp.admissionDate)
    })) : [{
      Nome: '', Cargo: '', Setor: '', Unidade: '',
      Contrato: 'CLT', Status: 'Ativo', Horário: 'Comercial Adm (08h às 18h)', Jornada: 8.8, Nascimento: '01/01/1990', Admissao: '01/01/2024'
    }];

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Colaboradores");
    XLSX.writeFile(workbook, `MODELO_IMPORT_COLABORADORES.xlsx`);
  };

  // --- LÓGICA DE EXCEL: IMPORTAR ---
  const handleImportEmployeesExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '' });

        const activeSectors = settings.filter((s:any) => s.type === 'SECTOR').map((s:any) => s.name.trim().toLowerCase());
        const activeUnits = settings.filter((s:any) => s.type === 'UNIT').map((s:any) => s.name.trim().toLowerCase());

        if (confirm(`Deseja processar ${json.length} colaboradores? O sistema irá atualizar os nomes que já existem e criar os novos.`)) {
          let pendingCount = 0;
          let updatedCount = 0;
          let insertedCount = 0;

          for (const row of json) {
            const normalizedRow: any = {};
            for (const key in row) {
              const cleanKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
              normalizedRow[cleanKey] = row[key];
            }

            const rawName = normalizedRow['nome'];
            if (!rawName) continue;

            const sectorFromExcel = (normalizedRow['setor'] || 'Geral').trim();
            const unitFromExcel = (normalizedRow['unidade'] || '').trim();

            const isSectorPending = !activeSectors.includes(sectorFromExcel.toLowerCase());
            const isUnitPending = unitFromExcel !== '' && !activeUnits.includes(unitFromExcel.toLowerCase());
            const isPending = isSectorPending || isUnitPending;
            
            if (isPending) pendingCount++;

            let pendingMsg = '⚠️ Atualização via Excel: ';
            if (isSectorPending && isUnitPending) pendingMsg += `O setor "${sectorFromExcel}" e a unidade "${unitFromExcel}" não existem no sistema.`;
            else if (isSectorPending) pendingMsg += `O setor "${sectorFromExcel}" não existe no sistema.`;
            else if (isUnitPending) pendingMsg += `A unidade "${unitFromExcel}" não existe no sistema.`;

            const rawAdmission = normalizedRow['admissao'] || normalizedRow['data de admissao'];
            const rawBirth = normalizedRow['nascimento'] || normalizedRow['data de nascimento'];
            
            const rawHorario = normalizedRow['horario'] || normalizedRow['turno'] || '';
            const rawJornada = normalizedRow['jornada'] || normalizedRow['jornada (h)'] || normalizedRow['horas'];
            let parsedJornada: number | undefined = undefined;
            if (rawJornada !== undefined && rawJornada !== '') {
               const num = Number(String(rawJornada).replace(',', '.'));
               if (!isNaN(num)) parsedJornada = num;
            }

            const existingEmp = employees.find((emp: Employee) => emp.name.trim().toLowerCase() === String(rawName).trim().toLowerCase());

            if (existingEmp) {
              const updatedEmp: Employee = {
                ...existingEmp,
                role: normalizedRow['cargo'] || existingEmp.role,
                sector: sectorFromExcel,
                unit: unitFromExcel,
                phone: String(normalizedRow['telefone'] || existingEmp.phone),
                contractType: (normalizedRow['contrato'] as ContractType) || existingEmp.contractType,
                status: (normalizedRow['status'] as EmployeeStatus) || existingEmp.status,
                dailyWorkload: parsedJornada !== undefined ? parsedJornada : (existingEmp.dailyWorkload || 8.8), 
                workSchedule: String(rawHorario) || (existingEmp as any).workSchedule || '', 
                birthDate: formatToYMD(rawBirth) || existingEmp.birthDate,
                admissionDate: formatToYMD(rawAdmission) || existingEmp.admissionDate,
                hasPendingInfo: isPending,
              };

              if (isPending && !existingEmp.hasPendingInfo) {
                updatedEmp.history = [...(existingEmp.history || []), {
                  id: crypto.randomUUID(),
                  date: new Date().toISOString().split('T')[0],
                  type: 'Outros',
                  description: pendingMsg
                }];
              }

              await updateEmployee(updatedEmp);
              updatedCount++;
            } else {
              const newEmp: Employee = {
                id: crypto.randomUUID(),
                name: rawName,
                role: normalizedRow['cargo'] || 'Não Definido',
                sector: sectorFromExcel,
                unit: unitFromExcel,
                phone: String(normalizedRow['telefone'] || ''),
                contractType: (normalizedRow['contrato'] as ContractType) || 'CLT',
                status: (normalizedRow['status'] as EmployeeStatus) || 'Ativo',
                dailyWorkload: parsedJornada !== undefined ? parsedJornada : 8.8, 
                workSchedule: String(rawHorario) || '', 
                birthDate: formatToYMD(rawBirth),
                admissionDate: formatToYMD(rawAdmission) || new Date().toISOString().split('T')[0],
                hasPendingInfo: isPending, 
                history: isPending ? [{
                  id: crypto.randomUUID(),
                  date: new Date().toISOString().split('T')[0],
                  type: 'Outros',
                  description: pendingMsg.replace('Atualização', 'Importação')
                }] : [],
                createdAt: new Date().toISOString()
              };
              await addEmployee(newEmp);
              insertedCount++;
            }
          }

          let msg = `Processamento concluído!\n\n🔹 Novos criados: ${insertedCount}\n🔸 Atualizados: ${updatedCount}`;
          if (pendingCount > 0) {
            msg += `\n\n⚠️ Atenção: ${pendingCount} colaboradores estão com setor ou unidade pendente (card laranja).`;
          }
          alert(msg);
          window.location.reload();
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao processar o arquivo Excel. Verifique o formato.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const getTrashLabel = (item: any) => {
    if (item.title) return item.title;
    if (item.name) return item.name;
    return "Item sem nome";
  };

  const getTrashTypeLabel = (type: string) => {
    switch(type) {
      case 'job': return 'Vaga';
      case 'candidate': return 'Candidato';
      case 'talent': return 'Talento';
      case 'setting': return 'Configuração';
      case 'user': return 'Usuário';
      case 'absence': return 'Absenteísmo';
      case 'employee': return 'Colaborador';
      default: return type;
    }
  };

  const handleRestore = async (id: string) => {
    if(confirm("Deseja restaurar este item? Ele voltará para a lista original.")) await restoreItem(id);
  };

  const handlePermanentDelete = async (id: string) => {
    if(confirm("TEM CERTEZA? Essa ação é irreversível e apagará o item para sempre.")) await permanentlyDeleteItem(id);
  };

  const startEditing = (item: SettingItem) => { setEditingId(item.id); setEditingName(item.name); };
  const cancelEditing = () => { setEditingId(null); setEditingName(''); };
  const saveEditing = (item: SettingItem) => { if (editingName.trim()) { updateSetting({ ...item, name: editingName }); setEditingId(null); setEditingName(''); } };
  
  const handleAddSetting = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (newSettingName.trim()) { 
      addSetting({ id: crypto.randomUUID(), name: newSettingName, type: activeTab }); 
      setNewSettingName(''); 
    } 
  };

  // --- LÓGICA PARA SALVAR UM CARGO PERSONALIZADO (CUSTOM ROLE) ---
  const handleSaveRole = async () => {
    if (!editingRole?.name.trim()) {
      alert("O nome do cargo é obrigatório.");
      return;
    }
    
    const roleDataStr = JSON.stringify({
      id: editingRole.id,
      name: editingRole.name,
      description: editingRole.description,
      permissions: editingRole.permissions
    });

    if ((editingRole as any).dbId) {
      await updateSetting({ id: (editingRole as any).dbId, name: editingRole.name, type: 'CUSTOM_ROLE', value: roleDataStr });
    } else {
      await addSetting({ id: crypto.randomUUID(), name: editingRole.name, type: 'CUSTOM_ROLE', value: roleDataStr });
    }

    setIsRoleModalOpen(false);
    setEditingRole(null);
  };

  const handleDeleteRole = async (dbId: string) => {
    if(confirm("ATENÇÃO: Se houver usuários usando este cargo, eles perderão o acesso. Deseja excluir este cargo personalizado?")) {
      await removeSetting(dbId);
    }
  };

  const openNewRoleModal = () => {
    setEditingRole({
      id: crypto.randomUUID(),
      name: '',
      description: '',
      permissions: {
        'COLABORADORES': 'NONE',
        'VAGAS': 'NONE',
        'QUADRO_PESSOAL': 'NONE',
        'ENTREVISTAS_GERAIS': 'NONE',
        'EXPERIENCIA_DESLIGAMENTO': 'NONE',
        'DASHBOARD': 'NONE',
        'CONFIGURACOES': 'NONE',
      }
    });
    setIsRoleModalOpen(true);
  };
  
  const handlePasswordChange = async (e: React.FormEvent) => { e.preventDefault(); if (passwordData.new !== passwordData.confirm) { setPasswordMsg({ type: 'error', text: 'A confirmação de senha não coincide.' }); return; } const result = await changePassword(passwordData.current, passwordData.new); if (result.success) { setPasswordMsg({ type: 'success', text: result.message }); setPasswordData({ current: '', new: '', confirm: '' }); } else { setPasswordMsg({ type: 'error', text: result.message }); } };
  const handleAdminReset = async (e: React.FormEvent) => { e.preventDefault(); if (!userToReset) return; if (resetData.new !== resetData.confirm) { setResetMsg({ type: 'error', text: 'As senhas não coincidem.' }); return; } const result = await adminResetPassword(userToReset.id, resetData.new); if (result.success) { setResetMsg({ type: 'success', text: result.message }); setTimeout(() => { setIsResetModalOpen(false); setUserToReset(null); setResetData({ new: '', confirm: '' }); setResetMsg(null); }, 2000); } else { setResetMsg({ type: 'error', text: result.message }); } };
  const openResetModal = (u: User) => { setUserToReset(u); setResetData({ new: '', confirm: '' }); setResetMsg(null); setIsResetModalOpen(true); };
  
  const handleCreateUser = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    if(!isMaster) return; 
    await addUser({ id: crypto.randomUUID(), name: newUser.name, username: newUser.username, password: newUser.password, role: newUser.role as any, createdBy: currentUser?.id }); 
    setNewUser({ name: '', username: '', password: '', role: 'RECRUITER' }); 
    alert('Usuário criado com sucesso!'); 
  };

  const handleExportBackup = () => {
    const backupData = {
      metadata: { version: "1.1", exportedAt: new Date().toISOString(), exportedBy: currentUser?.name },
      data: { settings, jobs, talents, candidates, users, employees, trash }
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ATS_FULL_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!confirm("ATENÇÃO: Isso irá adicionar/restaurar todos os dados do arquivo ao sistema atual. Deseja continuar?")) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonContent = JSON.parse(e.target?.result as string);
        const payload = jsonContent.data ? jsonContent.data : jsonContent;
        const response = await fetch('/api/main?action=restore-backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: payload }) });
        const result = await response.json();
        if (response.ok) { alert('✅ Backup importado com sucesso! A página será recarregada.'); window.location.reload(); } else { alert('❌ Erro ao importar: ' + (result.error || 'Erro desconhecido')); }
      } catch (error) { console.error(error); alert('Erro ao processar arquivo. Verifique se é um JSON válido.'); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
         <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Configurações</h1>
         <p className="text-slate-500 mt-1">Gestão do sistema, acessos e segurança</p>
      </div>

      <div className={`grid grid-cols-1 ${!isAuxiliar ? 'lg:grid-cols-2' : ''} gap-8`}>
        {/* Senha */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
           <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Key size={20} className="text-blue-600" /> Minha Senha</h3>
           <form onSubmit={handlePasswordChange} className="space-y-4">
              {passwordMsg && (<div className={`p-3 rounded-lg text-sm font-bold border ${passwordMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{passwordMsg.text}</div>)}
              <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Senha Atual</label><input required type="password" className="w-full border border-slate-300 p-2.5 rounded-lg" value={passwordData.current} onChange={e => setPasswordData({...passwordData, current: e.target.value})} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nova Senha</label><input required type="password" className="w-full border border-slate-300 p-2.5 rounded-lg" value={passwordData.new} onChange={e => setPasswordData({...passwordData, new: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Confirmar</label><input required type="password" className="w-full border border-slate-300 p-2.5 rounded-lg" value={passwordData.confirm} onChange={e => setPasswordData({...passwordData, confirm: e.target.value})} /></div>
              </div>
              <button type="submit" className="bg-slate-800 text-white font-bold py-2.5 px-6 rounded-lg w-full md:w-auto">Atualizar Senha</button>
           </form>
        </div>

        {/* Setores, Unidades, Recursos e CARGOS */}
        {!isAuxiliar && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="flex gap-4 mb-6 border-b border-slate-100 pb-2 overflow-x-auto custom-scrollbar">
               <button className={`pb-2 font-bold transition-colors text-sm uppercase tracking-wide whitespace-nowrap ${activeTab === 'SECTOR' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('SECTOR')}>Setores</button>
               <button className={`pb-2 font-bold transition-colors text-sm uppercase tracking-wide whitespace-nowrap ${activeTab === 'UNIT' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('UNIT')}>Unidades</button>
               <button className={`pb-2 font-bold transition-colors text-sm uppercase tracking-wide whitespace-nowrap ${activeTab === 'RESOURCE' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('RESOURCE')}>Recursos TI</button>
               <button className={`pb-2 font-bold transition-colors text-sm uppercase tracking-wide whitespace-nowrap ${activeTab === 'CUSTOM_ROLE' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('CUSTOM_ROLE')}><Lock size={14} className="inline mr-1 mb-0.5"/>Cargos</button>
             </div>
             
             {/* ABA: CONFIGURAÇÕES SIMPLES */}
             {activeTab !== 'CUSTOM_ROLE' && (
               <>
                 <form onSubmit={handleAddSetting} className="flex gap-2 mb-4">
                   <input 
                      type="text" 
                      className="flex-1 border border-slate-300 p-3 rounded-lg" 
                      placeholder={`Novo ${activeTab === 'SECTOR' ? 'Setor' : activeTab === 'UNIT' ? 'Unidade' : 'Recurso (Ex: Notebook)'}`} 
                      value={newSettingName} 
                      onChange={e => setNewSettingName(e.target.value)} 
                    />
                   <button type="submit" className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700"><Plus size={20} /></button>
                 </form>

                 <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                   {settings.filter((s:any) => s.type === activeTab).map((item:any) => (
                     <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                       {editingId === item.id ? (
                         <div className="flex flex-1 items-center gap-2"><input className="flex-1 border border-blue-300 p-1.5 rounded text-sm" value={editingName} onChange={e => setEditingName(e.target.value)} autoFocus /><button onClick={() => saveEditing(item)} className="text-green-600"><Check size={18}/></button><button onClick={cancelEditing} className="text-red-500"><X size={18}/></button></div>
                       ) : (
                         <>
                          <span className="text-slate-700 font-medium">{item.name}</span>
                          <div className="flex gap-2"><button onClick={() => startEditing(item)} className="text-slate-400 hover:text-blue-600"><Edit2 size={18} /></button><button onClick={() => removeSetting(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18} /></button></div>
                         </>
                       )}
                     </div>
                   ))}
                   {settings.filter((s:any) => s.type === activeTab).length === 0 && (
                      <p className="text-sm text-slate-400 italic py-4">Nenhum item cadastrado nesta categoria.</p>
                   )}
                 </div>
               </>
             )}

             {/* ABA: CARGOS PERSONALIZADOS */}
             {activeTab === 'CUSTOM_ROLE' && (
               <>
                 <div className="flex justify-between items-center mb-4">
                    <p className="text-xs text-slate-500">Crie perfis de acesso customizados.</p>
                    <button onClick={openNewRoleModal} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-blue-700 transition-colors"><Plus size={16}/> Novo Cargo</button>
                 </div>
                 
                 <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                   {/* Cargos Padrões que não podem ser editados aqui (Apenas ilustrativo) */}
                   <div className="flex justify-between items-center p-3 bg-slate-100 rounded-lg border border-slate-200 opacity-60 cursor-not-allowed">
                      <span className="text-slate-800 font-bold text-sm">MASTER <span className="font-normal text-xs ml-2 text-slate-500">(Sistema)</span></span>
                      <Lock size={16} className="text-slate-400"/>
                   </div>
                   <div className="flex justify-between items-center p-3 bg-slate-100 rounded-lg border border-slate-200 opacity-60 cursor-not-allowed">
                      <span className="text-slate-800 font-bold text-sm">RECRUITER <span className="font-normal text-xs ml-2 text-slate-500">(Sistema)</span></span>
                      <Lock size={16} className="text-slate-400"/>
                   </div>

                   {/* Cargos Customizados do Banco */}
                   {customRoles.map((role: any) => (
                     <div key={role.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                        <div>
                          <span className="text-slate-700 font-bold text-sm block">{role.name}</span>
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{role.description || 'Sem descrição'}</span>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => { setEditingRole(role); setIsRoleModalOpen(true); }} className="text-slate-400 hover:text-blue-600 p-1.5"><Edit2 size={16} /></button>
                           <button onClick={() => handleDeleteRole(role.dbId)} className="text-slate-400 hover:text-red-500 p-1.5"><Trash2 size={16} /></button>
                        </div>
                     </div>
                   ))}
                   
                   {customRoles.length === 0 && (
                      <p className="text-sm text-slate-400 italic py-4 text-center border border-dashed border-slate-200 rounded-lg mt-2">Nenhum cargo customizado. Crie um para limitar acessos de gerentes ou auxiliares.</p>
                   )}
                 </div>
               </>
             )}
          </div>
        )}
      </div>

      {isMaster && (
        <div className="bg-slate-900 text-slate-200 p-6 rounded-xl shadow-lg border border-slate-800 space-y-8">
          
          {/* --- BLOCO: GESTÃO DE COLABORADORES (EXCEL) --- */}
          <div>
            <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
              <FileSpreadsheet className="text-emerald-400" size={24} />
              <h2 className="text-xl font-bold text-white">Gestão de Colaboradores (Excel)</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800 p-5 rounded-lg border border-slate-700 flex flex-col justify-between">
                <div>
                  <h3 className="text-white font-bold mb-2 flex items-center gap-2"><DownloadCloud size={18}/> Exportar Dados / Modelo</h3>
                  <p className="text-xs text-slate-400">Baixe a planilha com os dados atuais ou use como modelo para importação.</p>
                </div>
                <button onClick={handleExportEmployeesExcel} className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 rounded-lg transition-colors">Gerar Planilha .XLSX</button>
              </div>
              <div className="bg-slate-800 p-5 rounded-lg border border-slate-700 flex flex-col justify-between">
                <div>
                  <h3 className="text-white font-bold mb-2 flex items-center gap-2"><UploadCloud size={18}/> Importar Colaboradores</h3>
                  <p className="text-xs text-slate-400">Ao subir a planilha, o sistema atualiza automaticamente os nomes existentes e cria os novos.</p>
                </div>
                <label className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg transition-colors text-center cursor-pointer">
                  Selecionar Arquivo Excel
                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportEmployeesExcel} />
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
            <ShieldCheck className="text-emerald-400" size={24} />
            <h2 className="text-xl font-bold text-white">Área Administrativa</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><UserPlus size={18}/> Novo Usuário</h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <input required placeholder="Nome" className="bg-slate-700 border-slate-600 text-white rounded-lg p-2.5" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                   <input required placeholder="Login" className="bg-slate-700 border-slate-600 text-white rounded-lg p-2.5" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input required type="password" placeholder="Senha" className="bg-slate-700 border-slate-600 text-white rounded-lg p-2.5" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                  
                  {/* SELECT DINÂMICO DE CARGOS NA CRIAÇÃO DE USUÁRIO */}
                  <select className="bg-slate-700 border-slate-600 text-white rounded-lg p-2.5" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <optgroup label="Cargos do Sistema">
                       <option value="RECRUITER">Recrutador Padrão</option>
                       <option value="MASTER">Master Admin</option>
                    </optgroup>
                    <optgroup label="Cargos Personalizados">
                       {customRoles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </optgroup>
                  </select>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg">Criar Usuário</button>
              </form>
            </div>
            <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Users size={18}/> Usuários</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {users.map((u: any) => {
                   // Tenta encontrar o nome amigável do cargo se for customizado
                   const isCustom = !['MASTER', 'RECRUITER', 'AUXILIAR_RH', 'RECEPCAO', 'GESTOR'].includes(u.role);
                   const customRoleName = isCustom ? customRoles.find((r:any) => r.id === u.role)?.name || 'Cargo Excluído' : u.role;

                   return (
                     <div key={u.id} className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                       <div>
                         <div className="font-bold text-slate-200">{u.name}</div>
                         <div className="text-xs text-slate-400">@{u.username} • {customRoleName}</div>
                       </div>
                       <button onClick={() => openResetModal(u)} className="text-xs bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded text-white">Resetar</button>
                     </div>
                   );
                })}
              </div>
            </div>
            
            <div className="lg:col-span-2 bg-slate-800 p-5 rounded-lg border border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4"><div><h3 className="text-lg font-bold text-white flex items-center gap-2"><Save size={18}/> Backup & Dados</h3><p className="text-sm text-slate-400">Exporte ou importe todos os dados.</p></div><div className="flex gap-4"><button onClick={handleExportBackup} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium"><Download size={18} /> Exportar Completo</button><label className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium cursor-pointer"><Upload size={18} /> Restaurar<input type="file" accept=".json" className="hidden" onChange={handleImportBackup} /></label></div></div>

            <div className="lg:col-span-2 bg-red-900/20 p-6 rounded-lg border border-red-900/50">
              <div className="flex items-center gap-3 mb-6 border-b border-red-800/50 pb-4">
                <Trash2 className="text-red-400" size={24} />
                <div><h2 className="text-xl font-bold text-red-50">Lixeira / Itens Excluídos</h2></div>
              </div>

              {trash && trash.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trash.map((item: any) => (
                    <div key={item.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2"><span className="text-xs font-bold uppercase tracking-wider text-slate-300 bg-slate-700 px-2 py-1 rounded">{getTrashTypeLabel(item.originalType)}</span><span className="text-xs text-slate-400">{item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : ''}</span></div>
                        <h4 className="font-bold text-white mb-1 truncate">{getTrashLabel(item)}</h4>
                      </div>
                      <div className="flex gap-2 mt-4"><button onClick={() => handleRestore(item.id)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-700 hover:bg-blue-600 text-blue-200 hover:text-white font-bold rounded-lg transition-colors text-sm border border-slate-600 hover:border-blue-500"><RotateCcw size={16} /> Restaurar</button><button onClick={() => handlePermanentDelete(item.id)} className="flex items-center justify-center px-3 py-2 bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white font-bold rounded-lg transition-colors border border-red-900/50 hover:border-red-500"><XCircle size={18} /></button></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500"><FileQuestion size={48} className="mx-auto mb-3 opacity-20" /><p>A lixeira está vazia.</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reset */}
      {isResetModalOpen && userToReset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Resetar Senha: {userToReset.name}</h3>
            {resetMsg && (<div className={`mb-4 p-3 rounded-lg text-sm font-bold border ${resetMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{resetMsg.text}</div>)}
            <form onSubmit={handleAdminReset} className="space-y-4">
              <div><label className="block text-sm font-bold text-slate-500 mb-1">Nova Senha</label><input autoFocus required type="password" className="w-full border border-slate-300 p-2.5 rounded-lg" value={resetData.new} onChange={e => setResetData({...resetData, new: e.target.value})} /></div>
              <div><label className="block text-sm font-bold text-slate-500 mb-1">Confirmar</label><input required type="password" className="w-full border border-slate-300 p-2.5 rounded-lg" value={resetData.confirm} onChange={e => setResetData({...resetData, confirm: e.target.value})} /></div>
              <div className="flex gap-3 mt-6"><button type="button" onClick={() => setIsResetModalOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-lg">Cancelar</button><button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg">Salvar</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GIGANTE DE CONFIGURAÇÃO DE PERMISSÕES DO CARGO */}
      {isRoleModalOpen && editingRole && (
         <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
               <div className="p-6 border-b border-slate-100 bg-slate-50 rounded-t-3xl flex justify-between items-center shrink-0">
                  <div>
                     <h3 className="font-black text-slate-800 uppercase tracking-tighter text-xl flex items-center gap-2">
                        <Settings className="text-blue-600"/> Matriz de Permissões
                     </h3>
                     <p className="text-xs text-slate-500 font-bold mt-1">Configure o nível de acesso em cada tela do sistema.</p>
                  </div>
                  <button onClick={() => { setIsRoleModalOpen(false); setEditingRole(null); }} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
               </div>

               <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Nome do Cargo (Role)</label>
                        <input 
                           type="text" 
                           placeholder="Ex: Gestor Comercial" 
                           className="w-full border border-slate-300 p-3 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                           value={editingRole.name} 
                           onChange={e => setEditingRole({...editingRole, name: e.target.value})} 
                        />
                     </div>
                     <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Descrição Breve</label>
                        <input 
                           type="text" 
                           placeholder="Ex: Só tem acesso para aprovar vagas" 
                           className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                           value={editingRole.description || ''} 
                           onChange={e => setEditingRole({...editingRole, description: e.target.value})} 
                        />
                     </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                     <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                           <tr>
                              <th className="p-4 w-1/3">Módulo / Tela</th>
                              <th className="p-4 text-center border-l border-slate-200">Nenhum Acesso</th>
                              <th className="p-4 text-center border-l border-slate-200">Ver Apenas</th>
                              <th className="p-4 text-center border-l border-slate-200">Editar (S/ Excluir)</th>
                              <th className="p-4 text-center border-l border-slate-200 bg-red-50 text-red-700">Controle Total</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {APP_MODULES.map((module) => (
                              <tr key={module.id} className="hover:bg-slate-50 transition-colors">
                                 <td className="p-4 font-bold text-slate-700">{module.label}</td>
                                 
                                 <td className="p-4 text-center border-l border-slate-100 cursor-pointer hover:bg-slate-100" onClick={() => setEditingRole({...editingRole, permissions: {...editingRole.permissions, [module.id]: 'NONE'}})}>
                                    <input type="radio" className="w-4 h-4 cursor-pointer" checked={editingRole.permissions[module.id] === 'NONE'} readOnly />
                                 </td>
                                 <td className="p-4 text-center border-l border-slate-100 cursor-pointer hover:bg-blue-50" onClick={() => setEditingRole({...editingRole, permissions: {...editingRole.permissions, [module.id]: 'VIEW'}})}>
                                    <input type="radio" className="w-4 h-4 cursor-pointer text-blue-600" checked={editingRole.permissions[module.id] === 'VIEW'} readOnly />
                                 </td>
                                 <td className="p-4 text-center border-l border-slate-100 cursor-pointer hover:bg-emerald-50" onClick={() => setEditingRole({...editingRole, permissions: {...editingRole.permissions, [module.id]: 'EDIT_BASIC'}})}>
                                    <input type="radio" className="w-4 h-4 cursor-pointer text-emerald-600" checked={editingRole.permissions[module.id] === 'EDIT_BASIC'} readOnly />
                                 </td>
                                 <td className="p-4 text-center border-l border-slate-100 bg-red-50/30 cursor-pointer hover:bg-red-50" onClick={() => setEditingRole({...editingRole, permissions: {...editingRole.permissions, [module.id]: 'EDIT_FULL'}})}>
                                    <input type="radio" className="w-4 h-4 cursor-pointer text-red-600" checked={editingRole.permissions[module.id] === 'EDIT_FULL'} readOnly />
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
                  <p className="text-xs text-slate-500 italic mt-2 text-center">
                     * <b className="text-emerald-700">Editar (S/ Excluir)</b>: Permite alterar informações básicas, mas bloqueia o botão de lixeira e informações de salário de colaboradores.<br/>
                     * <b className="text-red-700">Controle Total</b>: Acesso completo, com poderes administrativos sobre os dados daquela tela.
                  </p>
               </div>

               <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex justify-end gap-3 shrink-0">
                  <button onClick={() => { setIsRoleModalOpen(false); setEditingRole(null); }} className="px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                  <button onClick={handleSaveRole} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95">Salvar Cargo</button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};