import React, { useState, useRef, useEffect } from 'react';
import { useCSuite } from '../store';
import { ChatMessage } from '../components/ChatMessage';
import { chatWithBoardStream } from '../services/ai';
import { Send, Loader2, Sparkles, Paperclip, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion } from 'motion/react';

export function Boardroom() {
  const { company, team, messages, addMessage } = useCSuite();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Temporary state for streaming messages before they are finalized
  const [streamingMessages, setStreamingMessages] = useState<Record<string, { text: string, timestamp: number }>>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessages, loading]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    // Read file content (basic text/markdown support)
    try {
      const text = await selectedFile.text();
      setFileContent(text);
    } catch (err) {
      console.error("Failed to read file", err);
      alert("Could not read file. Please upload a text-based file (.txt, .md, .csv).");
      setFile(null);
      setFileContent('');
    }
    
    // Reset input
    e.target.value = '';
  };

  const clearFile = () => {
    setFile(null);
    setFileContent('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !fileContent) || !company || loading) return;

    let messageText = input.trim();
    if (fileContent) {
      messageText += `\\n\\n[Attached File: ${file?.name}]\\n\`\`\`\\n${fileContent.substring(0, 10000)}\\n\`\`\``; // Limit to 10k chars for safety
    }

    const userMessage = {
      id: uuidv4(),
      companyId: company.id,
      senderId: 'user',
      text: messageText,
      timestamp: Date.now()
    };

    addMessage(userMessage);
    setInput('');
    clearFile();
    setLoading(true);
    setStreamingMessages({});

    try {
      await chatWithBoardStream(
        company,
        team,
        messages,
        userMessage.text,
        (agentId) => {
          // Agent starts speaking
          setStreamingMessages(prev => ({
            ...prev,
            [agentId]: { text: '', timestamp: Date.now() }
          }));
        },
        (agentId, chunk) => {
          // Agent streams chunk
          setStreamingMessages(prev => {
            const existing = prev[agentId] || { text: '', timestamp: Date.now() };
            return {
              ...prev,
              [agentId]: { 
                ...existing, 
                text: existing.text + chunk 
              }
            };
          });
        },
        (agentId, fullText) => {
          // Agent finishes speaking
          setStreamingMessages(prev => {
            const timestamp = prev[agentId]?.timestamp || Date.now();
            
            // Add to firestore
            if (fullText.trim()) {
              addMessage({
                id: uuidv4(),
                companyId: company.id,
                senderId: agentId,
                text: fullText,
                timestamp: timestamp
              });
            }

            const next = { ...prev };
            delete next[agentId];
            return next;
          });
        }
      );

    } catch (error) {
      console.error('Failed to get board response', error);
      addMessage({
        id: uuidv4(),
        companyId: company.id,
        senderId: 'system',
        text: 'The board encountered an error processing your request.',
        timestamp: Date.now()
      });
    } finally {
      setLoading(false);
    }
  };

  if (!company) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-500">No company data. Please complete onboarding.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 font-sans">
      <header className="bg-white border-b border-zinc-200 p-6 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">The Boardroom</h1>
            <p className="text-sm text-zinc-500">Discuss strategy with your executive team.</p>
          </div>
          <div className="flex -space-x-2">
            {team.slice(0, 5).map(agent => (
              <img
                key={agent.id}
                src={agent.avatarUrl}
                alt={agent.name}
                className="w-10 h-10 rounded-full border-2 border-white object-cover"
                referrerPolicy="no-referrer"
                title={agent.role}
              />
            ))}
            {team.length > 5 && (
              <div className="w-10 h-10 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center text-xs font-medium text-zinc-600">
                +{team.length - 5}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-2">
          {messages.length === 0 && Object.keys(streamingMessages).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-indigo-500" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Welcome to the Boardroom</h2>
              <p className="text-zinc-500 max-w-md">
                Your C-Suite is ready. Ask a question, present a challenge, upload a document, or paste a website link to get started.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ChatMessage 
                    message={msg} 
                    agent={team.find(a => a.id === msg.senderId)} 
                  />
                </motion.div>
              ))}
              
              {/* Render streaming messages */}
              {Object.entries(streamingMessages).map(([agentId, data]) => (
                <motion.div
                  key={`stream-${agentId}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ChatMessage 
                    message={{
                      id: `stream-${agentId}`,
                      companyId: company.id,
                      senderId: agentId,
                      text: data.text || '...',
                      timestamp: data.timestamp
                    }} 
                    agent={team.find(a => a.id === agentId)} 
                  />
                </motion.div>
              ))}
            </>
          )}
          
          {loading && Object.keys(streamingMessages).length === 0 && (
            <div className="flex items-center gap-3 py-4 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">The CEO is deciding who should speak...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white border-t border-zinc-200 p-6 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          {file && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-zinc-100 rounded-lg w-fit">
              <Paperclip className="w-4 h-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-700 truncate max-w-[200px]">{file.name}</span>
              <button onClick={clearFile} className="p-1 hover:bg-zinc-200 rounded-full text-zinc-500">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Address the board or paste a link..."
                disabled={loading}
                className="w-full bg-zinc-50 border border-zinc-300 rounded-full pl-6 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
              />
              <label className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-zinc-600 cursor-pointer transition-colors">
                <input type="file" className="hidden" onChange={handleFileChange} disabled={loading} accept=".txt,.md,.csv,.json" />
                <Paperclip className="w-5 h-5" />
              </label>
            </div>
            <button
              type="submit"
              disabled={(!input.trim() && !fileContent) || loading}
              className="w-12 h-12 flex-shrink-0 bg-zinc-900 text-white rounded-full flex items-center justify-center hover:bg-zinc-800 disabled:opacity-50 disabled:hover:bg-zinc-900 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <p className="text-xs text-center text-zinc-400 mt-3">
            AI executives provide simulated advice. Always verify critical business decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
