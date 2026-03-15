import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Briefcase, Users, Zap } from 'lucide-react';
import { useCSuite } from '../store';
import { signInWithGoogle } from '../firebase';

export function Landing() {
  const navigate = useNavigate();
  const { user, authReady, company } = useCSuite();

  useEffect(() => {
    if (authReady && user) {
      if (company) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    }
  }, [user, authReady, company, navigate]);

  const handleGetStarted = async () => {
    if (!user) {
      await signInWithGoogle();
    } else {
      navigate('/onboarding');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-zinc-950 font-bold">
            C
          </div>
          <span className="text-xl font-bold tracking-tight">CSuite</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleGetStarted}
            className="px-4 py-2 text-sm font-medium bg-white text-zinc-950 rounded-full hover:bg-zinc-200 transition-colors"
          >
            Get Started
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-32 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-sm font-medium text-zinc-300 mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          AI-Powered Executive Team
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight mb-8 max-w-4xl leading-tight"
        >
          Build your startup with a <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">world-class</span> virtual C-Suite.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-12"
        >
          Generate specialized AI executives with 28 years of experience. Brainstorm, strategize, and execute in your own virtual boardroom.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <button 
            onClick={handleGetStarted}
            className="group flex items-center gap-2 px-8 py-4 text-lg font-medium bg-white text-zinc-950 rounded-full hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95"
          >
            Assemble Your Team
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full"
        >
          <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Tailored Executives</h3>
            <p className="text-zinc-400 leading-relaxed">
              Tell us your industry and category. We'll generate the exact C-Suite roles your startup needs to succeed.
            </p>
          </div>
          <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6">
              <Briefcase className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Deep Expertise</h3>
            <p className="text-zinc-400 leading-relaxed">
              Every agent comes with 28 years of simulated experience, ready to provide actionable, high-level strategic advice.
            </p>
          </div>
          <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold mb-3">The Boardroom</h3>
            <p className="text-zinc-400 leading-relaxed">
              Enter the virtual boardroom to discuss challenges. Watch your team collaborate and proffer solutions in real-time.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
