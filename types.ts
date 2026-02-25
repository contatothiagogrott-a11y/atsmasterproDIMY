export type UserRole = 'MASTER' | 'RECRUITER' | 'AUXILIAR_RH'; // <-- ADICIONADO AUXILIAR_RH

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  createdBy?: string;
}

export interface SettingItem {
  id: string;
  name: string;
  type: 'SECTOR' | 'UNIT';
}

export type JobStatus = 'Aberta' | 'Fechada' | 'Congelada' | 'Cancelada';

export interface FreezeEvent {
  startDate: string; // ISO Date
  endDate?: string; // ISO Date (undefined if currently frozen)
  reason: string;
  requester: string;
}

export interface OpeningDetails {
  reason: 'Aumento de Quadro' | 'Substituição';
  replacedEmployee?: string; // If substitution
  replacementReason?: 'Demissão sem justa causa' | 'Pedido de Demissão' | 'Movimentação Interna' | 'Término de Contrato' | 'Licença Maternidade' | 'Abandono de Emprego';
}

export interface Job {
  id: string;
  title: string;
  sector: string;
  unit: string;
  status: JobStatus;
  openedAt: string; // ISO Date
  closedAt?: string; // ISO Date
  description?: string;
  hiredCandidateIds?: string[];
  
  // Expanded Job Context
  isConfidential?: boolean;
  createdBy?: string; // Owner of the job
  allowedUserIds?: string[]; // ACL: List of users who can see this if confidential
  openingDetails?: OpeningDetails;

  // Freezing/Cancellation Context
  freezeHistory?: FreezeEvent[]; // Track all freeze periods
  frozenAt?: string; // Legacy/Current freeze start
  frozenBy?: string; // Legacy
  cancellationReason?: string; 
  requesterName?: string; 

  // Soft Delete
  isHidden?: boolean; // Legacy flag, kept for compatibility but superseded by deletedAt
  deletedAt?: string; // Timestamp of deletion
  deletedBy?: string; // User ID who performed deletion
}

export type CandidateOrigin = 'LinkedIn' | 'Instagram' | 'SINE' | 'Busca espontânea' | 'Banco de Talentos' | 'Indicação' | 'Recrutamento Interno';

export type CandidateStatus = 'Aguardando Triagem' | 'Em Teste' | 'Entrevista' | 'Aprovado' | 'Reprovado' | 'Proposta Aceita' | 'Proposta Recusada' | 'Desistência' | 'Contratado'; 

export type ContractType = 'CLT' | 'PJ' | 'Estágio' | 'Temporário' | 'Outros';

export interface CandidateTimeline {
  firstContact?: string;
  interview?: string; // Date of interview
  test?: string;
  docsDelivery?: string;
  admissionExam?: string;
  contractSign?: string;
  integration?: string;
  startDate?: string; // Critical for new SLA
}

export interface Candidate {
  id: string;
  jobId: string;
  name: string;
  age: number;
  phone: string;
  email?: string;
  city?: string; // New: Location for quick filtering
  origin: CandidateOrigin;
  status: CandidateStatus;
  rejectionReason?: string;
  timeline?: CandidateTimeline;
  notes?: string; 
  contractType?: ContractType; 
  salaryExpectation?: string; 
  finalSalary?: string; 
  techTest?: boolean; 
  techTestEvaluator?: string; 
  techTestDate?: string; 
  techTestResult?: 'Aprovado' | 'Reprovado'; // New field for Tech Test Result
  createdAt: string;

  // SLA Metrics (New)
  firstContactAt?: string; // Date moved from 'Aguardando' to active
  lastInteractionAt?: string; // Date of last edit/note

  // Audit Trail (New)
  rejectedBy?: string; // Name of user who rejected
  rejectionDate?: string; // Date of rejection
  testApprovalDate?: string; // Date technical test was approved

  // Origin Details
  isReferral?: boolean;
  referralName?: string;
  
  // Ex-Employee
  isExEmployee?: boolean;
  lastRole?: string;
  lastSector?: string;
  lastSalary?: string;

  // Archival
  isArchived?: boolean;
  archiveReason?: string;

  // Soft Delete
  deletedAt?: string;
}

export interface Education {
  institution: string;
  level: string;
  status: string;
  conclusionYear: string;
}

export interface Experience {
  company: string;
  role: string;
  period: string;
  description: string;
}

export type TransportType = 'Consegue vir até a empresa' | 'Precisa de transporte (van)';

export interface TalentProfile {
  id: string;
  name: string;
  age: number;
  contact: string;
  city: string;
  targetRole: string;
  tags: string[];
  education: Education[];
  experience: Experience[];
  createdAt: string;
  salaryExpectation?: string;
  transportation?: TransportType;
  needsReview?: boolean;
  observations?: string[];
  // Soft Delete
  deletedAt?: string;
}

export interface KPI {
  open: number;
  closed: number;
  frozen: number;
  canceled: number;
  totalCandidates: number;
  inTest: number;
  approved: number;
  internalRecruitment: number;
}

// ==========================================
// NOVAS INTERFACES: ABSENTEÍSMO
// ==========================================
export type DocumentType = 'Atestado' | 'Declaração' | 'Acompanhante de Dependente' | 'Falta Injustificada'; // <--- Nova opção adicionada

export interface AbsenceRecord {
  id: string;
  employeeName: string;
  absenceDate: string; 
  documentDuration: string;
  documentType: DocumentType;
  reason: string; // <--- Novo campo obrigatório: Motivo
  companionName?: string;
  companionBond?: string;
  createdAt?: string; 
  deletedAt?: string; 
}
