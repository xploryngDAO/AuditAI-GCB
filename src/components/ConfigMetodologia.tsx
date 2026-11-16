import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AuditConfig, GuiaItem, BookItem, MetodologiaBloco } from '../types';
import { 
  Settings, 
  BookOpen, 
  CheckSquare, 
  Building2, 
  Plus, 
  Trash2, 
  RefreshCw, 
  UploadCloud, 
  Search, 
  AlertTriangle, 
  Headphones, 
  MessageSquare, 
  Globe, 
  FileText, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  ShieldAlert, 
  Layers,
  Sparkles,
  Edit3,
  Sliders,
  Palette,
  Download,
  X
} from 'lucide-react';
import GuiaImportModal from './GuiaImportModal';
import GuiaItemEditModal from './GuiaItemEditModal';
import { buildGuiaTemplateCsv, planGuiaImport, type GuiaImportPlan } from '../utils/guiaImport';
import { readGuiaSpreadsheet } from '../utils/guiaSpreadsheet';

interface ConfigMetodologiaProps {
  config: AuditConfig;
  onUpdate: (newConfig: AuditConfig) => void;
  tenantId?: string;
  userEmail?: string;
  userRole?: string;
}

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; badge: string; accent: string }> = {
  indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50/60', text: 'text-indigo-900', badge: 'bg-indigo-100 text-indigo-800', accent: 'bg-indigo-600' },
  emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50/60', text: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-800', accent: 'bg-emerald-600' },
  amber: { border: 'border-amber-200', bg: 'bg-amber-50/60', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-800', accent: 'bg-amber-600' },
  rose: { border: 'border-rose-200', bg: 'bg-rose-50/60', text: 'text-rose-900', badge: 'bg-rose-100 text-rose-800', accent: 'bg-rose-600' },
  purple: { border: 'border-purple-200', bg: 'bg-purple-50/60', text: 'text-purple-900', badge: 'bg-purple-100 text-purple-800', accent: 'bg-purple-600' },
  blue: { border: 'border-blue-200', bg: 'bg-blue-50/60', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-800', accent: 'bg-blue-600' },
  cyan: { border: 'border-cyan-200', bg: 'bg-cyan-50/60', text: 'text-cyan-900', badge: 'bg-cyan-100 text-cyan-800', accent: 'bg-cyan-600' },
};

export default function ConfigMetodologia({ config, onUpdate, tenantId, userEmail, userRole }: ConfigMetodologiaProps) {
  // Tabs state
  const [activeSubTab, setActiveSubTab] = useState<'book' | 'guia' | 'blocos'>('book');

  // Tenant & Scope states for multi-tenant / subtenant / queue isolation
  const initialTenant = tenantId || "system-global";
  const [selectedTenant, setSelectedTenant] = useState<string>(initialTenant);
  const [selectedSubtenant, setSelectedSubtenant] = useState<string>("todos");
  const [selectedQueue, setSelectedQueue] = useState<string>("todas");

  const [availableTenants, setAvailableTenants] = useState<{ id: string; name: string }[]>([]);
  const [availableBpos, setAvailableBpos] = useState<string[]>([]);
  const [availableQueues, setAvailableQueues] = useState<string[]>([]);

  // Blocos Metodológicos customizáveis
  const [blocos, setBlocos] = useState<MetodologiaBloco[]>(config.blocos || []);
  const [showBlocoModal, setShowBlocoModal] = useState(false);
  const [editingBlocoId, setEditingBlocoId] = useState<string | null>(null);
  const [blocoForm, setBlocoForm] = useState({
    nome: '',
    peso: 25,
    descricao: '',
    cor: 'indigo',
    ativo: true
  });

  // Book tab states
  const [books, setBooks] = useState<BookItem[]>(config.books || []);
  const [searchBook, setSearchBook] = useState("");
  const [uploadTheme, setUploadTheme] = useState("");
  const [uploadChannel, setUploadChannel] = useState<'todos' | 'audio' | 'chat'>('todos');
  const [uploadSubtenant, setUploadSubtenant] = useState<string>("todos");
  const [uploadQueue, setUploadQueue] = useState<string>("todas");
  const [uploadingBook, setUploadingBook] = useState(false);
  const [selectedBookFiles, setSelectedBookFiles] = useState<File[]>([]);
  // Consentimento explícito para envio de PDF/imagem a IA externa (LGPD).
  const [externalAiConsent, setExternalAiConsent] = useState(false);
  const uploadNeedsExternalConsent = selectedBookFiles.some(f => /\.(pdf|png|jpe?g)$/i.test(f.name));
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);

  // Edit Book state
  const [editingBook, setEditingBook] = useState<BookItem | null>(null);
  const [editBookForm, setEditBookForm] = useState<{
    theme: string;
    name: string;
    channel: 'todos' | 'audio' | 'chat';
    subtenantId: string;
    queueName: string;
    content: string;
  }>({
    theme: '',
    name: '',
    channel: 'todos',
    subtenantId: 'todos',
    queueName: 'todas',
    content: ''
  });
  const [savingBook, setSavingBook] = useState(false);

  // Guia tab states
  const [guiaItens, setGuiaItens] = useState<GuiaItem[]>(config.guiaItens || []);
  const [searchGuia, setSearchGuia] = useState("");
  const [filterBloco, setFilterBloco] = useState<string>("TODOS");
  const [filterRelevancia, setFilterRelevancia] = useState<string>("TODOS");
  const [showAddGuia, setShowAddGuia] = useState(false);
  const [newGuiaItem, setNewGuiaItem] = useState({
    bloco: "Processo",
    relevancia: "MODERADA" as GuiaItem['relevancia'],
    motivoOriginal: "",
    motivoSimplificado: "",
    categoriaEstrategica: "Experiência",
    scorePenalidade: 4,
    observacao: "",
    acaoCorretiva: "",
    subtenantId: "todos",
    queueName: "todas"
  });

  // Importação de planilha e edição completa de um motivo
  const guiaFileInputRef = useRef<HTMLInputElement>(null);
  const [importingGuia, setImportingGuia] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    grid: unknown[][];
    plan: GuiaImportPlan;
  } | null>(null);
  const [savingImport, setSavingImport] = useState(false);
  const [editingGuia, setEditingGuia] = useState<GuiaItem | null>(null);
  const [savingGuiaEdit, setSavingGuiaEdit] = useState(false);

  // Feedback alerts & modals
  const [msg, setMsg] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Sync selectedTenant when tenantId prop changes
  useEffect(() => {
    if (tenantId && tenantId !== selectedTenant) {
      setSelectedTenant(tenantId);
    }
  }, [tenantId]);

  // Load scope options and dynamic tenant configs when selectedTenant changes
  useEffect(() => {
    fetchScopeOptions(selectedTenant);
    loadConfigData(selectedTenant);
  }, [selectedTenant]);

  const fetchScopeOptions = async (targetTid?: string) => {
    const tid = targetTid || selectedTenant || tenantId || 'system-global';
    const email = userEmail || '';
    const role = userRole || '';
    try {
      const [tRes, bRes, gRes] = await Promise.all([
        fetch(`/api/tenants?tenantId=${encodeURIComponent(tid)}&userEmail=${encodeURIComponent(email)}&role=${encodeURIComponent(role)}`).catch(() => null),
        fetch(`/api/bpos?tenantId=${encodeURIComponent(tid)}`, { headers: { 'x-tenant-id': tid } }).catch(() => null),
        fetch(`/api/genesys/config?tenantId=${encodeURIComponent(tid)}`, { headers: { 'x-tenant-id': tid } }).catch(() => null)
      ]);
      if (tRes && tRes.ok) {
        const ct = tRes.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const tData = await tRes.json().catch(() => null);
          if (tData && tData.success && Array.isArray(tData.tenants)) {
            setAvailableTenants(tData.tenants.map((t: any) => ({ id: t.id, name: t.name })));
          }
        }
      }
      if (bRes && bRes.ok) {
        const ct = bRes.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const bData = await bRes.json().catch(() => null);
          if (bData) {
            const bList = Array.isArray(bData) ? bData : (bData.bpos || []);
            setAvailableBpos(bList);
          }
        }
      }
      if (gRes && gRes.ok) {
        const ct = gRes.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const gData = await gRes.json().catch(() => null);
          if (gData && gData.queues && Array.isArray(gData.queues)) {
            setAvailableQueues(gData.queues.map((q: any) => typeof q === 'string' ? q : (q.name || q.id || String(q))));
          }
        }
      }
    } catch (e) {
      console.warn("Aviso ao carregar opções de escopo:", e);
    }
  };

  const loadConfigData = async (tenantIdToLoad?: string) => {
    const tid = tenantIdToLoad || selectedTenant || tenantId || 'system-global';
    try {
      const resp = await fetch(`/api/config?tenantId=${encodeURIComponent(tid)}&userEmail=${encodeURIComponent(userEmail || '')}`, {
        headers: { 'x-tenant-id': tid }
      });
      if (resp.ok) {
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data: AuditConfig = await resp.json().catch(() => ({}) as AuditConfig);
          const loadedBooks = Array.isArray(data.books) ? data.books : [];
          const loadedGuia = Array.isArray(data.guiaItens) ? data.guiaItens : [];
          const loadedBlocos = Array.isArray(data.blocos) ? data.blocos : [];
          setBooks(loadedBooks);
          setGuiaItens(loadedGuia);
          setBlocos(loadedBlocos);
          onUpdate({
            ...config,
            ...data,
            books: loadedBooks,
            guiaItens: loadedGuia,
            blocos: loadedBlocos
          });
        }
      }
    } catch (e) {
      console.warn("Erro ao carregar dados do tenant:", e);
    }
  };

  // Block management functions
  const handleSaveBloco = async () => {
    if (!blocoForm.nome.trim()) {
      setMsg("❌ Informe o nome do bloco metodológico.");
      return;
    }

    try {
      const payload = {
        id: editingBlocoId || `bloco-${Date.now()}`,
        nome: blocoForm.nome.trim(),
        peso: Number(blocoForm.peso || 0),
        descricao: blocoForm.descricao.trim(),
        cor: blocoForm.cor || 'indigo',
        ativo: blocoForm.ativo
      };

      const resp = await fetch(`/api/config/blocos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': selectedTenant
        },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          const updatedBlocos = data.blocos || [];
          setBlocos(updatedBlocos);
          onUpdate({ ...config, blocos: updatedBlocos });
          setMsg(`✅ Bloco "${blocoForm.nome}" salvo com sucesso para a Tenant selecionada!`);
          setShowBlocoModal(false);
          setEditingBlocoId(null);
          setBlocoForm({ nome: '', peso: 25, descricao: '', cor: 'indigo', ativo: true });
        } else {
          setMsg(`❌ Falha ao salvar bloco: ${data.error || 'Erro desconhecido'}`);
        }
      }
    } catch (err: any) {
      setMsg(`❌ Erro ao salvar bloco: ${err.message}`);
    }
  };

  const handleEditBlocoClick = (b: MetodologiaBloco) => {
    setEditingBlocoId(b.id);
    setBlocoForm({
      nome: b.nome,
      peso: b.peso,
      descricao: b.descricao || '',
      cor: b.cor || 'indigo',
      ativo: b.ativo !== false
    });
    setShowBlocoModal(true);
  };

  const handleDeleteBloco = (b: MetodologiaBloco) => {
    setConfirmModal({
      title: "Excluir Bloco Metodológico",
      message: `Tem certeza que deseja excluir o bloco "${b.nome}"? Os motivos do Guia de Penalidades associados a este bloco precisarão ser reclassificados.`,
      onConfirm: async () => {
        try {
          const resp = await fetch(`/api/config/blocos/${b.id}`, {
            method: 'DELETE',
            headers: { 'x-tenant-id': selectedTenant }
          });
          if (resp.ok) {
            const data = await resp.json();
            const updatedBlocos = data.blocos || [];
            setBlocos(updatedBlocos);
            onUpdate({ ...config, blocos: updatedBlocos });
            setMsg(`✅ Bloco "${b.nome}" removido com sucesso.`);
          }
        } catch (e: any) {
          setMsg(`❌ Erro ao remover bloco: ${e.message}`);
        }
        setConfirmModal(null);
      }
    });
  };

  const handleResetBlocos = () => {
    setConfirmModal({
      title: "Limpar Pilares",
      message: "Isso removerá todos os pilares configurados desta tenant. A estrutura ficará vazia para você definir a sua. Deseja continuar?",
      onConfirm: async () => {
        try {
          const resp = await fetch(`/api/config/blocos/reset`, {
            method: 'POST',
            headers: { 'x-tenant-id': selectedTenant }
          });
          if (resp.ok) {
            const data = await resp.json();
            const updatedBlocos = data.blocos || [];
            setBlocos(updatedBlocos);
            onUpdate({ ...config, blocos: updatedBlocos });
            setMsg("✅ Pilares removidos. Defina os blocos da sua operação.");
          }
        } catch (e: any) {
          setMsg(`❌ Erro ao resetar blocos: ${e.message}`);
        }
        setConfirmModal(null);
      }
    });
  };

  const totalPesoBlocos = useMemo(() => {
    return blocos.reduce((acc, b) => acc + (b.ativo ? Number(b.peso || 0) : 0), 0);
  }, [blocos]);

  // Helper file reader
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error(`Falha ao ler o arquivo ${file.name}`));
      reader.readAsDataURL(file);
    });
  };

  // Upload book handler
  const handleUploadBook = async () => {
    if (selectedBookFiles.length === 0) {
      setMsg("❌ Selecione ao menos um arquivo (.txt, .pdf, .csv) para upload.");
      return;
    }

    if (uploadNeedsExternalConsent && !externalAiConsent) {
      setMsg("❌ PDF/imagem exige consentimento explícito para envio a IA externa. Marque a autorização LGPD no formulário.");
      return;
    }

    setUploadingBook(true);
    setMsg("");
    
    let processedCount = 0;
    let failedCount = 0;
    let fallbackUpdatedConfig = { ...config };

    try {
      for (let i = 0; i < selectedBookFiles.length; i++) {
        const file = selectedBookFiles[i];
        const fileType = file.name.split('.').pop() || '';
        
        const currentTheme = selectedBookFiles.length === 1 
          ? (uploadTheme.trim() || file.name.split('.')[0].replace(/_/g, " ").replace(/-/g, " "))
          : (file.name.split('.')[0].replace(/_/g, " ").replace(/-/g, " "));

        try {
          setMsg(`⏳ Processando arquivo (${i + 1}/${selectedBookFiles.length}): "${file.name}"...`);
          
          const base64Data = await readFileAsDataURL(file);
          
          const resp = await fetch(`/api/config/books?tenantId=${selectedTenant}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              theme: currentTheme,
              channel: uploadChannel,
              subtenantId: uploadSubtenant,
              queueName: uploadQueue,
              fileType,
              base64Data,
              tenantId: selectedTenant,
              consentExternalAi: externalAiConsent
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            if (data.success) {
              setBooks(data.books);
              processedCount++;
              fallbackUpdatedConfig.books = data.books;
            } else {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }

      if (processedCount > 0) {
        setUploadTheme("");
        setSelectedBookFiles([]);
        setExternalAiConsent(false);
        const fileInput = document.getElementById("book-file-input") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        
        if (failedCount === 0) {
          setMsg(`⚡ ${processedCount} diretriz(es) cadastrada(s) e extraída(s) com sucesso!`);
        } else {
          setMsg(`⚡ Lote concluído: ${processedCount} salva(s), ${failedCount} falha(s).`);
        }
        
        onUpdate(fallbackUpdatedConfig);
      } else {
        setMsg(`❌ Falha no processamento de todos os ${failedCount} arquivos do lote.`);
      }

    } catch (e: any) {
      setMsg("❌ Erro ao enviar arquivos: " + e.message);
    } finally {
      setUploadingBook(false);
    }
  };

  // Delete Book
  const handleDeleteBook = (id: string) => {
    setConfirmModal({
      title: "Excluir Diretriz de Atendimento",
      message: "Tem certeza de que deseja remover permanentemente este manual de atendimento? A IA deixará de considerar suas regras.",
      onConfirm: async () => {
        setMsg("");
        try {
          const resp = await fetch(`/api/config/books/${id}?tenantId=${selectedTenant}`, {
            method: 'DELETE'
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success) {
              setBooks(data.books);
              setMsg("⚡ Diretriz removida com sucesso.");
              onUpdate({ ...config, books: data.books });
            }
          } else {
            setMsg("❌ Falha ao excluir a diretriz.");
          }
        } catch {
          setMsg("❌ Erro de conexão.");
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  // Open Edit Book Modal
  const handleOpenEditBook = (book: BookItem) => {
    setEditingBook(book);
    setEditBookForm({
      theme: book.theme || '',
      name: book.name || '',
      channel: book.channel || 'todos',
      subtenantId: book.subtenantId || 'todos',
      queueName: book.queueName || 'todas',
      content: book.content || ''
    });
  };

  // Save Edit Book
  const handleSaveEditBook = async () => {
    if (!editingBook) return;
    if (!editBookForm.theme.trim()) {
      setMsg("❌ Informe o tema da diretriz.");
      return;
    }

    setSavingBook(true);
    setMsg("");
    try {
      const resp = await fetch(`/api/config/books/${editingBook.id}?tenantId=${selectedTenant}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editBookForm,
          tenantId: selectedTenant
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          setBooks(data.books);
          setMsg("⚡ Diretriz / Manual atualizado com sucesso!");
          setEditingBook(null);
          onUpdate({ ...config, books: data.books });
        } else {
          setMsg("❌ Falha ao atualizar diretriz: " + (data.error || "Erro desconhecido"));
        }
      } else {
        setMsg("❌ Erro no servidor ao salvar diretriz.");
      }
    } catch (err: any) {
      setMsg("❌ Erro de conexão ao salvar diretriz: " + err.message);
    } finally {
      setSavingBook(false);
    }
  };

  // Add Guia Item
  const handleAddGuiaItem = async () => {
    if (!newGuiaItem.motivoOriginal.trim()) {
      setMsg("❌ Informe a descrição da infração / motivo original.");
      return;
    }
    
    try {
      const resp = await fetch(`/api/guia/add?tenantId=${selectedTenant}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': selectedTenant
        },
        body: JSON.stringify({
          ...newGuiaItem,
          tenantId: selectedTenant
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        setGuiaItens(data.guiaItens);
        setMsg("✅ Novo motivo de penalidade cadastrado com sucesso.");
        setShowAddGuia(false);
        setNewGuiaItem({
          bloco: "Processo",
          relevancia: "MODERADA",
          motivoOriginal: "",
          motivoSimplificado: "",
          categoriaEstrategica: "Experiência",
          scorePenalidade: 4,
          observacao: "",
          acaoCorretiva: "",
          subtenantId: "todos",
          queueName: "todas"
        });
        onUpdate({ ...config, guiaItens: data.guiaItens });
      }
    } catch {
      setMsg("❌ Falha ao cadastrar motivo no guia.");
    }
  };

  // Delete Guia Item
  const handleDeleteGuiaItem = (id: number) => {
    setConfirmModal({
      title: "Excluir Motivo de Penalidade",
      message: "Deseja remover este item de infração do guia? Esta alteração impactará os novos cálculos de auditoria.",
      onConfirm: async () => {
        try {
          const resp = await fetch(`/api/guia/delete/${id}?tenantId=${selectedTenant}`, { 
            method: 'DELETE',
            headers: { 'x-tenant-id': selectedTenant }
          });
          if (resp.ok) {
            const data = await resp.json();
            setGuiaItens(data.guiaItens);
            onUpdate({ ...config, guiaItens: data.guiaItens });
            setMsg("✅ Motivo de penalidade deletado com sucesso.");
          }
        } catch {
          setMsg("❌ Falha de rede ao deletar item.");
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  // Importar planilha (CSV/TSV/XLSX) e editar um motivo completo
  const handleSelectGuiaFile = () => {
    guiaFileInputRef.current?.click();
  };

  const handleGuiaFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportingGuia(true);
    setMsg("");
    try {
      const grid = await readGuiaSpreadsheet(file);
      const plan = planGuiaImport({
        grid,
        guiaItens,
        blocos,
        tenantId: selectedTenant
      });
      setImportPreview({ fileName: file.name, grid, plan });
    } catch (error: any) {
      setMsg(`❌ ${error?.message || "Falha ao ler a planilha."}`);
    } finally {
      setImportingGuia(false);
    }
  };

  const handleConfirmGuiaImport = async () => {
    if (!importPreview?.plan.ok) return;

    setSavingImport(true);
    try {
      const resp = await fetch(`/api/guia/import?tenantId=${encodeURIComponent(selectedTenant)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": selectedTenant
        },
        body: JSON.stringify({ grid: importPreview.grid })
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success || !Array.isArray(data.guiaItens)) {
        throw new Error(data?.error || "Falha ao importar a planilha.");
      }

      const nextGuia: GuiaItem[] = data.guiaItens;
      const nextBlocos: MetodologiaBloco[] =
        Array.isArray(data.blocos) && data.blocos.length > 0 ? data.blocos : blocos;

      setGuiaItens(nextGuia);
      setBlocos(nextBlocos);
      onUpdate({ ...config, guiaItens: nextGuia, blocos: nextBlocos });
      setImportPreview(null);

      const summary = data.summary || {};
      setMsg(
        `✅ Importação concluída: ${summary.created ?? 0} novo(s), ${summary.updated ?? 0} atualizado(s), ${summary.skipped ?? 0} ignorado(s)` +
          (summary.newBlocks ? `, ${summary.newBlocks} bloco(s) novo(s).` : ".")
      );
    } catch (error: any) {
      setMsg(`❌ ${error?.message || "Falha ao importar a planilha."}`);
    } finally {
      setSavingImport(false);
    }
  };

  const handleDownloadGuiaTemplate = () => {
    const csv = buildGuiaTemplateCsv(guiaItens);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `modelo-guia-penalidades-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleEditGuiaClick = (item: GuiaItem) => {
    setEditingGuia(item);
  };

  const handleSaveGuiaEdit = async (fields: Partial<GuiaItem>) => {
    if (!editingGuia) return;

    setSavingGuiaEdit(true);
    try {
      const resp = await fetch(`/api/guia/update/${editingGuia.id}?tenantId=${encodeURIComponent(selectedTenant)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": selectedTenant
        },
        body: JSON.stringify(fields)
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success || !Array.isArray(data.guiaItens)) {
        throw new Error(data?.error || "Falha ao salvar o motivo.");
      }

      setGuiaItens(data.guiaItens);
      onUpdate({ ...config, guiaItens: data.guiaItens });
      setEditingGuia(null);
      setMsg("✅ Motivo atualizado com sucesso.");
    } catch (error: any) {
      setMsg(`❌ ${error?.message || "Falha ao salvar o motivo."}`);
    } finally {
      setSavingGuiaEdit(false);
    }
  };

  // Update Guia Item
  const handleUpdateGuiaItem = async (id: number, relevance: GuiaItem['relevancia'], score: number, subtenantId?: string, queueName?: string) => {
    try {
      const resp = await fetch(`/api/guia/update/${id}?tenantId=${selectedTenant}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': selectedTenant
        },
        body: JSON.stringify({
          relevancia: relevance,
          scorePenalidade: score,
          subtenantId,
          queueName
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        setGuiaItens(data.guiaItens);
        onUpdate({ ...config, guiaItens: data.guiaItens });
        setMsg("✅ Gravidade/Penalidade atualizada com sucesso!");
      }
    } catch {
      setMsg("❌ Erro ao atualizar item.");
    }
  };

  // Reset Guia
  const handleResetGuia = () => {
    setConfirmModal({
      title: "Redefinir Guia ao Padrão de Operação",
      message: "Tem certeza de que deseja restaurar os padrões do manual original? Alterações customizadas nesta tenant serão resetadas.",
      onConfirm: async () => {
        try {
          const resp = await fetch(`/api/guia/reset?tenantId=${selectedTenant}`, { 
            method: 'POST',
            headers: { 'x-tenant-id': selectedTenant }
          });
          if (resp.ok) {
            const data = await resp.json();
            setGuiaItens(data.guiaItens);
            onUpdate({ ...config, guiaItens: data.guiaItens });
            setMsg("🔄 Guia de Atendimento restaurado com sucesso!");
          }
        } catch {
          setMsg("❌ Falha ao resetar guia.");
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  // Filtered Lists
  const filteredBooks = useMemo(() => {
    return books.filter(b => {
      const matchesSearch = !searchBook.trim() || 
        b.theme.toLowerCase().includes(searchBook.toLowerCase()) || 
        b.name.toLowerCase().includes(searchBook.toLowerCase()) ||
        b.content.toLowerCase().includes(searchBook.toLowerCase());

      const matchesSubtenant = selectedSubtenant === "todos" || 
        !b.subtenantId || b.subtenantId === "todos" || 
        b.subtenantId.toLowerCase() === selectedSubtenant.toLowerCase();

      const matchesQueue = selectedQueue === "todas" || 
        !b.queueName || b.queueName === "todas" || 
        b.queueName.toLowerCase() === selectedQueue.toLowerCase();

      return matchesSearch && matchesSubtenant && matchesQueue;
    });
  }, [books, searchBook, selectedSubtenant, selectedQueue]);

  const filteredGuia = useMemo(() => {
    return guiaItens.filter(g => {
      const matchesSearch = !searchGuia.trim() ||
        g.motivoOriginal.toLowerCase().includes(searchGuia.toLowerCase()) ||
        (g.observacao && g.observacao.toLowerCase().includes(searchGuia.toLowerCase())) ||
        g.bloco.toLowerCase().includes(searchGuia.toLowerCase());

      const matchesBloco = filterBloco === "TODOS" || g.bloco.toLowerCase() === filterBloco.toLowerCase();
      const matchesRelev = filterRelevancia === "TODOS" || g.relevancia.toLowerCase() === filterRelevancia.toLowerCase();

      const matchesSubtenant = selectedSubtenant === "todos" || 
        !g.subtenantId || g.subtenantId === "todos" || 
        g.subtenantId.toLowerCase() === selectedSubtenant.toLowerCase();

      const matchesQueue = selectedQueue === "todas" || 
        !g.queueName || g.queueName === "todas" || 
        g.queueName.toLowerCase() === selectedQueue.toLowerCase();

      return matchesSearch && matchesBloco && matchesRelev && matchesSubtenant && matchesQueue;
    });
  }, [guiaItens, searchGuia, filterBloco, filterRelevancia, selectedSubtenant, selectedQueue]);

  return (
    <div className="flex flex-col gap-4 font-sans lg:h-[calc(100vh-4.5rem)] lg:min-h-0 lg:overflow-hidden">
      {/* CABEÇALHO + ABAS + FILTROS FIXOS */}
      <div className="shrink-0 space-y-4">
      {/* HEADER WITH SUBTAB SELECTOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            <span>Configurações de Metodologia</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Parametrizador de diretrizes de atendimento e guia de penalidades para o motor de Auto-QA.
          </p>
        </div>

        <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200/80 self-start md:self-auto">
          <button
            onClick={() => { setActiveSubTab('book'); setMsg(""); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'book' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Book de Atendimento</span>
            <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
              activeSubTab === 'book' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {filteredBooks.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveSubTab('guia'); setMsg(""); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'guia' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Guia de Penalidades</span>
            <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
              activeSubTab === 'guia' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {filteredGuia.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveSubTab('blocos'); setMsg(""); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'blocos' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Blocos da Metodologia</span>
            <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
              activeSubTab === 'blocos' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {blocos.length}
            </span>
          </button>
        </div>
      </div>

      {/* TOP SCOPE FILTER BAR */}
      <div className="bg-white border border-slate-200 p-4.5 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Escopo e Isolamento da Operação
            </span>
          </div>
          <span className="text-[10px] text-indigo-700 font-mono bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 font-bold">
            Isolamento Ativo por Tenant / BPO / Fila
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Tenant Principal Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Tenant Principal
            </label>
            <select
              value={selectedTenant}
              onChange={(e) => {
                const newTid = e.target.value;
                setSelectedTenant(newTid);
                loadConfigData(newTid);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              {(availableTenants.some(t => t.id === selectedTenant)
                ? availableTenants
                : [{ id: selectedTenant, name: selectedTenant }, ...availableTenants]
              ).map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
              ))}
            </select>
          </div>

          {/* Sub-tenant / BPO Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Sub-tenant / BPO
            </label>
            <select
              value={selectedSubtenant}
              onChange={(e) => setSelectedSubtenant(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="todos">Todos os BPOs (Global)</option>
              {availableBpos.map(bpo => (
                <option key={bpo} value={bpo}>{bpo}</option>
              ))}
            </select>
          </div>

          {/* Fila de Atendimento Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Fila de Atendimento (Queue)
            </label>
            <select
              value={selectedQueue}
              onChange={(e) => setSelectedQueue(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="todas">Todas as Filas (Geral)</option>
              {availableQueues.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
              <option value="SAC_VOZ_HUMANO">SAC_VOZ_HUMANO</option>
              <option value="RETENCAO_CHAT">RETENCAO_CHAT</option>
              <option value="VIP_OUVIDORIA">VIP_OUVIDORIA</option>
            </select>
          </div>
        </div>
      </div>
      </div>

      {/* FEEDBACK TOAST / ALERT */}
      {msg && (        <div className={`p-3.5 rounded-xl text-xs font-semibold leading-relaxed border flex items-center justify-between gap-2 animate-fade-in ${
          msg.startsWith('❌') 
            ? 'bg-rose-50 border-rose-200 text-rose-800' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <span>{msg}</span>
          <button onClick={() => setMsg("")} className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CONTEÚDO COM SCROLL — APENAS ESTA ÁREA ROLA */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
      {/* SUB-TAB 1: BOOK DE ATENDIMENTO */}
      {activeSubTab === 'book' && (
        <div className="space-y-5">
          {/* Top Metric Cards for Book */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total de Diretrizes</span>
                <span className="text-lg font-black text-slate-800">{filteredBooks.length} <span className="text-xs font-normal text-slate-400">cadastradas</span></span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Canais Atendidos</span>
                <span className="text-xs font-bold text-slate-700">
                  {books.filter(b => b.channel === 'todos').length} Globais | {books.filter(b => b.channel === 'audio').length} Voz | {books.filter(b => b.channel === 'chat').length} Chat
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filtro de Escopo</span>
                <span className="text-xs font-bold text-slate-700 truncate block max-w-[200px]">
                  BPO: {selectedSubtenant === 'todos' ? 'Todos' : selectedSubtenant} | Fila: {selectedQueue === 'todas' ? 'Todas' : selectedQueue}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT: BOOKS LIST (COL SPAN 7) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Manuais e Temas de Atendimento ({filteredBooks.length})
                  </h3>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por tema ou arquivo..."
                    value={searchBook}
                    onChange={(e) => setSearchBook(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {filteredBooks.length === 0 ? (
                <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600">Nenhum livro de diretrizes encontrado</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchBook ? "Nenhum resultado corresponde à sua busca." : "Adicione novos manuais no formulário ao lado configurando o tema e escopo desejados."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {filteredBooks.map((book) => {
                    const isExpanded = expandedBookId === book.id;
                    const wordCount = book.content ? book.content.split(/\s+/).filter(Boolean).length : 0;

                    return (
                      <div key={book.id} className="border border-slate-200 rounded-xl p-3.5 bg-white hover:border-indigo-200 transition-all shadow-2xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2 grow">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-extrabold text-slate-900">{book.theme}</h4>

                              {/* Channel Badge */}
                              {book.channel === 'todos' && (
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-150 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase">
                                  <Globe className="w-3 h-3" /> Todos os Canais
                                </span>
                              )}
                              {book.channel === 'audio' && (
                                <span className="bg-amber-50 text-amber-700 border border-amber-150 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase">
                                  <Headphones className="w-3 h-3" /> Canal Voz
                                </span>
                              )}
                              {book.channel === 'chat' && (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-150 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase">
                                  <MessageSquare className="w-3 h-3" /> Canal Chat
                                </span>
                              )}

                              {/* Scope Badges */}
                              <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded-md border border-slate-200 uppercase">
                                🏢 BPO: {book.subtenantId || 'Todos'}
                              </span>
                              <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded-md border border-slate-200 uppercase">
                                🎧 Fila: {book.queueName || 'Todas'}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono flex-wrap">
                              <span>📂 {book.name}</span>
                              <span>⏱️ {book.uploadDate}</span>
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[9px] uppercase font-bold">{book.fileType}</span>
                              <span>📝 ~{wordCount} palavras</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setExpandedBookId(isExpanded ? null : book.id)}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span>{isExpanded ? 'Ocultar' : 'Ver Regras'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditBook(book)}
                              className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition-all cursor-pointer border border-transparent hover:border-indigo-100"
                              title="Editar Canais, Sub-tenant, Fila e Regras"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            
                            {book.id !== "default_book" && (
                              <button
                                type="button"
                                onClick={() => handleDeleteBook(book.id)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all cursor-pointer border border-transparent hover:border-rose-100"
                                title="Excluir Diretriz"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* EXPANDED CONTENT DRAWER */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50 p-3 rounded-xl space-y-2">
                            {book.isFallback ? (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-800 text-[10.5px] leading-relaxed">
                                <p className="font-extrabold flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Diretrizes em Modo de Contingência
                                </p>
                                <p className="text-slate-600 mt-1">
                                  O conteúdo foi normalizado procedimentalmente para garantir auditorias lógicas instantâneas.
                                </p>
                              </div>
                            ) : (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-emerald-800 text-[10.5px] leading-relaxed flex items-center justify-between">
                                <p className="font-extrabold flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Diretrizes Extraídas do Documento Original
                                </p>
                                <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                  {book.content.length} caracteres
                                </span>
                              </div>
                            )}

                            <pre className="text-[10px] text-slate-700 whitespace-pre-wrap font-mono leading-relaxed bg-white p-3 border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                              {book.content}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: UPLOAD NEW BOOK FORM (COL SPAN 5) */}
            <div className="lg:col-span-5 lg:sticky lg:top-0 lg:self-start z-10 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Cadastrar Nova Diretriz / Tema
                </h3>
              </div>

              <div className="space-y-4">
                {/* 1. Theme title & Pill suggestions */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Tema do Manual / Assunto
                  </label>
                  <input
                    type="text"
                    value={uploadTheme}
                    onChange={(e) => setUploadTheme(e.target.value)}
                    placeholder="Ex: Devoluções & Reembolso, SAC Cartões"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {["Regras Gerais", "Trocas & Devoluções", "Marketplace", "Multas de Atraso", "SAC VIP"].map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setUploadTheme(suggestion)}
                        className="text-[9px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-650 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                      >
                        +{suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Target Scope Assignees */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Sub-tenant (BPO)
                    </label>
                    <select
                      value={uploadSubtenant}
                      onChange={(e) => setUploadSubtenant(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="todos">Todos os BPOs</option>
                      {availableBpos.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Fila Alvo
                    </label>
                    <select
                      value={uploadQueue}
                      onChange={(e) => setUploadQueue(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="todas">Todas as Filas</option>
                      {availableQueues.map(q => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                      <option value="SAC_VOZ_HUMANO">SAC_VOZ_HUMANO</option>
                      <option value="RETENCAO_CHAT">RETENCAO_CHAT</option>
                    </select>
                  </div>
                </div>

                {/* 3. Applicable Channel */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Canal Aplicável
                  </label>
                  <select
                    value={uploadChannel}
                    onChange={(e) => setUploadChannel(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="todos">Todos os Canais (Voz e Chat)</option>
                    <option value="audio">Apenas Canal Voz (Telefone)</option>
                    <option value="chat">Apenas Canal Chat (WhatsApp/Web)</option>
                  </select>
                </div>

                {/* 4. Drag & Drop File Zone */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Anexar Arquivo de Diretrizes (.txt, .pdf, .csv)
                  </label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-4 text-center bg-slate-50/50 hover:bg-slate-50 transition-all relative">
                    <input
                      id="book-file-input"
                      type="file"
                      accept=".txt, .pdf, .csv"
                      multiple={true}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).value = '';
                      }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const filesArray = Array.from(e.target.files) as File[];
                          setSelectedBookFiles(filesArray);
                          if (!uploadTheme && filesArray.length > 0) {
                            const nameWithoutExt = filesArray[0].name.split('.')[0]
                              .replace(/_/g, " ")
                              .replace(/-/g, " ");
                            setUploadTheme(filesArray.length === 1 ? nameWithoutExt : "Lote de Diretrizes");
                          }
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <UploadCloud className="w-8 h-8 mx-auto text-indigo-500 mb-2" />

                    {selectedBookFiles.length > 0 ? (
                      <div className="space-y-1">
                        <span className="block text-xs font-bold text-slate-800 truncate max-w-[220px] mx-auto">
                          {selectedBookFiles.length === 1 ? selectedBookFiles[0].name : `${selectedBookFiles.length} arquivos selecionados`}
                        </span>
                        <span className="block text-[10px] text-indigo-600 font-bold font-mono">
                          {(selectedBookFiles.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB total • Clique para alterar
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <span className="block text-xs font-bold text-slate-700">Clique ou arraste o arquivo aqui</span>
                        <span className="block text-[10px] text-slate-400">Suporta arquivos de texto .TXT, .PDF ou .CSV</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Consentimento LGPD para IA externa (PDF/imagem) */}
                {uploadNeedsExternalConsent && (
                  <label className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={externalAiConsent}
                      onChange={(e) => setExternalAiConsent(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 accent-amber-600 cursor-pointer"
                    />
                    <span className="text-[10px] leading-relaxed text-amber-900">
                      <strong>Autorizo o envio deste PDF/imagem a um provedor de IA externo</strong> para extração de texto. Confirmo que o documento não contém dados pessoais de clientes ou que possuo base legal e informei os titulares. O consentimento é registrado com meu e-mail e data.
                    </span>
                  </label>
                )}

                {/* Action button */}
                <button
                  type="button"
                  onClick={handleUploadBook}
                  disabled={uploadingBook || selectedBookFiles.length === 0 || (uploadNeedsExternalConsent && !externalAiConsent)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {uploadingBook ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Extraindo regras procedimentais...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{selectedBookFiles.length > 1 ? `Enviar Lote (${selectedBookFiles.length} arquivos)` : "Cadastrar e Extrair Diretrizes"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: GUIA DE PENALIDADES */}
      {activeSubTab === 'guia' && (
        <div className="space-y-5">
          {/* Quick Stats Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl text-center shadow-2xs">
              <span className="block text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider mb-0.5">
                Leve (-2 pts)
              </span>
              <span className="text-lg font-black text-emerald-900">
                {filteredGuia.filter(g => g.relevancia === 'LEVE').length} <span className="text-xs font-normal text-emerald-700">itens</span>
              </span>
            </div>

            <div className="bg-indigo-50/80 border border-indigo-200 p-3.5 rounded-xl text-center shadow-2xs">
              <span className="block text-[10px] text-indigo-700 font-extrabold uppercase tracking-wider mb-0.5">
                Moderada (-4 pts)
              </span>
              <span className="text-lg font-black text-indigo-900">
                {filteredGuia.filter(g => g.relevancia === 'MODERADA').length} <span className="text-xs font-normal text-indigo-700">itens</span>
              </span>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl text-center shadow-2xs">
              <span className="block text-[10px] text-amber-700 font-extrabold uppercase tracking-wider mb-0.5">
                Crítica (-10 pts)
              </span>
              <span className="text-lg font-black text-amber-900">
                {filteredGuia.filter(g => g.relevancia === 'CRÍTICA').length} <span className="text-xs font-normal text-amber-700">itens</span>
              </span>
            </div>

            <div className="bg-rose-50/80 border border-rose-200 p-3.5 rounded-xl text-center shadow-2xs">
              <span className="block text-[10px] text-rose-700 font-extrabold uppercase tracking-wider mb-0.5">
                Fatal (Zera Nota)
              </span>
              <span className="text-lg font-black text-rose-900">
                {filteredGuia.filter(g => g.relevancia.includes('FATAL')).length} <span className="text-xs font-normal text-rose-700">itens</span>
              </span>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Search */}
              <div className="relative w-full md:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar motivo ou palavra-chave..."
                  value={searchGuia}
                  onChange={(e) => setSearchGuia(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Bloco:</span>
                  <select
                    value={filterBloco}
                    onChange={(e) => setFilterBloco(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {["TODOS", ...blocos.map(b => b.nome)].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                  <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Gravidade:</span>
                  <select
                    value={filterRelevancia}
                    onChange={(e) => setFilterRelevancia(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {["TODOS", "LEVE", "MODERADA", "CRÍTICA", "PÊNALTI (ERRO FATAL)"].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSelectGuiaFile}
                  disabled={importingGuia}
                  className="bg-white hover:bg-indigo-50 disabled:opacity-50 text-indigo-700 text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-indigo-200 shadow-xs"
                  title="Importar planilha CSV, TSV ou XLSX"
                >
                  {importingGuia ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  <span>{importingGuia ? "Lendo..." : "Importar Planilha"}</span>
                </button>
                <input
                  ref={guiaFileInputRef}
                  type="file"
                  accept=".csv,.tsv,.xlsx"
                  className="hidden"
                  onChange={handleGuiaFileSelected}
                />

                <button
                  onClick={handleDownloadGuiaTemplate}
                  className="bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-xs"
                  title="Baixar modelo CSV com a matriz atual"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Modelo</span>
                </button>

                <button
                  onClick={() => setShowAddGuia(!showAddGuia)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Motivo</span>
                </button>

                <button
                  onClick={handleResetGuia}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200"
                  title="Restaurar lista original de motivos"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resetar Padrão</span>
                </button>
              </div>
            </div>

            {/* Collapsible Add Form */}
            {showAddGuia && (
              <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50 p-4 rounded-xl space-y-3.5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-indigo-600" />
                    <span>Cadastrar Novo Motivo de Penalidade</span>
                  </h4>
                  <button onClick={() => setShowAddGuia(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Bloco Metodológico</label>
                    <select 
                      value={newGuiaItem.bloco} 
                      onChange={(e) => setNewGuiaItem({ ...newGuiaItem, bloco: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {blocos.map(b => (
                        <option key={b.id || b.nome} value={b.nome}>{b.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Gravidade / Impacto</label>
                    <select 
                      value={newGuiaItem.relevancia} 
                      onChange={(e) => {
                        const rel = e.target.value as GuiaItem['relevancia'];
                        let pts = 2;
                        if (rel === 'MODERADA') pts = 4;
                        if (rel === 'CRÍTICA') pts = 10;
                        if (rel === 'PÊNALTI (ERRO FATAL)') pts = 100;
                        setNewGuiaItem({ ...newGuiaItem, relevancia: rel, scorePenalidade: pts });
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="LEVE">LEVE (-2 Pts)</option>
                      <option value="MODERADA">MODERADA (-4 Pts)</option>
                      <option value="CRÍTICA">CRÍTICA (-10 Pts)</option>
                      <option value="PÊNALTI (ERRO FATAL)">PÊNALTI (ZERA NOTA)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Dedução (Pontos)</label>
                    <input
                      type="number"
                      value={newGuiaItem.scorePenalidade}
                      onChange={(e) => setNewGuiaItem({ ...newGuiaItem, scorePenalidade: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Sub-tenant (BPO) Alvo</label>
                    <select
                      value={newGuiaItem.subtenantId}
                      onChange={(e) => setNewGuiaItem({ ...newGuiaItem, subtenantId: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="todos">Todos os BPOs (Global)</option>
                      {availableBpos.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Fila Alvo</label>
                    <select
                      value={newGuiaItem.queueName}
                      onChange={(e) => setNewGuiaItem({ ...newGuiaItem, queueName: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="todas">Todas as Filas (Geral)</option>
                      {availableQueues.map(q => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                      <option value="SAC_VOZ_HUMANO">SAC_VOZ_HUMANO</option>
                      <option value="RETENCAO_CHAT">RETENCAO_CHAT</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">
                    Ação corretiva (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Orientar o operador e reforçar o script de confirmação de dados"
                    value={newGuiaItem.acaoCorretiva}
                    onChange={(e) => setNewGuiaItem({ ...newGuiaItem, acaoCorretiva: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">
                    Motivo / Descrição do Erro na Gravação ou Chat
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Não realiza a confirmação de dados cadastrais obrigatórios"
                    value={newGuiaItem.motivoOriginal}
                    onChange={(e) => setNewGuiaItem({ ...newGuiaItem, motivoOriginal: e.target.value, motivoSimplificado: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddGuia(false)}
                    className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddGuiaItem}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
                  >
                    Salvar Item
                  </button>
                </div>
              </div>
            )}

            {/* Table Display */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <th className="p-3 text-center w-12">ID</th>
                      <th className="p-3 w-32">Bloco</th>
                      <th className="p-3 w-40">Escopo Alvo</th>
                      <th className="p-3 w-60">Gravidade & Penalidade</th>
                      <th className="p-3">Motivo / Infração do Manual</th>
                      <th className="p-3 text-right w-56">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredGuia.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 text-xs font-semibold">
                          Nenhum motivo de penalidade encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredGuia.map(g => {
                        const blockStyles = 
                          g.bloco.toLowerCase() === 'processo' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          g.bloco.toLowerCase() === 'conhecimento' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          g.bloco.toLowerCase() === 'sistemas' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                          'bg-purple-50 text-purple-700 border-purple-200';

                        const dotColor = 
                          g.relevancia.includes('FATAL') ? 'bg-rose-500' :
                          g.relevancia === 'CRÍTICA' ? 'bg-amber-500' :
                          g.relevancia === 'MODERADA' ? 'bg-indigo-500' : 'bg-emerald-500';

                        return (
                          <tr key={g.id} className="text-xs hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 text-center font-mono text-[10px] font-bold text-slate-400">
                              #{g.id}
                            </td>
                            <td className="p-3">
                              <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${blockStyles}`}>
                                {g.bloco}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col gap-1">
                                <span className="inline-block bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-200 uppercase truncate max-w-[130px]">
                                  🏢 {g.subtenantId || 'Todos'}
                                </span>
                                <span className="inline-block bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-200 uppercase truncate max-w-[130px]">
                                  🎧 {g.queueName || 'Todas'}
                                </span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 grow min-w-[120px]">
                                  <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                                  <select
                                    value={g.relevancia}
                                    onChange={(e) => handleUpdateGuiaItem(g.id, e.target.value as GuiaItem['relevancia'], g.scorePenalidade, g.subtenantId, g.queueName)}
                                    className={`w-full py-1 px-2 font-extrabold text-[10px] uppercase rounded-lg border border-slate-200 focus:outline-none cursor-pointer ${
                                      g.relevancia.includes('FATAL') ? 'text-rose-700 bg-rose-50' :
                                      g.relevancia === 'CRÍTICA' ? 'text-amber-700 bg-amber-50' :
                                      g.relevancia === 'MODERADA' ? 'text-indigo-700 bg-indigo-50' : 'text-emerald-700 bg-emerald-50'
                                    }`}
                                  >
                                    <option value="LEVE">LEVE</option>
                                    <option value="MODERADA">MODERADA</option>
                                    <option value="CRÍTICA">CRÍTICA</option>
                                    <option value="PÊNALTI (ERRO FATAL)">FATAL</option>
                                  </select>
                                </div>

                                <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateGuiaItem(g.id, g.relevancia, Math.max(0, g.scorePenalidade - 1), g.subtenantId, g.queueName)}
                                    className="w-5 h-5 rounded hover:bg-white text-slate-600 font-bold flex items-center justify-center text-xs transition-all cursor-pointer"
                                    title="Diminuir penalidade"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono font-bold text-[10px] text-slate-800 min-w-[32px] text-center">
                                    -{g.scorePenalidade}p
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateGuiaItem(g.id, g.relevancia, g.scorePenalidade + 1, g.subtenantId, g.queueName)}
                                    className="w-5 h-5 rounded hover:bg-white text-slate-600 font-bold flex items-center justify-center text-xs transition-all cursor-pointer"
                                    title="Aumentar penalidade"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <p className="font-bold text-slate-800 leading-snug">{g.motivoOriginal}</p>
                              {g.observacao && (
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug italic">{g.observacao}</p>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-start justify-end gap-2">
                                <p
                                  className={`text-[10px] leading-snug max-w-[150px] ${
                                    g.acaoCorretiva ? 'text-slate-600' : 'text-slate-300 italic'
                                  }`}
                                  title={g.acaoCorretiva || 'Sem ação corretiva definida'}
                                >
                                  {g.acaoCorretiva || 'Sem ação definida'}
                                </p>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleEditGuiaClick(g)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                    title="Editar motivo, bloco, escopo e ação"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteGuiaItem(g.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    title="Excluir desvio"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 border-t border-slate-200 p-2.5 text-right text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                Exibindo {filteredGuia.length} de {guiaItens.length} itens de penalidade
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: BLOCOS DA METODOLOGIA */}
      {activeSubTab === 'blocos' && (
        <div className="space-y-6">
          {/* Header & Metric Summary */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                    Blocos Metodológicos da Tenant
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                    {availableTenants.find(t => t.id === selectedTenant)?.name || selectedTenant}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Defina os pilares estratégicos de avaliação para esta tenant. O motor de Auto-QA utilizará estes blocos para categorizar desvios e calcular notas.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => {
                    setEditingBlocoId(null);
                    setBlocoForm({ nome: '', peso: 25, descricao: '', cor: 'indigo', ativo: true });
                    setShowBlocoModal(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Bloco</span>
                </button>

                <button
                  onClick={handleResetBlocos}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200"
                  title="Remover todos os pilares configurados"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Limpar Pilares</span>
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Blocos Ativos</span>
                  <span className="text-lg font-black text-slate-900 mt-0.5 block">
                    {blocos.filter(b => b.ativo !== false).length} de {blocos.length}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              <div className={`border p-4 rounded-xl flex items-center justify-between ${
                totalPesoBlocos === 100 
                  ? 'bg-emerald-50/70 border-emerald-200' 
                  : 'bg-amber-50/70 border-amber-200'
              }`}>
                <div>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${
                    totalPesoBlocos === 100 ? 'text-emerald-700' : 'text-amber-700'
                  }`}>Soma dos Pesos</span>
                  <span className={`text-lg font-black mt-0.5 block ${
                    totalPesoBlocos === 100 ? 'text-emerald-900' : 'text-amber-900'
                  }`}>
                    {totalPesoBlocos}% {totalPesoBlocos === 100 ? '(100% Calibrado)' : '(Atenção)'}
                  </span>
                </div>
                <div className={`p-2.5 rounded-xl border ${
                  totalPesoBlocos === 100 
                    ? 'bg-emerald-100/80 text-emerald-800 border-emerald-200' 
                    : 'bg-amber-100/80 text-amber-800 border-amber-200'
                }`}>
                  <Sliders className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Escopo da Tenant</span>
                  <span className="text-xs font-bold text-slate-800 mt-1 block truncate max-w-[180px]">
                    {availableTenants.find(t => t.id === selectedTenant)?.name || selectedTenant}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Cards Grid of Custom Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blocos.map((b) => {
              const theme = COLOR_MAP[b.cor || 'indigo'] || COLOR_MAP.indigo;
              return (
                <div 
                  key={b.id || b.nome}
                  className={`bg-white border ${theme.border} rounded-2xl p-5 shadow-xs relative overflow-hidden transition-all hover:shadow-md flex flex-col justify-between`}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${theme.accent}`} />

                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3 pt-1">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">{b.nome}</h4>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full font-mono ${theme.badge}`}>
                            {b.peso}% peso
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">
                          ID: {b.id}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditBlocoClick(b)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                          title="Editar bloco"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBloco(b)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="Excluir bloco"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/80 p-3 rounded-xl border border-slate-100 min-h-[50px]">
                      {b.descricao || "Sem descrição cadastrada. O motor de IA aplicará regras padrão do book."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">Status no Motor:</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        b.ativo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {b.ativo !== false ? '● Ativo em Auto-QA' : '○ Inativo'}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                      {guiaItens.filter(g => g.bloco.toLowerCase() === b.nome.toLowerCase()).length} regras no Guia
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL PARA ADICIONAR / EDITAR BLOCO METODOLÓGICO */}
      {showBlocoModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 text-left animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                  {editingBlocoId ? "Editar Bloco Metodológico" : "Novo Bloco Metodológico"}
                </h3>
              </div>
              <button 
                onClick={() => setShowBlocoModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">
                  Nome do Bloco Metodológico *
                </label>
                <input
                  type="text"
                  value={blocoForm.nome}
                  onChange={(e) => setBlocoForm({ ...blocoForm, nome: e.target.value })}
                  placeholder="Ex: Processo, Conhecimento, Atendimento Técnico, Compliance"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">
                    Peso na Nota Final (%) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={blocoForm.peso}
                    onChange={(e) => setBlocoForm({ ...blocoForm, peso: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">
                    Cor Visual do Pilar
                  </label>
                  <select
                    value={blocoForm.cor}
                    onChange={(e) => setBlocoForm({ ...blocoForm, cor: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="indigo">Indigo (Roxo Clássico)</option>
                    <option value="emerald">Emerald (Verde Menta)</option>
                    <option value="amber">Amber (Âmbar / Laranja)</option>
                    <option value="purple">Purple (Púrpura / Vinho)</option>
                    <option value="rose">Rose (Rosa / Coral)</option>
                    <option value="blue">Blue (Azul Profundo)</option>
                    <option value="cyan">Cyan (Ciano Técnico)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">
                  Instrução e Diretrizes de Avaliação para o Motor de IA (Gemini Auto-QA)
                </label>
                <textarea
                  rows={3}
                  value={blocoForm.descricao}
                  onChange={(e) => setBlocoForm({ ...blocoForm, descricao: e.target.value })}
                  placeholder="Descreva detalhadamente o que este bloco avalia para orientar os prompts de auditoria automatizada do Gemini..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="blocoAtivoChk"
                  checked={blocoForm.ativo}
                  onChange={(e) => setBlocoForm({ ...blocoForm, ativo: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="blocoAtivoChk" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Ativo e considerar na nota e auditorias de Auto-QA
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBlocoModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveBloco}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                {editingBlocoId ? "Salvar Alterações" : "Cadastrar Bloco"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT BOOK MODAL */}
      {editingBook && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 text-left animate-fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                  Editar Diretriz de Atendimento
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBook(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 grow">
              {/* Tema & Nome */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Tema do Manual / Assunto
                  </label>
                  <input
                    type="text"
                    value={editBookForm.theme}
                    onChange={(e) => setEditBookForm(prev => ({ ...prev, theme: e.target.value }))}
                    placeholder="Ex: Devoluções & Reembolso"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Nome do Documento / Identificador
                  </label>
                  <input
                    type="text"
                    value={editBookForm.name}
                    onChange={(e) => setEditBookForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: manual_sac_v2.pdf"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Scope Assignees: Canal, Sub-tenant (BPO), Fila */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Canal Aplicável
                  </label>
                  <select
                    value={editBookForm.channel}
                    onChange={(e) => setEditBookForm(prev => ({ ...prev, channel: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="todos">Todos os Canais (Voz e Chat)</option>
                    <option value="audio">Apenas Canal Voz (Telefone)</option>
                    <option value="chat">Apenas Canal Chat (WhatsApp/Web)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Sub-tenant (BPO)
                  </label>
                  <select
                    value={editBookForm.subtenantId}
                    onChange={(e) => setEditBookForm(prev => ({ ...prev, subtenantId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="todos">Todos os BPOs (Geral)</option>
                    {availableBpos.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Fila Alvo
                  </label>
                  <select
                    value={editBookForm.queueName}
                    onChange={(e) => setEditBookForm(prev => ({ ...prev, queueName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="todas">Todas as Filas (Geral)</option>
                    {availableQueues.map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                    <option value="SAC_VOZ_HUMANO">SAC_VOZ_HUMANO</option>
                    <option value="RETENCAO_CHAT">RETENCAO_CHAT</option>
                    <option value="VIP_OUVIDORIA">VIP_OUVIDORIA</option>
                  </select>
                </div>
              </div>

              {/* Content Textarea */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Conteúdo / Regras de Atendimento Extraídas
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {editBookForm.content.length} caracteres
                  </span>
                </div>
                <textarea
                  value={editBookForm.content}
                  onChange={(e) => setEditBookForm(prev => ({ ...prev, content: e.target.value }))}
                  rows={8}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
                  placeholder="Insira ou edite as regras, scripts e diretrizes..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setEditingBook(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingBook}
                onClick={handleSaveEditBook}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                {savingBook && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{savingBook ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORTAÇÃO DO GUIA DE PENALIDADES */}
      {importPreview && (
        <GuiaImportModal
          fileName={importPreview.fileName}
          plan={importPreview.plan}
          saving={savingImport}
          onCancel={() => {
            if (!savingImport) setImportPreview(null);
          }}
          onConfirm={handleConfirmGuiaImport}
          onDownloadTemplate={handleDownloadGuiaTemplate}
        />
      )}

      {/* EDIÇÃO COMPLETA DE UM MOTIVO */}
      {editingGuia && (
        <GuiaItemEditModal
          item={editingGuia}
          blocos={blocos}
          availableBpos={availableBpos}
          availableQueues={availableQueues}
          saving={savingGuiaEdit}
          onCancel={() => {
            if (!savingGuiaEdit) setEditingGuia(null);
          }}
          onSave={handleSaveGuiaEdit}
        />
      )}

      {/* CONFIRMATION MODAL */}
      </div>

      {confirmModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-left animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-150 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">{confirmModal.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
