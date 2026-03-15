import React, { useState } from 'react';
import { useCSuite } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Plus, Trash2, Loader2, BarChart, CheckCircle2, Circle, Trophy } from 'lucide-react';
import { generateGoals } from '../services/ai';
import { v4 as uuidv4 } from 'uuid';
import { SmartGoal, KPI } from '../types';

export function Goals() {
  const { company, goals, addGoal, updateGoal, deleteGoal } = useCSuite();
  const [objective, setObjective] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [celebration, setCelebration] = useState<{ id: string, message: string } | null>(null);

  if (!company) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-500">No company data. Please complete onboarding.</p>
      </div>
    );
  }

  const showCelebration = (message: string) => {
    const id = uuidv4();
    setCelebration({ id, message });
    setTimeout(() => {
      setCelebration(current => current?.id === id ? null : current);
    }, 3000);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const { smartGoals, kpis } = await generateGoals(objective.trim(), company);
      
      if (smartGoals.length > 0 || kpis.length > 0) {
        await addGoal({
          id: uuidv4(),
          companyId: company.id,
          objective: objective.trim(),
          smartGoals: smartGoals.map(sg => ({ text: sg, completed: false })),
          kpis: kpis.map(kpi => ({ text: kpi, met: false })),
          createdAt: Date.now()
        });
        setObjective('');
      }
    } catch (error) {
      console.error("Failed to generate goals", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSmartGoal = async (goalId: string, index: number, currentStatus: boolean) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    const newSmartGoals = [...goal.smartGoals];
    const item = newSmartGoals[index];
    
    if (typeof item === 'string') {
      newSmartGoals[index] = { text: item, completed: !currentStatus };
    } else {
      newSmartGoals[index] = { ...item, completed: !currentStatus };
    }
    
    await updateGoal(goalId, { smartGoals: newSmartGoals });
    if (!currentStatus) showCelebration("SMART Goal Completed! Great job!");
  };

  const toggleKPI = async (goalId: string, index: number, currentStatus: boolean) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    const newKpis = [...goal.kpis];
    const item = newKpis[index];
    
    if (typeof item === 'string') {
      newKpis[index] = { text: item, met: !currentStatus };
    } else {
      newKpis[index] = { ...item, met: !currentStatus };
    }
    
    await updateGoal(goalId, { kpis: newKpis });
    if (!currentStatus) showCelebration("KPI Met! Excellent progress!");
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans relative">
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 font-medium"
          >
            <Trophy className="w-5 h-5 text-emerald-200" />
            {celebration.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">Strategic Goals</h1>
          <p className="text-zinc-500">Define business objectives and let AI suggest SMART goals and KPIs.</p>
        </header>

        <div className="bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm mb-10">
          <h2 className="text-xl font-bold text-zinc-900 mb-4">Set a New Objective</h2>
          <form onSubmit={handleGenerate} className="flex flex-col gap-4">
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={isGenerating}
              placeholder="e.g., Expand our market share in Europe by 15% over the next year..."
              className="w-full min-h-[100px] p-4 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-zinc-700 bg-zinc-50 disabled:opacity-50"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!objective.trim() || isGenerating}
                className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Strategy...
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4" />
                    Generate SMART Goals & KPIs
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-8">
          {goals.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200 border-dashed">
              <Target className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-900 mb-1">No goals set yet</h3>
              <p className="text-zinc-500">Enter an objective above to generate your first strategic plan.</p>
            </div>
          ) : (
            goals.map((goal, i) => (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-zinc-200 bg-zinc-50 flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-2">Objective</h3>
                    <p className="text-lg font-medium text-zinc-900">{goal.objective}</p>
                  </div>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title="Delete Goal"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="w-5 h-5 text-emerald-600" />
                      <h4 className="text-md font-bold text-zinc-900">SMART Goals</h4>
                    </div>
                    <ul className="space-y-3">
                      {goal.smartGoals.map((sg, idx) => {
                        const text = typeof sg === 'string' ? sg : sg.text;
                        const completed = typeof sg === 'string' ? false : sg.completed;
                        return (
                          <li key={idx} className="flex items-start gap-3 group">
                            <button 
                              onClick={() => toggleSmartGoal(goal.id, idx, completed)}
                              className={`flex-shrink-0 transition-colors mt-0.5 ${completed ? 'text-emerald-500' : 'text-zinc-300 hover:text-emerald-500'}`}
                            >
                              {completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                            </button>
                            <span className={`text-sm leading-relaxed transition-colors ${completed ? 'text-zinc-400 line-through' : 'text-zinc-700'}`}>
                              {text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart className="w-5 h-5 text-indigo-600" />
                      <h4 className="text-md font-bold text-zinc-900">Key Performance Indicators</h4>
                    </div>
                    <ul className="space-y-3">
                      {goal.kpis.map((kpi, idx) => {
                        const text = typeof kpi === 'string' ? kpi : kpi.text;
                        const met = typeof kpi === 'string' ? false : kpi.met;
                        return (
                          <li key={idx} className="flex items-start gap-3 group">
                            <button 
                              onClick={() => toggleKPI(goal.id, idx, met)}
                              className={`flex-shrink-0 transition-colors mt-0.5 ${met ? 'text-indigo-500' : 'text-zinc-300 hover:text-indigo-500'}`}
                            >
                              {met ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                            </button>
                            <span className={`text-sm leading-relaxed transition-colors ${met ? 'text-zinc-400 line-through' : 'text-zinc-700'}`}>
                              {text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
