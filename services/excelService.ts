import * as XLSX from 'xlsx';
import { Job, Candidate, User } from '../types';

// Helper: Formata data ISO para PT-BR
const formatDate = (dateStr?: string | null): string => {
  if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return '';
  // Se vier YYYY-MM-DD direto (do input date), não tem T
  const isoDatePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
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

// --- EXPORT 1: SLA GERAL (LISTAGEM DE VAGAS) ---
export const exportToExcel = (jobs: Job[], candidates: Candidate[], users: User[]) => {
  const rows: any[] = [];

  const uniqueJobs = Array.from(new Set(jobs.map(j => j.id)))
    .map(id => jobs.find(j => j.id === id)!);

  uniqueJobs.forEach(job => {
    if (job.isHidden) return;

    // BLOCO 1
    const recruiterName = users.find(u => u.id === job.createdBy)?.name || 'N/A';

    // BLOCO 2
    const totalFreezeDays = calculateTotalFreezeDays(job);
    const hasFreeze = totalFreezeDays > 0 || (job.freezeHistory && job.freezeHistory.length > 0) ? 'Sim' : 'Não';
    
    const lastFreezeEvent = job.freezeHistory?.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
    const lastFreezeDate = lastFreezeEvent ? formatDate(lastFreezeEvent.startDate) : '-';
    const lastUnfreezeDate = lastFreezeEvent?.endDate ? formatDate(lastFreezeEvent.endDate) : (job.status === 'Congelada' ? 'Em andamento' : '-');
    const closingDate = job.closedAt ? formatDate(job.closedAt) : '-';

    // BLOCO 3
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

        if (hiredCandidate.firstContactAt) {
            const endCandidacy = hiredCandidate.timeline?.startDate || job.closedAt || new Date().toISOString();
            candidateSLA = getDaysDiff(hiredCandidate.firstContactAt, endCandidacy);
        }
    }

    // BLOCO 4
    const totalApplicants = allJobCandidates.length;
    const totalInterviewed = allJobCandidates.filter(c => c.interviewAt).length; // Ajustado para novo campo
    const totalFinalists = allJobCandidates.filter(c => 
        ['Em Teste', 'Entrevista', 'Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)
    ).length;

    // BLOCO 5
    const today = new Date().toISOString();
    const endDateForSLA = job.closedAt || today;
    
    const slaGross = getDaysDiff(job.openedAt, endDateForSLA);
    const slaNet = Math.max(0, slaGross - totalFreezeDays);

    rows.push([
        job.id, job.title, job.unit, job.sector, recruiterName,
        formatDate(job.openedAt), job.status, hasFreeze, lastFreezeDate, lastUnfreezeDate, totalFreezeDays, closingDate,
        winnerName, winnerOrigin, winnerFirstContact, winnerApprover, winnerApproveDate, winnerStartDate,
        totalApplicants, totalInterviewed, totalFinalists,
        slaGross, totalFreezeDays, slaNet, hiredCandidate ? candidateSLA : '-'
    ]);
  });

  const headerTitle = [`Relatório SLA Completo e Auditoria de Vagas`];
  const headerSubtitle = [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`];
  
  const tableHeaders = [
    "ID Vaga", "Título da Vaga", "Unidade", "Setor", "Recrutador Responsável",
    "Data Abertura", "Status Atual", "Houve Congelamento?", "Data Congelamento", "Data Descongelamento", "Dias Totais Congelada", "Data Fechamento",
    "Nome do Contratado", "Origem", "Data 1º Contato", "Aprovador do Teste", "Data Aprovação Teste", "Data de Início",
    "Total Inscritos", "Total Entrevistados", "Total Finalistas",
    "SLA Vaga (Bruto Dias)", "Desconto Congelamento (Dias)", "SLA Vaga (Líquido/Real Dias)", "SLA Candidato (Dias)"
  ];

  const wsData = [headerTitle, headerSubtitle, [''], tableHeaders, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 24 } }];
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "SLA Analítico");
  XLSX.writeFile(workbook, `ATS_SLA_Analitico_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// --- EXPORT 2: DETALHES DA VAGA (CANDIDATOS) ---
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
      formatDate(cand.interviewAt), // Ajustado para novo campo
      cand.techTest ? (cand.techTestResult || 'Sim') : 'Não',
      cand.rejectionReason || '-',
      processTimeText,
      cand.rejectedBy || '-',
      formatDate(cand.rejectionDate),
      formatDate(cand.testApprovalDate)
    ];
  });

  const headerTitle = [`Relatório de Candidatos - ${job.title}`];
  const tableHeaders = [
    "Nome do Candidato", "Cidade", "Pretensão Salarial", "Origem", "Status Atual",
    "Data 1º Contato", "Data Entrevista", "Resultado Teste", "Motivo da Perda", "Tempo de Processo",
    "Reprovado_Por", "Data_Reprovacao", "Data_Aprovacao_Teste"
  ];

  const wsData = [headerTitle, [''], tableHeaders, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Candidatos");
  XLSX.writeFile(workbook, `ATS_Candidatos_${job.title.substring(0, 10)}.xlsx`);
};

