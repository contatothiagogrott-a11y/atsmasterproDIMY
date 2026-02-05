
import * as XLSX from 'xlsx';
import { Job, Candidate, User } from '../types';

// Helper: Formata data ISO para PT-BR
const formatDate = (dateStr?: string | null): string => {
  if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return '';
  const isoDatePart = dateStr.split('T')[0];
  if (!isoDatePart) return '';
  const parts = isoDatePart.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

// Helper: Calcula diferença em dias entre duas datas
const getDaysDiff = (start: string | Date, end: string | Date): number => {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const diff = Math.max(0, e - s);
  return Math.ceil(diff / (1000 * 3600 * 24));
};

// Helper: Calcula dias totais congelados
const calculateTotalFreezeDays = (job: Job): number => {
  if (!job.freezeHistory || job.freezeHistory.length === 0) return 0;
  
  let totalMs = 0;
  job.freezeHistory.forEach(freeze => {
    const start = new Date(freeze.startDate).getTime();
    const end = freeze.endDate ? new Date(freeze.endDate).getTime() : new Date().getTime();
    totalMs += Math.max(0, end - start);
  });
  
  return Math.ceil(totalMs / (1000 * 3600 * 24));
};

export const exportToExcel = (jobs: Job[], candidates: Candidate[], users: User[]) => {
  const rows: any[] = [];

  // Garante unicidade das vagas
  const uniqueJobs = Array.from(new Set(jobs.map(j => j.id)))
    .map(id => jobs.find(j => j.id === id)!);

  uniqueJobs.forEach(job => {
    if (job.isHidden) return;

    // --- BLOCO 1: IDENTIFICAÇÃO ---
    const recruiterName = users.find(u => u.id === job.createdBy)?.name || 'N/A';

    // --- BLOCO 2: CRONOGRAMA & CONGELAMENTO ---
    const totalFreezeDays = calculateTotalFreezeDays(job);
    const hasFreeze = totalFreezeDays > 0 || (job.freezeHistory && job.freezeHistory.length > 0) ? 'Sim' : 'Não';
    
    // Pega último evento de congelamento para exibir datas
    const lastFreezeEvent = job.freezeHistory?.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
    const lastFreezeDate = lastFreezeEvent ? formatDate(lastFreezeEvent.startDate) : '-';
    const lastUnfreezeDate = lastFreezeEvent?.endDate ? formatDate(lastFreezeEvent.endDate) : (job.status === 'Congelada' ? 'Em andamento' : '-');
    const closingDate = job.closedAt ? formatDate(job.closedAt) : '-';

    // --- BLOCO 3: DADOS DO CANDIDATO SELECIONADO ---
    const allJobCandidates = candidates.filter(c => c.jobId === job.id);
    const hiredCandidate = allJobCandidates.find(c => c.status === 'Contratado');
    
    let winnerName = '-';
    let winnerOrigin = '-';
    let winnerFirstContact = '-';
    let winnerApprover = '-';
    let winnerApproveDate = '-';
    let winnerStartDate = '-';
    let candidateSLA = 0;

    if (hiredCandidate) {
        winnerName = hiredCandidate.name;
        winnerOrigin = hiredCandidate.origin;
        winnerFirstContact = formatDate(hiredCandidate.firstContactAt);
        winnerApprover = hiredCandidate.techTestEvaluator || '-';
        winnerApproveDate = formatDate(hiredCandidate.testApprovalDate);
        winnerStartDate = formatDate(hiredCandidate.timeline?.startDate);

        // SLA Candidato: Data Inicio (ou fechamento) - Data 1º Contato
        if (hiredCandidate.firstContactAt) {
            const endCandidacy = hiredCandidate.timeline?.startDate || job.closedAt || new Date().toISOString();
            candidateSLA = getDaysDiff(hiredCandidate.firstContactAt, endCandidacy);
        }
    }

    // --- BLOCO 4: VOLUME (Métricas de Funil) ---
    const totalApplicants = allJobCandidates.length;
    const totalInterviewed = allJobCandidates.filter(c => c.timeline?.interview).length;
    // Finalistas: Status avançados
    const totalFinalists = allJobCandidates.filter(c => 
        ['Em Teste', 'Entrevista', 'Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)
    ).length;

    // --- BLOCO 5: KPIs e SLAs ---
    const today = new Date().toISOString();
    const endDateForSLA = job.closedAt || today;
    
    const slaGross = getDaysDiff(job.openedAt, endDateForSLA);
    const slaNet = Math.max(0, slaGross - totalFreezeDays);

    // PUSH DA LINHA (Ordem Estrita)
    rows.push([
        // BLOCO 1
        job.id,                     // A: ID Vaga
        job.title,                  // B: Título
        job.unit,                   // C: Unidade
        job.sector,                 // D: Setor
        recruiterName,              // E: Recrutador Responsável

        // BLOCO 2
        formatDate(job.openedAt),   // F: Data Abertura
        job.status,                 // G: Status Atual
        hasFreeze,                  // H: Houve Congelamento?
        lastFreezeDate,             // I: Data Congelamento (Último)
        lastUnfreezeDate,           // J: Data Descongelamento (Último)
        totalFreezeDays,            // K: Dias Totais Congelada
        closingDate,                // L: Data Fechamento

        // BLOCO 3
        winnerName,                 // M: Nome do Contratado
        winnerOrigin,               // N: Origem
        winnerFirstContact,         // O: Data 1º Contato
        winnerApprover,             // P: Aprovador do Teste
        winnerApproveDate,          // Q: Data Aprovação Teste
        winnerStartDate,            // R: Data de Início

        // BLOCO 4
        totalApplicants,            // S: Total Inscritos
        totalInterviewed,           // T: Total Entrevistados
        totalFinalists,             // U: Total Finalistas

        // BLOCO 5
        slaGross,                   // V: SLA Vaga (Bruto)
        totalFreezeDays,            // W: Desconto de Congelamento (Repete K para cálculo fácil)
        slaNet,                     // X: SLA Vaga (Líquido/Real)
        hiredCandidate ? candidateSLA : '-' // Y: SLA Candidato
    ]);
  });

  // --- CABEÇALHOS ---
  const headerTitle = [`Relatório SLA Completo e Auditoria de Vagas - ATS Master Pro`];
  const headerSubtitle = [`Gerado em: ${new Date().toLocaleDateString('pt-BR')} | Contabilização de Congelamento e Funil`];
  const headerSpacer = [''];
  
  const tableHeaders = [
    // B1
    "ID Vaga", "Título da Vaga", "Unidade", "Setor", "Recrutador Responsável",
    // B2
    "Data Abertura", "Status Atual", "Houve Congelamento?", "Data Congelamento", "Data Descongelamento", "Dias Totais Congelada", "Data Fechamento",
    // B3
    "Nome do Contratado", "Origem", "Data 1º Contato", "Aprovador do Teste", "Data Aprovação Teste", "Data de Início",
    // B4
    "Total Inscritos", "Total Entrevistados", "Total Finalistas",
    // B5
    "SLA Vaga (Bruto Dias)", "Desconto Congelamento (Dias)", "SLA Vaga (Líquido/Real Dias)", "SLA Candidato (Dias)"
  ];

  const wsData = [
    headerTitle,
    headerSubtitle,
    headerSpacer,
    tableHeaders,
    ...rows
  ];

  // Configuração da Planilha
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  
  // Merge de Título
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 24 } }, 
    { s: { r: 1, c: 0 }, e: { r: 1, c: 24 } }, 
  ];

  // Largura de Colunas
  worksheet['!cols'] = [
    { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, // B1
    { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, // B2
    { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, // B3
    { wch: 10 }, { wch: 10 }, { wch: 10 }, // B4
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 } // B5
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "SLA Analítico");
  XLSX.writeFile(workbook, `ATS_SLA_Analitico_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportJobCandidates = (job: Job, candidates: Candidate[]) => {
  const rows = candidates.map(cand => {
    let processTimeText = '-';
    if (cand.firstContactAt) {
      const endProc = (cand.status === 'Contratado' || cand.status === 'Reprovado') && (cand.timeline?.startDate || cand.rejectionDate)
        ? new Date(cand.timeline?.startDate || cand.rejectionDate!).getTime() 
        : new Date().getTime();
      const startProc = new Date(cand.firstContactAt).getTime();
      const diff = Math.ceil(Math.max(0, endProc - startProc) / (1000 * 3600 * 24));
      processTimeText = `${diff} dias`;
    }

    return [
      cand.name,
      cand.city || '-',
      cand.salaryExpectation || '-',
      cand.origin,
      cand.status,
      formatDate(cand.firstContactAt),
      formatDate(cand.timeline?.interview),
      cand.techTest ? (cand.techTestResult || 'Sim') : 'Não',
      cand.rejectionReason || '-',
      processTimeText,
      cand.rejectedBy || '-',
      formatDate(cand.rejectionDate),
      formatDate(cand.testApprovalDate)
    ];
  });

  const headerTitle = [`Relatório de Candidatos - ${job.title}`];
  const headerInfo = [`Setor: ${job.sector} | Unidade: ${job.unit} | Status Vaga: ${job.status}`];
  const tableHeaders = [
    "Nome do Candidato",
    "Cidade",
    "Pretensão Salarial",
    "Origem",
    "Status Atual",
    "Data 1º Contato",
    "Data Entrevista",
    "Resultado Teste",
    "Motivo da Perda (Tag)",
    "Tempo de Processo",
    "Reprovado_Por",
    "Data_Reprovacao",
    "Data_Aprovacao_Teste"
  ];

  const wsData = [
    headerTitle,
    headerInfo,
    [''],
    tableHeaders,
    ...rows
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
  ];
  worksheet['!cols'] = [
    { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, 
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 18 },
    { wch: 20 }, { wch: 15 }, { wch: 15 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Candidatos");
  XLSX.writeFile(workbook, `ATS_Vaga_${job.title.replace(/\s+/g, '_')}_Candidatos.xlsx`);
};

export const exportJobsList = (jobs: Job[], candidates: Candidate[]) => {
  const data = jobs.filter(j => !j.isHidden).map(job => {
    const jobCandidates = candidates.filter(c => c.jobId === job.id);
    return {
      "Nome da Vaga": String(job.title || ''),
      "Data de Abertura": formatDate(job.openedAt),
      "Status": String(job.status || ''),
      "Tipo de Abertura": String(job.openingDetails?.reason || 'Aumento de Quadro'),
      "Colaborador Substituído": job.openingDetails?.reason === 'Substituição' ? (job.isConfidential ? 'CONFIDENCIAL' : String(job.openingDetails.replacedEmployee || '')) : '',
      "Total de Candidatos": jobCandidates.length,
    };
  });
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vagas");
  XLSX.writeFile(workbook, `ATS_Lista_Vagas_${new Date().toISOString().split('T')[0]}.xlsx`);
};
