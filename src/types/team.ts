export type TeamRole = 
  | 'serveur' 
  | 'caissier' 
  | 'agent-evenement' 
  | 'cuisinier'
  | 'barman'
  | 'vendeur'
  | 'gestionnaire-stock'
  | 'magasinier'
  | 'consultant'
  | 'assistant';

export interface TeamRoleConfig {
  value: TeamRole;
  label: string;
  description: string;
  icon: string;
  applicableTo: string[]; // main categories where this role applies
}
export type TeamStatus = 'active' | 'inactive';

export interface TeamMemberDoc {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  role: TeamRole;
  status: TeamStatus;
  agentCode: string;
  dashboardLink: string;
  lastConnection?: number; // epoch ms
  createdAt: number;
  updatedAt: number;
  agentToken?: string; // secure token used in links instead of code
} 