// --- EXPORT 3: LISTA SIMPLES DE VAGAS ---
export const exportJobsList = (jobs: Job[], candidates: Candidate[]) => {
  const data = jobs.filter(j => !j.isHidden).map(job => {
    const jobCandidates = candidates.filter(c => c.jobId === job.id);
    return {
      "Nome da Vaga": String(job.title || ''),
      "Data de Abertura": formatDate(job.openedAt),
      "Status": String(job.status || ''),
      "Tipo de Abertura": String(job.openingDetails?.reason || 'Aumento de Quadro'),
      "Total de Candidatos": jobCandidates.length,
    };
  });
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vagas");
  XLSX.writeFile(workbook, `ATS_Lista_Vagas.xlsx`);
};

// --- NOVO: EXPORT 4: RELATÓRIO ESTRATÉGICO (DASHBOARD) ---
export const exportStrategicReport = (metrics: any, startDate: string, endDate: string) => {
    const wb = XLSX.utils.book_new();
  
    // ABA 1: RESUMO GERAL
    const summaryData = [
      ["RELATÓRIO ESTRATÉGICO DE RECRUTAMENTO"],
      [`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`],
      [""],
      ["INDICADOR", "VALOR"],
      ["Vagas Abertas (Total)", metrics.opened.total],
      ["   - Aumento de Quadro", metrics.opened.expansion],
      ["   - Substituição", metrics.opened.replacement],
      ["Vagas Concluídas", metrics.closed.total],
      ["Entrevistas Realizadas", metrics.interviews],
      ["Candidatos Reprovados/Desistentes", metrics.rejected.total]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    // Ajuste de largura
    wsSummary['!cols'] = [{ wch: 35 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Executivo");
  
    // ABA 2: POR SETOR
    // Transforma o objeto de setores em array para o Excel
    const sectorRows = Object.entries(metrics.bySector).map(([sector, data]: any) => [
        sector, 
        data.opened, 
        data.closed
    ]);
    const wsDataSector = [
        ["ANÁLISE POR SETOR"],
        ["Setor", "Vagas Abertas no Período", "Vagas Fechadas no Período"],
        ...sectorRows
    ];
    const wsSector = XLSX.utils.aoa_to_sheet(wsDataSector);
    wsSector['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSector, "Por Setor");
  
    // ABA 3: MOTIVOS DE PERDA
    const reasonRows = Object.entries(metrics.rejected.reasons)
        .sort((a: any, b: any) => b[1] - a[1]) // Ordena do maior para o menor
        .map(([reason, count]: any) => [reason, count]);
        
    const wsDataReasons = [
        ["MOTIVOS DE PERDA (Reprovação e Desistência)"],
        ["Motivo", "Quantidade"],
        ...reasonRows
    ];
    const wsReasons = XLSX.utils.aoa_to_sheet(wsDataReasons);
    wsReasons['!cols'] = [{ wch: 40 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsReasons, "Motivos de Perda");
  
    // Salvar Arquivo
    XLSX.writeFile(wb, `ATS_Report_Estrategico_${startDate}_${endDate}.xlsx`);
  };
