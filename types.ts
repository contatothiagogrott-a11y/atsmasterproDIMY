import * as XLSX from 'xlsx';
import { Job, Candidate, User, OpeningDetails } from '../types';

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

// --- EXPORT 2: DETALHES DA VAGA (CANDIDATOS) ---
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
    "MOTIVO REPROVAÇÃO", "MOTIVO DESISTÊNCIA",
    "Tempo de Processo", "Responsável Perda", "Data da Perda"
  ];

  const wsData = [headerTitle, [''], tableHeaders, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Candidatos");
  XLSX.writeFile(workbook, `ATS_Candidatos_${job.title.replace(/\s+/g, '_')}.xlsx`);
};

// --- EXPORT 3: RELATÓRIO ESTRATÉGICO (BI) - ATUALIZADO COM ABA 4 DETALHADA ---
export const exportStrategicReport = (metrics: any, startDate: string, endDate: string, candidates?: Candidate[]) => {
    const wb = XLSX.utils.book_new();
  
    // ==========================================
    // ABA 1: RESUMO EXECUTIVO
    // ==========================================
    const summaryData = [
      ["RELATÓRIO ESTRATÉGICO DE PERFORMANCE"],
      [`Período Analisado: ${formatDate(startDate)} a ${formatDate(endDate)}`],
      [""],
      ["", "FLUXO DE VAGAS", "VOLUME"],
      ["", "Volume Total Trabalhado no Período", metrics.allActive?.total || 0],
      ["", "  ↳ Vagas em Backlog (Vindas de meses anteriores)", metrics.backlog?.total || 0],
      ["", "  ↳ Novas Vagas (Abertas neste período)", metrics.openedNew?.total || 0],
      ["", "  ↳ Vagas por Aumento de Quadro", metrics.expansion?.total || 0],
      ["", "  ↳ Vagas por Substituição", metrics.replacement?.total || 0],
      ["", "Vagas Fechadas (Sucesso)", metrics.closed?.total || 0],
      ["", "Vagas Congeladas", metrics.frozen?.total || 0],
      ["", "Vagas Canceladas", metrics.canceled?.total || 0],
      ["", "Saldo de Vagas em Aberto (Final do Período)", metrics.balanceOpen?.total || 0],
      [""],
      ["", "SLA DE FECHAMENTO", "DIAS"],
      ["", "Tempo Médio Líquido de Fechamento (SLA)", `${metrics.sla?.avg || 0} dias`],
      [""],
      ["", "FUNIL DE CANDIDATOS", "VOLUME"],
      ["", "Candidatos Entrevistados", metrics.interviews?.total || 0],
      ["", "Testes Técnicos Realizados", metrics.tests?.total || 0],
      ["", "Reprovações (Pela Empresa)", metrics.rejected?.total || 0],
      ["", "Desistências (Pelo Candidato)", metrics.withdrawn?.total || 0]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 2 }, { wch: 50 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Executivo");
  
    // ==========================================
    // ABA 2: POR SETOR
    // ==========================================
    const sectorHeaders = ["Setor / Departamento", "Abertas no Período", "Fechadas no Período", "Congeladas", "Canceladas"];
    const sectorRows = Object.entries(metrics.bySector || {}).map(([sector, data]: any) => [
        sector, 
        data.opened || 0, 
        data.closed || 0, 
        data.frozen || 0, 
        data.canceled || 0
    ]);
    
    const wsDataSector = [
        ["ANÁLISE DE MOVIMENTAÇÃO POR SETOR"],
        [`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`],
        [""],
        sectorHeaders,
        ...sectorRows
    ];
    const wsSector = XLSX.utils.aoa_to_sheet(wsDataSector);
    wsSector['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsSector, "Análise por Setor");
  
    // ==========================================
    // ABA 3: MOTIVOS DE PERDA
    // ==========================================
    const rejectionRows = Object.entries(metrics.rejected?.reasons || {}).map(([reason, count]: any) => [
        "Reprovação (Empresa)", reason, count
    ]);
    const withdrawalRows = Object.entries(metrics.withdrawn?.reasons || {}).map(([reason, count]: any) => [
        "Desistência (Candidato)", reason, count
    ]);

    const reasonsHeaders = ["Classificação", "Motivo Registrado", "Quantidade de Ocorrências"];
    const wsDataReasons = [
        ["DIAGNÓSTICO DE PERDAS DE CANDIDATOS"],
        [`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`],
        [""],
        reasonsHeaders,
        ...rejectionRows,
        ...withdrawalRows
    ];
    const wsReasons = XLSX.utils.aoa_to_sheet(wsDataReasons);
    wsReasons['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsReasons, "Diagnóstico de Perdas");

    // ==========================================
    // ABA 4: DETALHAMENTO VAGAS ABERTAS (NOVA)
    // ==========================================
    if (metrics.balanceOpen && metrics.balanceOpen.list) {
        const openJobsHeaders = [
            "Título da Vaga", 
            "Setor", 
            "Unidade", 
            "Data Abertura", 
            "Dias em Aberto",
            "Tipo da Vaga", 
            "Quem Pediu (Solicitante)", 
            "Substituído (Se houver)"
        ];

        const openJobsRows = metrics.balanceOpen.list.map((job: Job) => {
            // Mapping baseado no seu types.ts
            const details = job.openingDetails || {} as OpeningDetails;
            
            const tipo = details.reason || 'Aumento de Quadro';
            const solicitante = job.requesterName || 'N/I';
            const substituido = (tipo === 'Substituição') ? (details.replacedEmployee || '-') : '-';

            return [
                job.title,
                job.sector,
                job.unit,
                formatDate(job.openedAt),
                getDaysDiff(job.openedAt, endDate), // Dias em aberto até o fim do filtro
                tipo,
                solicitante,
                substituido
            ];
        });

        const wsDataOpen = [
            ["DETALHAMENTO DE VAGAS EM ABERTO (SALDO FINAL)"],
            [`Posição referente a: ${formatDate(endDate)}`],
            [""],
            openJobsHeaders,
            ...openJobsRows
        ];

        const wsOpen = XLSX.utils.aoa_to_sheet(wsDataOpen);
        wsOpen['!cols'] = [
            { wch: 30 }, // Título
            { wch: 20 }, // Setor
            { wch: 15 }, // Unidade
            { wch: 15 }, // Abertura
            { wch: 12 }, // Dias
            { wch: 20 }, // Tipo
            { wch: 30 }, // Solicitante (RequesterName)
            { wch: 30 }  // Substituído
        ];
        XLSX.utils.book_append_sheet(wb, wsOpen, "Detalhamento Vagas Abertas");
    }
  
    // Gera o arquivo
    XLSX.writeFile(wb, `ATS_Relatorio_Estrategico_${startDate}_ate_${endDate}.xlsx`);
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
