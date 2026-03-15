import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Settings, LogOut, Briefcase, Target } from 'lucide-react';
import { useCSuite } from '../store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { logOut } from '../firebase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Layout() {
  const { company, user } = useCSuite();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logOut();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-6 border-b border-zinc-200 flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white font-bold">
            C
          </div>
          <h1 className="text-xl font-bold tracking-tight">CSuite</h1>
        </div>
        
        <div className="p-4">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">
            {company ? company.name : 'Workspace'}
          </div>
          <nav className="space-y-1">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                )
              }
            >
              <Briefcase className="w-4 h-4" />
              Overview
            </NavLink>
            <NavLink
              to="/goals"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                )
              }
            >
              <Target className="w-4 h-4" />
              Strategic Goals
            </NavLink>
            <NavLink
              to="/team"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                )
              }
            >
              <Users className="w-4 h-4" />
              The Board
            </NavLink>
            <NavLink
              to="/boardroom"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                )
              }
            >
              <MessageSquare className="w-4 h-4" />
              Boardroom
            </NavLink>
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-zinc-200">
          {user && (
            <div className="flex items-center gap-3 px-3 py-3 mb-2">
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} alt="User" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">{user.displayName || 'User'}</p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <nav className="space-y-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Exit Workspace
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-zinc-50/50">
        <Outlet />
      </main>
    </div>
  );
}
