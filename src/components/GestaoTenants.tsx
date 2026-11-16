import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  ShieldCheck, 
  Users, 
  Trash2, 
  CheckCircle, 
  RefreshCw, 
  AlertCircle,
  AlertTriangle,
  Globe, 
  Lock, 
  Layers, 
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug?: string;
  cnpj?: string;
  active: boolean;
  adminEmail: string;
  createdAt: string;
  parentId?: string | null;
  isSubtenant?: boolean;
  bpoName?: string;
  plan?: 'enterprise' | 'pro' | 'basic';
}

interface GestaoTenantsProps {
  userEmail?: string;
  userRole?: string;
  onSelectTenantForAI?: (tenantId: string, tenantName: string) => void;
  onBposChange?: () => void;
}

export default function GestaoTenants({ 
  userEmail = 'master@casasbahia.com', 
  userRole = 'admin', 
  onSelectTenantForAI, 
  onBposChange 
}: GestaoTenantsProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isSuperAdmin = userEmail === 'master@admin.com' || userRole === 'superadmin';

  // Form modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [bpoName, setBpoName] = useState('');
  const [plan, setPlan] = useState<'enterprise' | 'pro' | 'basic'>('pro');
  const [isSubtenantForm, setIsSubtenantForm] = useState(!isSuperAdmin);
  const [selectedParentId, setSelectedParentId] = useState<string>('system-global');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{ id: string; tenantName: string } | null>(null);

  const fetchTenants = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const url = `/api/tenants?userEmail=${encodeURIComponent(userEmail)}&role=${encodeURIComponent(userRole)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const list: Tenant[] = Array.isArray(data) ? data : (data.tenants || []);
        setTenants(list);
        
        const firstTop = list.find(t => !t.isSubtenant);
        if (firstTop) {
          setSelectedParentId(firstTop.id);
        }
      } else {
        setErrorMsg("Falha ao carregar lista de tenants do servidor.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro de rede ao carregar tenants.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [userEmail, userRole]);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adminEmail.trim()) {
      setErrorMsg("Por favor, preencha o nome e o e-mail administrativo.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const generatedSlug = slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const cleanBpoName = bpoName.trim() || name.trim();
    const cleanAdminPassword = adminPassword.trim();

    if (!cleanAdminPassword) {
      setErrorMsg("Informe a senha inicial do administrador (mínimo de 16 caracteres, com maiúscula, minúscula, número e símbolo).");
      setSubmitting(false);
      return;
    }
    const passwordClasses = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(cleanAdminPassword)).length;
    if (cleanAdminPassword.length < 16 || passwordClasses < 3) {
      setErrorMsg("A senha inicial precisa ter ao menos 16 caracteres e combinar maiúscula, minúscula, número e símbolo (pelo menos 3 classes).");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: generatedSlug,
          adminEmail: adminEmail.trim(),
          adminPassword: cleanAdminPassword,
          bpoName: cleanBpoName,
          parentId: isSubtenantForm ? selectedParentId : null,
          isSubtenant: isSubtenantForm,
          plan,
          requesterEmail: userEmail
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // O POST /api/tenants já provisiona o tenant e o usuário admin na mesma
        // gravação crítica. Não criar tenant/usuário duplicados depois.
        setSuccessMsg(isSubtenantForm 
          ? `Sub-Tenant / Parceira BPO "${data.tenant.name}" provisionado com sucesso!`
          : `Novo Tenant Contratante "${data.tenant.name}" criado com sucesso!`
        );
        setIsModalOpen(false);
        setName('');
        setSlug('');
        setAdminEmail('');
        setAdminPassword('');
        setBpoName('');
        fetchTenants();
        if (onBposChange) onBposChange();
        window.dispatchEvent(new Event('bposUpdated'));
        window.dispatchEvent(new Event('tenantsUpdated'));
      } else {
        setErrorMsg(data.error || "Erro ao criar tenant.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Falha na comunicação com o servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTenant = (id: string, tenantName: string) => {
    const targetTenant = tenants.find(t => t.id === id);
    const isTargetMainTenant = targetTenant && (!targetTenant.isSubtenant && (targetTenant.parentId === null || targetTenant.parentId === undefined));

    if (isTargetMainTenant && !isSuperAdmin) {
      setErrorMsg("A tenant não pode excluir a sua própria empresa contratante matriz.");
      return;
    }

    setConfirmDeleteModal({ id, tenantName });
  };

  const executeDeleteTenant = async () => {
    if (!confirmDeleteModal) return;
    const { id, tenantName } = confirmDeleteModal;
    setConfirmDeleteModal(null);

    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await fetch(`/api/tenants/${id}?requesterEmail=${encodeURIComponent(userEmail)}`, { 
        method: 'DELETE' 
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Sub-Tenant / Operação BPO "${tenantName}" removida com sucesso!`);
        if (data.tenants && Array.isArray(data.tenants)) {
          setTenants(data.tenants);
        } else {
          fetchTenants();
        }
        if (onBposChange) onBposChange();
        window.dispatchEvent(new Event('bposUpdated'));
        window.dispatchEvent(new Event('tenantsUpdated'));
      } else {
        setErrorMsg(data.error || "Erro ao remover sub-tenant.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Falha na comunicação com o servidor.");
    }
  };

  const topTenants = tenants.filter(t => !t.isSubtenant && t.parentId === null);
  const mainTenant = topTenants[0] || tenants.find(t => !t.isSubtenant);
  const subTenants = tenants.filter(t => t.isSubtenant || t.parentId !== null);

  return (
    <div className="space-y-6 text-left animate-fade-in" id="gestaoTenantsRoot">
      
      {/* CABEÇALHO CLEAN */}
      <div className="sticky top-14 lg:top-0 z-30 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">
                {isSuperAdmin ? 'Gestão Global de Tenants & Sub-Tenants BPO' : `Gestão de Sub-Tenants & BPOs (${mainTenant?.name || 'Tenant Matriz'})`}
              </h2>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold">
                {isSuperAdmin ? 'Super Admin SaaS' : `Tenant Matriz: ${mainTenant?.name || ''}`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSuperAdmin 
                ? 'Provisionamento de novas empresas contratantes e parceiras BPO com isolamento estrito de dados.'
                : `Cadastre e gerencie as operações BPO da ${mainTenant?.name || 'sua organização'}, com acessos e relatórios isolados.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsSubtenantForm(!isSuperAdmin);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{isSuperAdmin ? 'Novo Tenant' : 'Nova Sub-Tenant (BPO)'}</span>
        </button>
      </div>

      {/* ALERTAS DE FEEDBACK */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-800 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer">✕</button>
        </div>
      )}

      {/* CARD DA MATRIZ (PARA TENANT ADMIN) */}
      {!isSuperAdmin && mainTenant && (
        <div className="bg-white border border-slate-200 p-4.5 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tenant Matriz Contratante</span>
                <h3 className="text-sm font-bold text-slate-900">{mainTenant.name}</h3>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[11px] font-bold">
              Ativo • Master Tenant
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 pt-1">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase">CNPJ:</span>
              <strong className="font-mono text-slate-800">{mainTenant.cnpj || '33.041.260/0001-40'}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Admin Principal:</span>
              <strong className="text-indigo-700">{mainTenant.adminEmail}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Sub-Tenants / BPOs:</span>
              <strong className="text-emerald-700">{subTenants.length} Operações Isoladas</strong>
            </div>
          </div>
        </div>
      )}

      {/* LISTA DE SUB-TENANTS / PARCEIROS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              {isSuperAdmin ? 'Tenants Contratantes & Sub-Tenants' : `Sub-Tenants e BPOs Registrados (${tenants.length})`}
            </h3>
          </div>

          <button
            type="button"
            onClick={fetchTenants}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 font-medium text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Carregando ambientes multi-tenant...</span>
          </div>
        ) : tenants.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs italic">
            Nenhuma sub-tenant cadastrada. Clique no botão acima para adicionar a primeira parceira BPO.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((tenant) => {
              const isSub = tenant.isSubtenant || tenant.parentId !== null;
              const parentObj = tenants.find(p => p.id === tenant.parentId);
              
              return (
                <div 
                  key={tenant.id}
                  className={`p-4 border rounded-2xl space-y-3 transition-all flex flex-col justify-between ${
                    isSub 
                      ? 'bg-slate-50/50 border-slate-200 hover:border-slate-300' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          isSub 
                            ? 'bg-purple-50 text-purple-700 border-purple-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {isSub ? 'Sub-Tenant BPO' : 'Tenant Matriz'}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1.5">{tenant.name}</h4>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        tenant.active 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {tenant.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      {isSub && parentObj && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>Matriz: <strong className="text-slate-800">{parentObj.name}</strong></span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Admin: <strong>{tenant.adminEmail}</strong></span>
                      </div>

                      {tenant.bpoName && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>BPO: <strong className="text-emerald-800">{tenant.bpoName}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                    <span className="font-mono text-[10px]">{tenant.id}</span>
                    
                    <div className="flex items-center gap-2">
                      {isSuperAdmin && onSelectTenantForAI && (
                        <button
                          type="button"
                          onClick={() => onSelectTenantForAI(tenant.id, tenant.name)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          <span>Configurar IA</span>
                        </button>
                      )}

                      {!isSub && !isSuperAdmin ? (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>Matriz</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir Sub-Tenant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL CRIAR TENANT */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isSubtenantForm ? 'Cadastrar Nova Sub-Tenant (BPO)' : 'Provisionar Novo Tenant Matriz'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome da Operação / Parceiro BPO *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    // O rótulo do parceiro BPO é derivado do nome no submit
                    // (`bpoName || name`). Auto-preencher a cada tecla gravava
                    // apenas o primeiro caractere e criava divergência entre
                    // tenant.name e tenant.bpoName.
                    setName(e.target.value);
                  }}
                  placeholder="ex: BPO Delta (São Paulo)"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mail do Administrador Responsável *
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="ex: coordenador.bpo@empresa.com.br"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Senha Inicial de Acesso *
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Mín. 16 caracteres, com maiúscula, minúscula, número e símbolo"
                  required
                  minLength={16}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Essa senha será usada no primeiro acesso do administrador do tenant. Ela não pode ser uma senha pública ou de demonstração.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Criando...' : 'Salvar Sub-Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR EXCLUSÃO */}
      {confirmDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-left">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900">Confirmar Exclusão</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tem certeza que deseja remover a sub-tenant <strong>"{confirmDeleteModal.tenantName}"</strong>? Todos os dados associados a esta operação serão desvinculados.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeDeleteTenant}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
