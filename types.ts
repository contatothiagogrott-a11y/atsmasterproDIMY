// ==========================================
// 1. PERMISSÕES DINÂMICAS E ACESSO (O NOVO MOTOR)
// ==========================================
export type AppModule = 
  | 'COLABORADORES' 
  | 'VAGAS' 
  | 'QUADRO_PESSOAL' 
  | 'ENTREVISTAS_GERAIS'
  | 'EXPERIENCIA_DESLIGAMENTO'
  | 'CONFIGURACOES'
  | 'DASHBOARD'
  | 'REFEITORIO'; // <--- ADICIONADO: Novo módulo do Refeitório

export type PermissionLevel = 
  | 'NONE'       // Não vê nem a página
  | 'VIEW'       // Só visualiza (Read-only)
  | 'EDIT_BASIC' // Cria e edita o básico (Não deleta, não vê campos sigilosos/salário)
  | 'EDIT_FULL'; // Acesso total àquela página (Pode tudo, inclusive deletar)

export interface RoleConfig {
  id: string;
  name: string; // Ex: 'Líder de Vendas', 'Assistente DP'
  description?: string;
  permissions: Record<AppModule, PermissionLevel>;
  isSystemRole?: boolean; // Trava para não deletar os cargos base do sistema
}

// ==========================================
// USUÁRIOS (MANTIDO E EXPANDIDO)
// ==========================================
export type UserRole = 'MASTER' | 'RECRUITER' | 'AUXILIAR_RH' | 'RECEPCAO' | 'GESTOR';

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  // A role agora aceita a string fixa antiga OU um ID dinâmico que vem das configurações
  role: UserRole | string; 
  roleId?: string; // Aponta para a RoleConfig
  createdBy?: string;
}

// ==========================================
// CONFIGURAÇÕES GERAIS
// ==========================================
// ADICIONADO: 'REFEITORIO_PRODUCT' para gerenciar os itens e preços do refeitório
export type SettingType = 'SECTOR' | 'UNIT' | 'SYSTEM_TEMPLATE' | 'RESOURCE' | 'HEADCOUNT_BUDGET' | 'CUSTOM_ROLE' | 'REFEITORIO_PRODUCT';

export interface SettingItem {
  id: string;
  name: string;
  type: SettingType; 
  value?: string; // Usado para guardar Base64 ou JSON (ex: Permissões do Custom Role ou Preço do Produto)
}

// ==========================================
// VAGAS (JOBS)
// ==========================================
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

  // Integração TI
  resources?: string[]; // Ex: ['Notebook', 'E-mail corporativo']
  accessReference?: string; // Ex: "Espelhar acessos do João"

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

// ==========================================
// CANDIDATOS (RECRUTAMENTO)
// ==========================================
export type CandidateOrigin = 'LinkedIn' | 'Instagram' | 'SINE' | 'Busca espontânea' | 'Banco de Talentos' | 'Indicação' | 'Recrutamento Interno';

export type CandidateStatus = 'Aguardando Triagem' | 'Em Teste' | 'Entrevista' | 'Aprovado' | 'Reprovado' | 'Proposta Aceita' | 'Proposta Recusada' | 'Desistência' | 'Contratado'; 

export type CandidateContractType = 'CLT' | 'PJ' | 'Estágio' | 'Temporário' | 'Outros';

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
  city?: string; // Location for quick filtering
  origin: CandidateOrigin;
  status: CandidateStatus;
  rejectionReason?: string;
  timeline?: CandidateTimeline;
  notes?: string; 
  contractType?: CandidateContractType; 
  salaryExpectation?: string; 
  finalSalary?: string; 
  techTest?: boolean; 
  techTestEvaluator?: string; 
  techTestDate?: string; 
  techTestResult?: 'Aprovado' | 'Reprovado'; 
  createdAt: string;

  // Checklist de Integração do DP / TI
  onboarding?: {
    docsRequested?: boolean;
    docsDelivered?: boolean;
    examDate?: string;
    needsLabExam?: boolean;
    labExamDate?: string;
    itTicketCreated?: boolean;
    completed?: boolean; 
  };

  // SLA Metrics
  firstContactAt?: string; 
  lastInteractionAt?: string; 

  // Audit Trail
  rejectedBy?: string; 
  rejectionDate?: string; 
  testApprovalDate?: string; 

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

