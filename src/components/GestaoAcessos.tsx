import React, { useState, useEffect } from 'react';
import { UserSession } from '../types';
import { GLOBAL_SCOPE_LABEL, GLOBAL_TENANT_ID, isSuperadminRole } from '../utils/userScope';
import { 
  Users, 
  UserPlus, 
  UserX, 
  Key, 
  Lock, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  ShieldCheck, 
  Building2, 
  Edit2, 
  Search, 
  RefreshCw,
  UserCheck,
  Shield,
  Briefcase,
  Globe
} from 'lucide-react';

interface TenantItem {
  id: string;
  name: string;
  isSubtenant?: boolean;
  bpoName?: string;
  parentId?: string | null;
}

interface UserItem {
  email: string;
  role: string;
  bpoName: string | null;
  tenantId?: string;
  tenantName?: string;
}

interface GestaoAcessosProps {
  bpos: string[];
  session: UserSession;
}

export default function GestaoAcessos({ bpos, session }: GestaoAcessosProps) {
  const isAdmin = session.role === 'admin' || session.role === 'superadmin' || session.userEmail === 'master@admin.com';
  const isMasterAdmin = session.userEmail === 'master@admin.com' || session.role === 'superadmin';

  // --- Users management states ---
  const [users, setUsers] = useState<UserItem[]>([]);
  const [tenantsList, setTenantsList] = useState<TenantItem[]>([]);
  
  // Filters & Search
  const [searchEmail, setSearchEmail] = useState("");
  const [filterTenant, setFilterTenant] = useState("all");
  const [filterRole, setFilterRole] = useState("all");

  // New User Form
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<'superadmin' | 'admin' | 'bpo'>('bpo');
  const [newUserTenantId, setNewUserTenantId] = useState("system-global");
  const [newUserBpo, setNewUserBpo] = useState("");
  const [userSaving, setUserSaving] = useState(false);
  const [userErrorMsg, setUserErrorMsg] = useState<string | null>(null);
  const [userSuccessMsg, setUserSuccessMsg] = useState<string | null>(null);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editRole, setEditRole] = useState<string>("bpo");
  const [editTenantId, setEditTenantId] = useState<string>("system-global");
  const [editBpoName, setEditBpoName] = useState<string>("");
  const [editPassword, setEditPassword] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);

  // --- Modal emulation for iframe compatibility ---
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const fetchTenantsList = async () => {
    try {
      const res = await fetch(`/api/tenants?userEmail=${encodeURIComponent(session.userEmail || 'master@admin.com')}&role=${session.role}`);
      if (res.ok) {
        const data = await res.json();
        setTenantsList(data.tenants || []);
      }
    } catch (err) {
      console.error("Erro ao buscar lista de tenants:", err);
    }
  };

  const fetchUsersList = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Erro ao buscar lista de usuários", err);
    }
  };

  useEffect(() => {
    fetchUsersList();
    fetchTenantsList();
  }, [session]);

  useEffect(() => {
    if (bpos.length > 0 && !newUserBpo) {
      setNewUserBpo(bpos[0]);
    }
  }, [bpos]);

  // Mantém um tenant válido no cadastro quando o perfil não é global: o select
  // não lista o sentinela "Sistema Global" (SaaS Master é o único global).
  useEffect(() => {
    if (isSuperadminRole(newUserRole)) return;
    if (tenantsList.length === 0) return;
    if (!tenantsList.some(t => t.id === newUserTenantId)) {
      setNewUserTenantId(tenantsList[0].id);
    }
  }, [tenantsList, newUserRole, newUserTenantId]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setUserErrorMsg(null);
    setUserSuccessMsg(null);

    const email = newUserEmail.trim();
    const password = newUserPassword;
    if (!email || !password) {
      setUserErrorMsg("E-mail e senha são obrigatórios.");
      return;
    }

    setUserSaving(true);
    try {
      const bpoVal = newUserRole === 'bpo' ? (newUserBpo || bpos[0] || 'BPO Alpha') : null;
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          role: newUserRole,
          bpoName: bpoVal,
          tenantId: isSuperadminRole(newUserRole) ? GLOBAL_TENANT_ID : newUserTenantId
        })
      });

      const data = await res.json();
      if (res.ok) {
        setUserSuccessMsg("Usuário cadastrado com sucesso!");
        setNewUserEmail("");
        setNewUserPassword("");
        fetchUsersList();
        setTimeout(() => setUserSuccessMsg(null), 4000);
      } else {
        setUserErrorMsg(data.error || "Erro ao cadastrar usuário.");
      }
    } catch (err: any) {
      setUserErrorMsg(err.message || "Erro de conexão ao salvar usuário.");
    } finally {
      setUserSaving(false);
    }
  };

  const handleOpenEditUser = (u: UserItem) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditTenantId(
      isSuperadminRole(u.role)
        ? GLOBAL_TENANT_ID
        : (u.tenantId || tenantsList[0]?.id || GLOBAL_TENANT_ID)
    );
    setEditBpoName(u.bpoName || bpos[0] || '');
    setEditPassword("");
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSaving(true);

    try {
      const bpoVal = editRole === 'bpo' ? (editBpoName || bpos[0] || 'BPO Alpha') : null;
      const payload: any = {
        email: editingUser.email,
        role: editRole,
        tenantId: isSuperadminRole(editRole) ? GLOBAL_TENANT_ID : editTenantId,
        bpoName: bpoVal
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      const res = await fetch(`/api/users/${encodeURIComponent(payload.email)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setEditingUser(null);
        fetchUsersList();
      } else {
        setAlertModal({
          title: "Erro ao Salvar",
          message: data.error || "Não foi possível atualizar o usuário."
        });
      }
    } catch (err: any) {
      setAlertModal({
        title: "Erro de Conexão",
        message: err.message || "Falha de rede ao editar usuário."
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteUser = (email: string) => {
    if (email === "master@admin.com") {
      setAlertModal({
        title: "Operação Não Permitida",
        message: "O usuário Master Admin não pode ser removido do sistema."
      });
      return;
    }

    setConfirmModal({
      title: "Confirmar Exclusão de Acesso",
      message: `Tem certeza que deseja revogar definitivamente o acesso de [${email}]?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${encodeURIComponent(email)}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (res.ok) {
            fetchUsersList();
          } else {
            setAlertModal({
              title: "Erro ao Excluir",
              message: data.error || "Não foi possível remover o usuário."
            });
          }
        } catch (err: any) {
          setAlertModal({
            title: "Erro de Conexão",
            message: err.message || "Falha ao excluir usuário."
          });
        }
        setConfirmModal(null);
      }
    });
  };

  // Filtered Users
  const filteredUsers = users.filter(u => {
    if (searchEmail.trim() && !u.email.toLowerCase().includes(searchEmail.trim().toLowerCase())) {
      return false;
    }
    if (filterTenant !== 'all') {
      const scope = isSuperadminRole(u.role) ? GLOBAL_TENANT_ID : (u.tenantId || GLOBAL_TENANT_ID);
      if (scope !== filterTenant) {
        return false;
      }
    }
    if (filterRole !== 'all' && u.role !== filterRole) {
      return false;
    }
    return true;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ShieldCheck className="w-3 h-3 text-purple-600" />
            SaaS Master
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Shield className="w-3 h-3 text-indigo-600" />
            Tenant Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Briefcase className="w-3 h-3 text-amber-600" />
            Operador BPO
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in" id="gestaoAcessosRoot">
      
      {/* CABEÇALHO CLEAN */}
      <div className="sticky top-14 lg:top-0 z-30 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {isMasterAdmin ? "Gestão de Acessos & Governança de Contas" : "Gestão de Usuários e Permissões"}
              </h2>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold">
                {users.length} Contas Ativas
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMasterAdmin 
                ? "Controle de identidades, níveis de permissão (SaaS Master, Tenant Admin, Operador BPO) e isolamento estrito de dados."
                : "Administração de contas com isolamento de visibilidade por BPO e permissões operacionais."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchUsersList}
          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-end sm:self-center"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Atualizar Lista</span>
        </button>
      </div>

      {!isAdmin && (
        <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center flex flex-col items-center justify-center min-h-[260px] space-y-2">
          <Lock className="w-8 h-8 text-amber-500" />
          <h4 className="text-sm font-bold text-slate-800">Acesso Restrito</h4>
          <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
            Apenas administradores de Tenant ou SaaS Master possuem permissão para gerenciar contas de acesso.
          </p>
        </div>
      )}

      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* FORMULÁRIO DE CADASTRO (COLUNA ESQUERDA) */}
          <div className="lg:col-span-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Novo Usuário
                </h3>
              </div>

              <form onSubmit={handleAddUser} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    E-mail de Login
                  </label>
                  <input 
                    type="email" 
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="usuario@empresa.com.br"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Senha Provisória
                  </label>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input 
                      type="password" 
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Perfil de Acesso
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as 'superadmin' | 'admin' | 'bpo';
                      setNewUserRole(nextRole);
                      if (isSuperadminRole(nextRole)) {
                        setNewUserTenantId(GLOBAL_TENANT_ID);
                      } else if (!tenantsList.some(t => t.id === newUserTenantId)) {
                        setNewUserTenantId(tenantsList[0]?.id || GLOBAL_TENANT_ID);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="bpo">Operador BPO (Dados restritos ao parceiro)</option>
                    <option value="admin">Tenant Admin (Visão total da Tenant)</option>
                    {isMasterAdmin && <option value="superadmin">SaaS Master (Acesso Global)</option>}
                  </select>
                </div>

                {isSuperadminRole(newUserRole) ? (
                  <div className="p-3 bg-purple-50 border border-purple-200 text-purple-800 text-[11px] rounded-xl font-medium flex items-start gap-2 animate-fade-in">
                    <Globe className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>SaaS Master é global:</strong> enxerga todas as tenants e não fica vinculado a nenhuma.
                    </span>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Tenant de Vinculação
                    </label>
                    <select
                      value={newUserTenantId}
                      onChange={(e) => setNewUserTenantId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                    >
                      {tenantsList.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.isSubtenant ? `(Sub-tenant ${t.bpoName})` : ''}
                        </option>
                      ))}
                      {tenantsList.length === 0 && (
                        <option value="">Nenhum tenant cadastrado</option>
                      )}
                    </select>
                  </div>
                )}

                {newUserRole === 'bpo' && (
                  <div className="animate-fade-in">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Parceiro BPO Vinculado
                    </label>
                    <select
                      value={newUserBpo}
                      onChange={(e) => setNewUserBpo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                    >
                      {bpos.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}

                {userErrorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{userErrorMsg}</span>
                  </div>
                )}

                {userSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-center gap-2 animate-fade-in">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{userSuccessMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={userSaving || !newUserEmail.trim() || !newUserPassword}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{userSaving ? "Cadastrando..." : "Criar Usuário"}</span>
                </button>
              </form>
            </div>
          </div>

          {/* LISTAGEM & FILTROS DE USUÁRIOS (COLUNA DIREITA) */}
          <div className="lg:col-span-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              
              {/* FILTROS & BUSCA */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="Buscar por e-mail..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={filterTenant}
                    onChange={(e) => setFilterTenant(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todas as Tenants</option>
                    <option value={GLOBAL_TENANT_ID}>{GLOBAL_SCOPE_LABEL}</option>
                    {tenantsList.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todos os Perfis</option>
                    <option value="superadmin">SaaS Master</option>
                    <option value="admin">Tenant Admin</option>
                    <option value="bpo">Operador BPO</option>
                  </select>
                </div>
              </div>

              {/* LISTA DE USUÁRIOS */}
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredUsers.map(u => (
                  <div 
                    key={u.email}
                    className="p-3.5 bg-slate-50/70 border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0 shadow-2xs">
                        {u.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{u.email}</span>
                          {getRoleBadge(u.role)}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            {isSuperadminRole(u.role) ? (
                              <Globe className="w-3 h-3 text-purple-500" />
                            ) : (
                              <Building2 className="w-3 h-3 text-slate-400" />
                            )}
                            {isSuperadminRole(u.role) ? GLOBAL_SCOPE_LABEL : (u.tenantName || u.tenantId || '—')}
                          </span>
                          {u.bpoName && (
                            <span className="px-1.5 py-0.2 bg-slate-200/70 rounded text-slate-700 font-medium">
                              BPO: {u.bpoName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditUser(u)}
                        className="px-2.5 py-1.5 text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer transition-colors text-xs font-bold flex items-center gap-1"
                        title="Editar Perfil"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>

                      {u.email !== "master@admin.com" && u.email !== "master@casasbahia.com" ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.email)}
                          className="px-2.5 py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg cursor-pointer transition-colors text-xs font-bold flex items-center gap-1"
                          title="Revogar Acesso"
                        >
                          <UserX className="w-3 h-3" />
                          <span>Excluir</span>
                        </button>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold">
                          Dono SaaS
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {filteredUsers.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs rounded-xl bg-slate-50 border border-dashed border-slate-200">
                    Nenhum usuário encontrado para os filtros selecionados.
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      )}

      {/* MODAL DE EDIÇÃO DE USUÁRIO */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-5 text-left space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Editar Atribuições
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 truncate max-w-[200px]">
                {editingUser.email}
              </span>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Perfil de Acesso
                </label>
                <select
                  value={editRole}
                  onChange={(e) => {
                    const nextRole = e.target.value;
                    setEditRole(nextRole);
                    if (isSuperadminRole(nextRole)) {
                      setEditTenantId(GLOBAL_TENANT_ID);
                    } else if (!tenantsList.some(t => t.id === editTenantId)) {
                      setEditTenantId(tenantsList[0]?.id || GLOBAL_TENANT_ID);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="bpo">Operador BPO (Restrito a dados do BPO)</option>
                  <option value="admin">Tenant Admin (Visão total da Tenant)</option>
                  {isMasterAdmin && <option value="superadmin">SaaS Master (Global)</option>}
                </select>
              </div>

              {isSuperadminRole(editRole) ? (
                <div className="p-3 bg-purple-50 border border-purple-200 text-purple-800 text-[11px] rounded-xl font-medium flex items-start gap-2 animate-fade-in">
                  <Globe className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Acesso global:</strong> o SaaS Master não é vinculado a nenhuma tenant.
                  </span>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Tenant Vinculado
                  </label>
                  <select
                    value={editTenantId}
                    onChange={(e) => setEditTenantId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                  >
                    {tenantsList.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                    {tenantsList.length === 0 && (
                        <option value="">Nenhum tenant cadastrado</option>
                      )}
                  </select>
                </div>
              )}

              {editRole === 'bpo' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Parceiro BPO
                  </label>
                  <select
                    value={editBpoName}
                    onChange={(e) => setEditBpoName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                  >
                    {bpos.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Redefinir Senha (Deixe em branco para manter a atual)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Nova senha..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                >
                  {editSaving ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMAÇÃO EM MODAL (IFRAME SAFE) */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-5 text-left space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              {confirmModal.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALERTA */}
      {alertModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-sm w-full p-5 text-left space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
              {alertModal.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {alertModal.message}
            </p>
            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAlertModal(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Ok, Entendi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
