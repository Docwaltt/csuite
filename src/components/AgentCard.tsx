import React, { useState } from 'react';
import { Agent } from '../types';
import { useCSuite } from '../store';
import { RefreshCw } from 'lucide-react';

export function AgentCard({ agent }: { agent: Agent }) {
  const { updateAgent } = useCSuite();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerateAvatar = async () => {
    setIsRegenerating(true);
    try {
      // Use a new random seed for the avatar
      const newSeed = Math.random().toString(36).substring(7);
      const newAvatarUrl = `https://api.dicebear.com/7.x/micah/svg?seed=${newSeed}`;
      
      await updateAgent(agent.id, { avatarUrl: newAvatarUrl });
    } catch (error) {
      console.error("Failed to regenerate avatar", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="relative group">
          <img
            src={agent.avatarUrl}
            alt={agent.name}
            className="w-16 h-16 rounded-full object-cover border border-zinc-100 bg-zinc-50"
            referrerPolicy="no-referrer"
          />
          <button
            onClick={handleRegenerateAvatar}
            disabled={isRegenerating}
            className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
            title="Regenerate Avatar"
          >
            <RefreshCw className={`w-5 h-5 ${isRegenerating ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-zinc-900">{agent.name}</h3>
          <p className="text-sm font-medium text-indigo-600 mb-2">{agent.role}</p>
          <p className="text-sm text-zinc-600 mb-4 line-clamp-3">{agent.bio}</p>
          
          <div className="flex flex-wrap gap-2">
            {agent.expertise.map((exp, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800"
              >
                {exp}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
