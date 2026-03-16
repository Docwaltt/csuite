import React, { useState } from 'react';
import { useCSuite } from '../store';
import { motion } from 'motion/react';
import { Building2, Users, Target, ArrowRight, Pencil, Check, X, Plus, Trash2, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

export function Dashboard() {
  const { company, companyLoading, team, updateCompany, tasks, addTask, updateTask, deleteTask } = useCSuite();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  if (companyLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-500">No company data. Please complete onboarding.</p>
      </div>
    );
  }

  const handleEditClick = () => {
    setEditDescription(company.description);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditDescription('');
  };

  const handleSaveEdit = async () => {
    if (!editDescription.trim() || editDescription === company.description) {
      setIsEditing(false);
      return;
    }
    
    setIsSaving(true);
    try {
      await updateCompany({ description: editDescription.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update description", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    setIsAddingTask(true);
    try {
      await addTask({
        id: uuidv4(),
        companyId: company.id,
        title: newTaskTitle.trim(),
        completed: false,
        createdAt: Date.now()
      });
      setNewTaskTitle('');
    } catch (error) {
      console.error("Failed to add task", error);
    } finally {
      setIsAddingTask(false);
    }
  };

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      await updateTask(taskId, { completed: !currentStatus });
    } catch (error) {
      console.error("Failed to toggle task", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error("Failed to delete task", error);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">Workspace Overview</h1>
          <p className="text-zinc-500">Manage your virtual C-Suite and business strategy.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm"
          >
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Company</h3>
            <p className="text-xl font-bold text-zinc-900">{company.name}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm"
          >
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
              <Target className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Industry</h3>
            <p className="text-xl font-bold text-zinc-900">{company.industry} &middot; {company.category}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm"
          >
            <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-cyan-600" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Board Size</h3>
            <p className="text-xl font-bold text-zinc-900">{team.length} Executives</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-zinc-900">Company Description</h2>
              {!isEditing && (
                <button 
                  onClick={handleEditClick}
                  className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                  title="Edit Description"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {isEditing ? (
              <div className="flex flex-col flex-1">
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={isSaving}
                  className="w-full flex-1 min-h-[150px] p-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-zinc-700 bg-zinc-50"
                  placeholder="Describe your company..."
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-full hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-zinc-600 leading-relaxed whitespace-pre-wrap">{company.description}</p>
            )}
          </div>

          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 shadow-sm text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-4">Enter the Boardroom</h2>
              <p className="text-zinc-400 mb-8 max-w-sm">
                Your executive team is waiting. Start a discussion, present a challenge, or ask for strategic advice.
              </p>
            </div>
            <button 
              onClick={() => navigate('/boardroom')}
              className="relative z-10 w-fit flex items-center gap-2 bg-white text-zinc-900 px-6 py-3 rounded-full font-semibold hover:bg-zinc-100 transition-colors"
            >
              Start Meeting
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-zinc-900">Action Items</h2>
            <span className="text-sm font-medium text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">
              {tasks.filter(t => !t.completed).length} pending
            </span>
          </div>
          
          <form onSubmit={handleAddTask} className="flex gap-2 mb-6">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a new action item..."
              disabled={isAddingTask}
              className="flex-1 bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!newTaskTitle.trim() || isAddingTask}
              className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add
            </button>
          </form>

          <div className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">No action items yet. Add one above to get started.</p>
            ) : (
              tasks.map(task => (
                <div 
                  key={task.id} 
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                    task.completed ? 'bg-zinc-50 border-zinc-200' : 'bg-white border-zinc-200 hover:border-indigo-300'
                  }`}
                >
                  <button 
                    onClick={() => toggleTask(task.id, task.completed)}
                    className={`flex-shrink-0 transition-colors ${task.completed ? 'text-emerald-500' : 'text-zinc-400 hover:text-indigo-600'}`}
                  >
                    {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                  </button>
                  <span className={`flex-1 ${task.completed ? 'text-zinc-400 line-through' : 'text-zinc-700 font-medium'}`}>
                    {task.title}
                  </span>
                  <button 
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
