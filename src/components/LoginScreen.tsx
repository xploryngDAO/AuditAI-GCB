import React, { useState } from 'react';
import { 
  LogIn, 
  Mail, 
  Key, 
  ShieldCheck, 
  Bot, 
  Activity, 
  Award,
  Eye,
  EyeOff,
  Building2,
  Lock,
  CheckCircle2
} from 'lucide-react';

interface LoginScreenProps {
  loginEmail: string;
  setLoginEmail: (val: string) => void;
  loginPassword: string;
  setLoginPassword: (val: string) => void;
  loginError: string | null;
  loginSubmitting: boolean;
  handleLoginSubmit: (e: React.FormEvent) => void;
}

export default function LoginScreen({
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  loginError,
  loginSubmitting,
  handleLoginSubmit
}: LoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false);

  const setCredentials = (email: string, pass: string) => {
    setLoginEmail(email);
    setLoginPassword(pass);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between selection:bg-indigo-600 selection:text-white relative">
      
      {/* Top Header */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 select-none">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            <Bot className="w-4 h-4" />
          </div>
          <span className="text-base font-bold text-slate-900 tracking-tight">
            Audita<span className="text-indigo-600 font-extrabold">QA</span>
          </span>
        </div>
      </header>

      {/* Main Login Card Container */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-4xl bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Left Column: Context & Security Highlights */}
          <div className="lg:col-span-5 bg-gradient-to-br from-indigo-50/50 via-slate-50 to-slate-100/60 p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200/80">
            <div className="space-y-6">
              
              <div className="inline-flex items-center gap-1.5 bg-indigo-100/70 border border-indigo-200/80 text-indigo-800 px-2.5 py-1 rounded-md text-[11px] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Portal Corporativo Seguro</span>
              </div>

              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-snug">
                  Auditoria Cognitiva & Compliance de CX
                </h1>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Ambiente restrito e isolado para monitoria integral de voz e chat, calibração multi-BPO e gestão de scorecards de conformidade.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/80 border border-slate-200/70 shadow-2xs">
                  <Activity className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Auditoria Contínua 100%</span>
                    <span className="text-slate-500 text-[11px]">Transcrição e scoring de todas as interações</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/80 border border-slate-200/70 shadow-2xs">
                  <Building2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Isolamento Multi-BPO</span>
                    <span className="text-slate-500 text-[11px]">Visibilidade e controle calibrado por parceira</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/80 border border-slate-200/70 shadow-2xs">
                  <Award className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Matriz Falha Zera-Nota</span>
                    <span className="text-slate-500 text-[11px]">Detecção automática de riscos críticos e SAC</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="pt-6 mt-6 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
              <span className="font-medium">AuditaQA Enterprise v3.4</span>
              <span className="text-emerald-700 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                Ambiente Ativo
              </span>
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
            
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900">Acesse sua Conta</h2>
              <p className="text-xs text-slate-500 mt-1">
                Insira suas credenciais corporativas para entrar na plataforma
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4" id="loginForm">
              
              <div>
                <label 
                  htmlFor="inputLoginEmail"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  E-mail Corporativo
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="inputLoginEmail"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="nome@empresa.com.br"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label 
                    htmlFor="inputLoginPassword"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Senha de Acesso
                  </label>
                </div>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="inputLoginPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15 rounded-xl py-2.5 pl-10 pr-10 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium leading-relaxed flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>{loginError}</span>
                </div>
              )}

              <button
                id="btnSubmitLogin"
                type="submit"
                disabled={loginSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs py-3 rounded-xl transition-all shadow-xs hover:shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loginSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Entrar na Plataforma</span>
                  </>
                )}
              </button>

            </form>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-4 py-4 text-center text-xs text-slate-400">
        © 2026 AuditaQA. Todos os direitos reservados.
      </footer>

    </div>
  );
}

