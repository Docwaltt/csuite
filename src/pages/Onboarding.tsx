import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useCSuite } from '../store';
import { generateTeam } from '../services/ai';
import { Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { INDUSTRIES, CATEGORIES } from '../constants';

export function Onboarding() {
  const navigate = useNavigate();
  const { user, setCompany, setTeam } = useCSuite();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    category: '',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please log in first.");
      return;
    }
    setLoading(true);
    
    try {
      const companyId = uuidv4();
      const newCompany = {
        id: companyId,
        ownerId: user.uid,
        ...formData,
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'companies', companyId), newCompany);
      setCompany(newCompany);

      const generatedTeam = await generateTeam(formData.industry, formData.category, formData.name);
      
      const teamWithIds = generatedTeam.map(agent => ({
        ...agent,
        companyId,
        createdAt: new Date().toISOString()
      }));

      for (const agent of teamWithIds) {
        await setDoc(doc(db, `companies/${companyId}/agents`, agent.id), agent);
      }
      
      setTeam(teamWithIds);
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to generate team', error);
      alert('Failed to generate your C-Suite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-zinc-200 p-8 md:p-12"
      >
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-6">
            C
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 mb-3">Initialize Workspace</h1>
          <p className="text-zinc-500">Tell us about your startup to generate your specialized executive team.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-zinc-900 mb-2">Company Name</label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-2">Industry</label>
              <select
                required
                value={formData.industry}
                onChange={e => setFormData({...formData, industry: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
              >
                <option value="">Select an industry</option>
                {INDUSTRIES.map(industry => (
                  <option key={industry} value={industry}>{industry}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-2">Category</label>
              <select
                required
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-900 mb-2">Brief Description</label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
              placeholder="What does your startup do? What are your current challenges?"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-zinc-900 text-white rounded-xl font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-8"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Assembling Team...
              </>
            ) : (
              'Generate C-Suite'
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
