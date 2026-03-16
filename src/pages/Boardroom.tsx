import React, { useState, useRef, useEffect } from 'react';
import { useCSuite } from '../store';
import { ChatMessage } from '../components/ChatMessage';
import { chatWithBoardStream } from '../services/ai';
import { Send, Loader2, Sparkles, Paperclip, X, Mic, MicOff, Volume2, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { Message } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { cn } from '../components/Layout';

export function Boardroom() {
  const { company, team, messages, addMessage, updateMessage } = useCSuite();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isConnected, isRecording, error: voiceError, connect, disconnect } = useGeminiLive({
    company: company!,
    team,
  });

  const toggleVoiceMode = () => {
    if (voiceMode) {
      disconnect();
      setVoiceMode(false);
    } else {
      setVoiceMode(true);
      connect();
    }
  };

  useEffect(() => {
    if (editingMessage) {
      setInput(editingMessage.text);
    }
  }, [editingMessage]);

  const [showTagMenu, setShowTagMenu] = useState(false);

  useEffect(() => {
    if (input.endsWith('@')) {
      setShowTagMenu(true);
    } else if (showTagMenu && !input.includes('@')) {
      setShowTagMenu(false);
    }
  }, [input, showTagMenu]);

  const tagAgent = (agentName: string) => {
    setInput(prev => prev.replace(/@$/, '') + `@${agentName} `);
    setShowTagMenu(false);
  };

  const cancelAction = () => {
    setReplyingTo(null);
    setEditingMessage(null);
    setInput('');
    setShowTagMenu(false);
  };

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
      messageText += `\n\n[Attached File: ${file?.name}]\n\`\`\`\n${fileContent.substring(0, 10000)}\n\`\`\``;
    }

    if (editingMessage) {
      await updateMessage(editingMessage.id, { text: messageText });
      cancelAction();
      return;
    }

    const userMessage = {
      id: uuidv4(),
      companyId: company.id,
      senderId: 'user',
      text: replyingTo ? `Replying to: "${replyingTo.text.substring(0, 50)}..."\n\n${messageText}` : messageText,
      timestamp: Date.now()
    };

    addMessage(userMessage);
    cancelAction();
    setLoading(true);
    setStreamingMessages({});

    try {
      await chatWithBoardStream(
        company,
        team,
        messages,
        userMessage.text,
        (agentId) => {
          setStreamingMessages(prev => ({
            ...prev,
            [agentId]: { text: '', timestamp: Date.now() }
          }));
        },
        (agentId, chunk) => {
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
          setStreamingMessages(prev => {
            const timestamp = prev[agentId]?.timestamp || Date.now();
            
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
          <div className="flex items-center gap-4">
            <button
              onClick={toggleVoiceMode}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm border",
                voiceMode 
                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" 
                  : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
              )}
            >
              {voiceMode ? (
                <>
                  <MicOff className="w-4 h-4" />
                  Exit Voice Mode
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Start Voice Discussion
                </>
              )}
            </button>
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
      </div>
    </header>

      <div className="flex-1 overflow-y-auto p-6 relative">
        <AnimatePresence>
          {voiceMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-30 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="max-w-md w-full">
                <div className="relative mb-12">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-32 h-32 bg-indigo-100 rounded-full flex items-center justify-center mx-auto"
                  >
                    <div className="w-24 h-24 bg-indigo-500 rounded-full flex items-center justify-center text-white">
                      {isConnected ? <Volume2 className="w-12 h-12" /> : <Loader2 className="w-12 h-12 animate-spin" />}
                    </div>
                  </motion.div>
                  {isConnected && (
                    <motion.div
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="absolute -top-4 -right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider"
                    >
                      Live
                    </motion.div>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-zinc-900 mb-4">
                  {isConnected ? "Voice Discussion Active" : "Connecting to Boardroom..."}
                </h2>
                <p className="text-zinc-600 mb-8">
                  {isConnected 
                    ? "The board is listening. You can speak naturally and interrupt at any time." 
                    : "Preparing the executive team for a voice session."}
                </p>

                {voiceError && (
                  <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl mb-8 text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p>{voiceError}</p>
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-4">
                  {team.map(agent => (
                    <div key={agent.id} className="flex flex-col items-center gap-2">
                      <img 
                        src={agent.avatarUrl} 
                        alt={agent.name} 
                        className={cn(
                          "w-12 h-12 rounded-full border-2 transition-all",
                          isConnected ? "border-indigo-500" : "border-zinc-200 grayscale"
                        )}
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[10px] font-medium text-zinc-500">{agent.role.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={toggleVoiceMode}
                  className="mt-12 px-8 py-3 bg-zinc-900 text-white rounded-full font-medium hover:bg-zinc-800 transition-colors"
                >
                  End Voice Session
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                    onReply={setReplyingTo}
                    onEdit={setEditingMessage}
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
                    onReply={setReplyingTo}
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
          {(file || replyingTo || editingMessage) && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-zinc-100 rounded-lg w-fit">
              {file && <Paperclip className="w-4 h-4 text-zinc-500" />}
              {replyingTo && <span className="text-xs font-semibold text-indigo-600">Replying to: {replyingTo.text.substring(0, 20)}...</span>}
              {editingMessage && <span className="text-xs font-semibold text-amber-600">Editing message...</span>}
              <button onClick={cancelAction} className="p-1 hover:bg-zinc-200 rounded-full text-zinc-500">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            {showTagMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-white border border-zinc-200 rounded-lg shadow-lg p-2 z-50">
                {team.map(agent => (
                  <button type="button" key={agent.id} onClick={() => tagAgent(agent.name)} className="block w-full text-left px-3 py-2 hover:bg-zinc-100 rounded text-sm">
                    @{agent.name}
                  </button>
                ))}
              </div>
            )}
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
