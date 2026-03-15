import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Agent, CompanyContext, Message, Task, Goal } from './types';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';

interface CSuiteContextType {
  user: User | null;
  authReady: boolean;
  company: CompanyContext | null;
  setCompany: (company: CompanyContext | null) => void;
  updateCompany: (updates: Partial<CompanyContext>) => Promise<void>;
  team: Agent[];
  setTeam: (team: Agent[]) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => Promise<void>;
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  tasks: Task[];
  addTask: (task: Task) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  goals: Goal[];
  addGoal: (goal: Goal) => Promise<void>;
  updateGoal: (goalId: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
}

const CSuiteContext = createContext<CSuiteContextType | undefined>(undefined);

export function CSuiteProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [company, setCompany] = useState<CompanyContext | null>(null);
  const [team, setTeam] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setCompany(null);
        setTeam([]);
        setMessages([]);
        setTasks([]);
        setGoals([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !authReady) return;

    // Fetch the user's latest company
    const q = query(collection(db, 'companies'), where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const companyData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CompanyContext;
        setCompany(companyData);
      } else {
        setCompany(null);
      }
    });

    return () => unsubscribe();
  }, [user, authReady]);

  useEffect(() => {
    if (!company?.id) return;

    // Fetch team
    const teamQ = query(collection(db, `companies/${company.id}/agents`));
    const unsubTeam = onSnapshot(teamQ, (snapshot) => {
      const agents = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Agent));
      setTeam(agents);
    });

    // Fetch messages
    const msgQ = query(collection(db, `companies/${company.id}/messages`), orderBy('timestamp', 'asc'));
    const unsubMsg = onSnapshot(msgQ, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
    });

    // Fetch tasks
    const taskQ = query(collection(db, `companies/${company.id}/tasks`), orderBy('createdAt', 'desc'));
    const unsubTask = onSnapshot(taskQ, (snapshot) => {
      const tsks = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setTasks(tsks);
    });

    // Fetch goals
    const goalQ = query(collection(db, `companies/${company.id}/goals`), orderBy('createdAt', 'desc'));
    const unsubGoal = onSnapshot(goalQ, (snapshot) => {
      const gls = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Goal));
      setGoals(gls);
    });

    return () => {
      unsubTeam();
      unsubMsg();
      unsubTask();
      unsubGoal();
    };
  }, [company?.id]);

  const addMessage = async (message: Message) => {
    if (!company?.id) return;
    try {
      await setDoc(doc(db, `companies/${company.id}/messages`, message.id), message);
    } catch (error) {
      console.error("Error adding message:", error);
    }
  };

  const clearMessages = () => {
    // In a real app, you might want to delete them from Firestore or just clear local state.
    // For now, we'll just keep them in Firestore and not delete.
  };

  const updateCompany = async (updates: Partial<CompanyContext>) => {
    if (!company?.id) return;
    try {
      await updateDoc(doc(db, 'companies', company.id), updates);
    } catch (error) {
      console.error("Error updating company:", error);
      throw error;
    }
  };

  const updateAgent = async (agentId: string, updates: Partial<Agent>) => {
    if (!company?.id) return;
    try {
      await updateDoc(doc(db, `companies/${company.id}/agents`, agentId), updates);
    } catch (error) {
      console.error("Error updating agent:", error);
      throw error;
    }
  };

  const addTask = async (task: Task) => {
    if (!company?.id) return;
    try {
      await setDoc(doc(db, `companies/${company.id}/tasks`, task.id), task);
    } catch (error) {
      console.error("Error adding task:", error);
      throw error;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    if (!company?.id) return;
    try {
      await updateDoc(doc(db, `companies/${company.id}/tasks`, taskId), updates);
    } catch (error) {
      console.error("Error updating task:", error);
      throw error;
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!company?.id) return;
    try {
      await deleteDoc(doc(db, `companies/${company.id}/tasks`, taskId));
    } catch (error) {
      console.error("Error deleting task:", error);
      throw error;
    }
  };

  const addGoal = async (goal: Goal) => {
    if (!company?.id) return;
    try {
      await setDoc(doc(db, `companies/${company.id}/goals`, goal.id), goal);
    } catch (error) {
      console.error("Error adding goal:", error);
      throw error;
    }
  };

  const updateGoal = async (goalId: string, updates: Partial<Goal>) => {
    if (!company?.id) return;
    try {
      await updateDoc(doc(db, `companies/${company.id}/goals`, goalId), updates);
    } catch (error) {
      console.error("Error updating goal:", error);
      throw error;
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!company?.id) return;
    try {
      await deleteDoc(doc(db, `companies/${company.id}/goals`, goalId));
    } catch (error) {
      console.error("Error deleting goal:", error);
      throw error;
    }
  };

  return (
    <CSuiteContext.Provider value={{ 
      user, authReady, company, setCompany, updateCompany, 
      team, setTeam, updateAgent, 
      messages, addMessage, clearMessages,
      tasks, addTask, updateTask, deleteTask,
      goals, addGoal, updateGoal, deleteGoal
    }}>
      {children}
    </CSuiteContext.Provider>
  );
}

export function useCSuite() {
  const context = useContext(CSuiteContext);
  if (context === undefined) {
    throw new Error('useCSuite must be used within a CSuiteProvider');
  }
  return context;
}

