import * as XLSX from 'xlsx';
import { Job, Candidate, User } from '../types';

// Helper: Formata data ISO para PT-BR
const formatDate = (dateStr?: string | null): string => {
  if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return '';
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
  const uniqueJobs = Array.from(new Set(jobs.map(j => j.id))).map(id => jobs.find(j => j.id === id)!);

  uniqueJobs.forEach(job => {
    if (job.isHidden) return;
    const recruiterName = users.find(u => u.id === job.createdBy)?.name || 'N/A';
    const totalFreezeDays = calculateTotalFreezeDays(job);
    const hasFreeze = totalFreezeDays > 0 ? 'Sim' : 'Não';
    const closingDate = job.closedAt ? formatDate(job.closedAt) : '-';

    const allJobCandidates = candidates.filter(c => c.jobId === job.id);
    const hiredCandidate = allJobCandidates.find(c => c.status === 'Contratado');
    
    let winnerName = '-', winnerOrigin = '-', winnerSLA = 0;

    if (hiredCandidate) {
        winnerName = hiredCandidate.name;
        winnerOrigin = hiredCandidate.origin;
        if (hiredCandidate.firstContactAt) {
            const endCandidacy = hiredCandidate.timeline?.startDate || job.closedAt || new Date().toISOString();
            winnerSLA = getDaysDiff(hiredCandidate.firstContactAt, endCandidacy);
        }
    }

    const today = new Date().toISOString();
    const endDateForSLA = job.closedAt || today;
    const slaGross = getDaysDiff(job.openedAt, endDateForSLA);
    const slaNet = Math.max(0, slaGross - totalFreezeDays);

    rows.push([
        job.title, job.unit, job.sector, recruiterName,
        formatDate(job.openedAt), job.status, hasFreeze, totalFreezeDays, closingDate,
        winnerName, winnerOrigin,
        allJobCandidates.length, 
        allJobCandidates.filter(c => c.interviewAt).length,
        slaGross, slaNet, hiredCandidate ? winnerSLA : '-'
    ]);
  });

  const wsData = [
    ["Relatório SLA e Auditoria de Vagas"],
    [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
    [''],
    ["Título da Vaga", "Unidade", "Setor", "Recrutador", "Abertura", "Status", "Congelada?", "Dias Cong.", "Fechamento", "Contratado", "Origem", "Inscritos", "Entrevistados", "SLA Bruto", "SLA Líquido", "SLA Candidato"],
    ...rows
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "SLA");
  XLSX.writeFile(workbook, `ATS_SLA_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// --- EXPORT 2: DETALHES DA VAGA (CANDIDATOS) - ATUALIZADO COM MOTIVOS ---
export const exportJobCandidates = (job: Job, candidates: Candidate[]) => {
  const rows = candidates.map(cand => {
    let processTimeText = '-';
    if (cand.firstContactAt) {
      const endProc = (cand.status === 'Contratado' || cand.status === 'Reprovado' || cand.status === 'Desistência') && (cand.timeline?.startDate || cand.rejectionDate)
        ? new Date(cand.timeline?.startDate || cand.rejectionDate!).getTime() 
        : new Date().getTime();
      const diff = Math.ceil(Math.max(0, endProc - new Date(cand.firstContactAt).getTime()) / (1000 * 3600 * 24));
      processTimeText = `${diff} dias`;
    }

    return [
      cand.name,
      cand.city || '-',
      cand.phone || '-',
      cand.email || '-',
      cand.origin,
      cand.status,
      formatDate(cand.firstContactAt),
      formatDate(cand.interviewAt),
      cand.techTest ? (cand.techTestResult || 'Realizado') : 'Não',
      
      // COLUNAS DE MOTIVOS (Respeitando a caixa de texto "Outros")
      cand.status === 'Reprovado' ? (cand.rejectionReason || 'Não informado') : '-',
      cand.status === 'Desistência' ? (cand.rejectionReason || 'Não informado') : '-',
      
      processTimeText,
      cand.rejectedBy || '-',
      formatDate(cand.rejectionDate)
    ];
  });

  const headerTitle = [`Relatório de Candidatos - ${job.title}`];
  const tableHeaders = [
    "Nome do Candidato", "Cidade", "Telefone", "E-mail", "Origem", "Status Atual",
    "1º Contato", "Data Entrevista", "Teste Técnico", 
    "MOTIVO REPROVAÇÃO", "MOTIVO DESISTÊNCIA", // Novas colunas solicitadas
    "Tempo de Processo", "Responsável Perda", "Data da Perda"
  ];

  const wsData = [headerTitle, [''], tableHeaders, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Candidatos");
  XLSX.writeFile(workbook, `ATS_Candidatos_${job.title.replace(/\s+/g, '_')}.xlsx`);
};

// --- EXPORT 3: RELATÓRIO ESTRATÉGICO (BI) - ATUALIZADO COM TESTES ---
export const exportStrategicReport = (metrics: any, startDate: string, endDate: string) => {
    const wb = XLSX.utils.book_new();
  
    // ABA 1: RESUMO GERAL
    const summaryData = [
      ["RELATÓRIO ESTRATÉGICO DE PERFORMANCE"],
      [`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`],
      [""],
      ["INDICADOR", "VALOR"],
      ["Vagas Abertas (Total)", metrics.opened.total],
      ["   - Aumento de Quadro", metrics.opened.expansion],
      ["   - Substituição", metrics.opened.replacement],
      ["Vagas Concluídas", metrics.closed.total],
      ["Entrevistas Realizadas", metrics.interviews.total || metrics.interviews],
      ["Testes Técnicos Realizados", metrics.tests.total || metrics.tests], // Adicionado conforme solicitado
      [""],
      ["INDICADOR DE PERDAS", "VALOR"],
      ["Total de Reprovações (Empresa)", metrics.rejected.total],
      ["Total de Desistências (Candidato)", metrics.withdrawn.total]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Executivo");
  
    // ABA 2: POR SETOR
    const sectorRows = Object.entries(metrics.bySector).map(([sector, data]: any) => [
        sector, data.opened, data.closed, data.frozen, data.canceled
    ]);
    const wsDataSector = [
        ["MOVIMENTAÇÃO POR SETOR"],
        ["Setor", "Abertas", "Fechadas", "Congeladas", "Canceladas"],
        ...sectorRows
    ];
    const wsSector = XLSX.utils.aoa_to_sheet(wsDataSector);
    XLSX.utils.book_append_sheet(wb, wsSector, "Por Setor");
  
    // ABA 3: MOTIVOS DETALHADOS
    const rejectionRows = Object.entries(metrics.rejected.reasons || {}).map(([r, c]: any) => ["Reprovação", r, c]);
    const withdrawalRows = Object.entries(metrics.withdrawn.reasons || {}).map(([r, c]: any) => ["Desistência", r, c]);

    const wsDataReasons = [
        ["MOTIVOS DE PERDA DETALHADOS"],
        ["Tipo", "Justificativa / Motivo", "Quantidade"],
        ...rejectionRows,
        ...withdrawalRows
    ];
    const wsReasons = XLSX.utils.aoa_to_sheet(wsDataReasons);
    XLSX.utils.book_append_sheet(wb, wsReasons, "Motivos");
  
    XLSX.writeFile(wb, `ATS_BI_Estrategico_${startDate}_${endDate}.xlsx`);
};

// Mantenha o exportJobsList se ainda for necessário
export const exportJobsList = (jobs: Job[], candidates: Candidate[]) => {
  const data = jobs.filter(j => !j.isHidden).map(job => ({
      "Vaga": job.title,
      "Status": job.status,
      "Abertura": formatDate(job.openedAt),
      "Candidatos": candidates.filter(c => c.jobId === job.id).length
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lista");
  XLSX.writeFile(wb, "ATS_Lista_Vagas.xlsx");
};
