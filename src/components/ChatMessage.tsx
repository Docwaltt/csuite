import React from 'react';
import { Message, Agent } from '../types';
import Markdown from 'react-markdown';
import { cn } from './Layout';

interface ChatMessageProps {
  message: Message;
  agent?: Agent;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
}

export function ChatMessage({ message, agent, onReply, onEdit }: ChatMessageProps) {
  const isUser = message.senderId === 'user';

  return (
    <div className={cn("flex w-full gap-4 py-4 group", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex-shrink-0">
          <img
            src={agent?.avatarUrl || "https://picsum.photos/seed/ai/200"}
            alt={agent?.name || "AI"}
            className="w-10 h-10 rounded-full object-cover border border-zinc-200"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      
      <div className={cn(
        "flex flex-col max-w-[80%]",
        isUser ? "items-end" : "items-start"
      )}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold text-zinc-900">
            {isUser ? 'You (Founder)' : agent?.name}
          </span>
          {!isUser && agent && (
            <span className="text-xs font-medium text-indigo-600">
              {agent.role}
            </span>
          )}
          <span className="text-xs text-zinc-400">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        
        <div className={cn(
          "px-5 py-3.5 rounded-2xl shadow-sm relative",
          isUser 
            ? "bg-zinc-900 text-white rounded-tr-sm" 
            : "bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm"
        )}>
          <div className={cn("prose prose-sm max-w-none", isUser ? "prose-invert" : "")}>
            <Markdown>{message.text}</Markdown>
          </div>
          
          <div className={cn(
            "absolute -bottom-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity",
            isUser ? "right-0" : "left-0"
          )}>
            <button onClick={() => onReply?.(message)} className="text-xs text-zinc-400 hover:text-indigo-600">Reply</button>
            {isUser && <button onClick={() => onEdit?.(message)} className="text-xs text-zinc-400 hover:text-indigo-600">Edit</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