// ==========================================
// BANCO DE TALENTOS
// ==========================================
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
// ABSENTEÍSMO
// ==========================================
export type DocumentType = 'Atestado' | 'Declaração' | 'Acompanhante de Dependente' | 'Falta Injustificada' | 'Licença Prevista em Lei';

export interface AbsenceRecord {
  id: string;
  employeeName: string;
  absenceDate: string; 
  documentDuration: string; 
  durationUnit?: 'Dias' | 'Horas'; 
  durationAmount?: number;
  documentType: DocumentType;
  reason: string; 
  companionName?: string;
  companionBond?: string;
  createdAt?: string; 
  deletedAt?: string; 
}

// ==========================================
// EXPERIÊNCIA E eNPS
// ==========================================
export type ProbationType = '45+45' | '30+60' | 'Nenhum';

export interface ExperienceInterview {
  id: string;
  interviewDate: string;
  period: '1º Período' | '2º Período' | 'Desligamento';
  employeeRole?: string;
  employeeSector?: string;
  employeeUnit?: string;
  qRecommend?: number; 
  qLeader: number;
  qColleagues: number;
  qTraining: number;
  qJobSatisfaction: number;
  qCompanySatisfaction: number;
  qBenefits: number;
  trainerName: string;
  comments: string;
  interviewerName: string;
}

// ==========================================
// COLABORADORES
// ==========================================
export type EmployeeStatus = 'Ativo' | 'Inativo' | 'Afastado';

export type ContractType = 'CLT' | 'PJ' | 'Estagiário' | 'JA';

export type EmployeeHistoryType = 'Promoção' | 'Mudança de Setor' | 'Afastamento' | 'Desligamento' | 'Outros';

export interface EmployeeHistoryRecord {
  id: string;
  date: string; 
  type: EmployeeHistoryType;
  description: string;
  createdBy?: string; 
}

export interface Employee {
  id: string;
  name: string;
  sector: string;
  unit?: string;
  role: string;
  phone: string;
  birthDate: string;
  admissionDate: string;
  status: EmployeeStatus;
  contractType: ContractType;
  hasPendingInfo?: boolean;
  dailyWorkload?: number; 
  workDays?: number[]; 
  probationType?: ProbationType; 
  experienceInterviews?: ExperienceInterview[];
  exitInterview?: ExitInterview; 
  terminationDate?: string; 
  terminationReason?: string;
  leaveReason?: string;
  leaveExpectedReturn?: string;
  history: EmployeeHistoryRecord[];
  createdAt?: string;
  deletedAt?: string;
}

// ==========================================
// ENTREVISTA DE DESLIGAMENTO
// ==========================================
export interface ExitInterview {
  id: string;
  interviewDate: string;
  reason: string; 
  reasonObservation?: string; 
  colleaguesRating: number; 
  leaderName: string;
  leaderRating: number;
  trainerName: string;
  trainingRating: number;
  growthRating: number;
  salaryRating: number;
  benefitsRating: number;
  jobSatisfactionRating: number;
  additionalComments?: string;
  interviewerName: string;
  didNotRespond?: boolean; 
}

// ==========================================
// CAFÉS E REUNIÕES
// ==========================================
export type MeetingType = 'Reunião' | 'Treinamento' | 'Integração' | 'Coffee Break' | 'Outros';

export interface MeetingEvent {
  id: string;
  title: string;        
  type?: MeetingType;         
  instructor?: string;        
  date: string;         
  time: string;               
  endTime?: string;           
  location: string;     
  requirements: string; 
  participantCount: number; 
  participantIds?: string[];  
  createdAt: string;
}

// ==========================================
// GESTÃO DE REFEITÓRIO (NOVO)
// ==========================================
export interface RefeitorioRecord {
  id: string;
  date: string; // ISO Date YYYY-MM-DD
  quantities: Record<string, number>; // Objeto chave-valor onde a chave é o ID do produto e o valor é a quantidade
  createdAt?: string;
  updatedAt?: string;
}