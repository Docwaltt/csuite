export interface CompanyContext {
  id: string;
  ownerId: string;
  name: string;
  industry: string;
  category: string;
  description: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  companyId: string;
  role: string;
  name: string;
  bio: string;
  expertise: string[];
  avatarUrl: string;
  createdAt: string;
}

export interface Message {
  id: string;
  companyId: string;
  senderId: string; // 'user' or agent.id
  text: string;
  timestamp: number;
}

export interface Task {
  id: string;
  companyId: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

export interface SmartGoal {
  text: string;
  completed: boolean;
}

export interface KPI {
  text: string;
  met: boolean;
}

export interface Goal {
  id: string;
  companyId: string;
  objective: string;
  smartGoals: SmartGoal[] | string[]; // Support legacy string arrays
  kpis: KPI[] | string[]; // Support legacy string arrays
  createdAt: number;
}

export interface AppState {
  company: CompanyContext | null;
  team: Agent[];
  messages: Message[];
}
