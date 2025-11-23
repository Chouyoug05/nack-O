export type TeamRole = 'serveur' | 'caissier' | 'agent-evenement' | 'cuisinier';
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