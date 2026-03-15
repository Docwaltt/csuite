import React from 'react';
import { useCSuite } from '../store';
import { AgentCard } from '../components/AgentCard';
import { motion } from 'motion/react';

export function Team() {
  const { team } = useCSuite();

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">The Board</h1>
          <p className="text-zinc-500">Your specialized executive team with 28 years of experience.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {team.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <AgentCard agent={agent} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
