import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area
} from 'recharts';
import { 
  Activity, Droplets, Scale, Plus, Trash2, Brain, 
  Calendar, Info, AlertCircle, Heart, Download, LogOut, User, Lock, Mail
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { HealthRecord } from './types';
import { getHealthInsights } from './services/geminiService';

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`glass-card p-6 ${className}`}>
    {children}
  </div>
);

export default function App() {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'hypertension' | 'glycemia' | 'weight'>('hypertension');
  const [insights, setInsights] = useState<string | null>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    value1: '',
    value2: '',
    value3: '',
    notes: '',
    timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm")
  });

  useEffect(() => {
    const session = localStorage.getItem('bienestar_session');
    if (session) {
      setIsAuthenticated(true);
      fetchRecords();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchRecords = async () => {
    try {
      const token = localStorage.getItem('bienestar_session');
      const res = await fetch('/api/records', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setRecords(data);
      } else {
        console.error("Error fetching records:", data.error || 'Unknown error');
        setRecords([]);
        if (res.status === 401) {
          handleLogout();
        }
      }
    } catch (error) {
      console.error("Error fetching records:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (data.session) {
          localStorage.setItem('bienestar_session', data.session.access_token);
          setIsAuthenticated(true);
          fetchRecords();
        } else if (authMode === 'register') {
          setAuthError('Registro exitoso. Por favor, revisa tu correo para confirmar tu cuenta antes de iniciar sesión.');
        } else {
          setAuthError('Sesión no iniciada. Por favor, intenta de nuevo.');
        }
      } else {
        setAuthError(data.error || 'Error en la autenticación');
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError(`Error de conexión: ${error.message || 'Servidor no disponible'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bienestar_session');
    setIsAuthenticated(false);
    setRecords([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: HealthRecord = {
      type: activeTab,
      value1: parseFloat(formData.value1),
      value2: activeTab === 'hypertension' ? parseFloat(formData.value2) : undefined,
      value3: activeTab === 'hypertension' ? (formData.value3 ? parseFloat(formData.value3) : undefined) : undefined,
      notes: formData.notes,
      timestamp: new Date(formData.timestamp).toISOString()
    };

    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('bienestar_session')}`
        },
        body: JSON.stringify(newRecord)
      });
      if (res.ok) {
        fetchRecords();
        setFormData({ ...formData, value1: '', value2: '', value3: '', notes: '' });
      } else {
        const errorData = await res.json();
        const detailMsg = errorData.details ? `\nDetalles: ${JSON.stringify(errorData.details)}` : '';
        const hintMsg = errorData.hint ? `\nSugerencia: ${errorData.hint}` : '';
        const codeMsg = errorData.code ? `\nCódigo: ${errorData.code}` : '';
        alert(`Error al guardar: ${errorData.error || 'Error desconocido'}${codeMsg}${hintMsg}${detailMsg}`);
      }
    } catch (error) {
      console.error("Error saving record:", error);
      alert("Error de red al intentar guardar el registro.");
    }
  };

  const deleteRecord = async (id: number) => {
    try {
      await fetch(`/api/records/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('bienestar_session')}` }
      });
      fetchRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  const generateInsights = async () => {
    setIsGeneratingInsights(true);
    const text = await getHealthInsights(records);
    setInsights(text || "No se pudo generar el análisis.");
    setIsGeneratingInsights(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129); // Emerald-600
    doc.text('Reporte de Salud - Bienestar', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado el: ${format(new Date(), 'PPP p', { locale: es })}`, 14, 30);
    doc.text(`Usuario: ${authForm.email}`, 14, 35);

    // Table data
    const tableData = records.map(r => [
      format(new Date(r.timestamp), 'dd/MM/yyyy HH:mm'),
      r.type === 'hypertension' ? 'Presión Arterial' : r.type === 'glycemia' ? 'Glicemia' : 'Peso',
      r.type === 'hypertension' 
        ? `${r.value1}/${r.value2} mmHg${r.value3 ? ` (Pulso: ${r.value3})` : ''}` 
        : r.type === 'glycemia' ? `${r.value1} mg/dL` : `${r.value1} kg`,
      r.notes || '-'
    ]);

    doc.autoTable({
      startY: 45,
      head: [['Fecha', 'Tipo', 'Valor', 'Notas']],
      body: tableData,
      headStyles: { fillColor: [16, 185, 129] },
      alternateRowStyles: { fillColor: [245, 245, 240] },
    });

    // AI Insights if available
    if (insights) {
      const finalY = (doc as any).lastAutoTable.finalY || 150;
      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129);
      doc.text('Análisis IA Sugerido:', 14, finalY + 15);
      
      doc.setFontSize(10);
      doc.setTextColor(50);
      const splitText = doc.splitTextToSize(insights, 180);
      doc.text(splitText, 14, finalY + 22);
    }

    doc.save(`reporte-salud-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const filteredRecords = records
    .filter(r => r.type === activeTab)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const latestRecord = records.filter(r => r.type === activeTab)[0];

  const getStatusColor = (type: string, v1: number, v2?: number) => {
    if (type === 'hypertension') {
      if (v1 >= 140 || (v2 && v2 >= 90)) return 'text-red-500';
      if (v1 >= 120 || (v2 && v2 >= 80)) return 'text-amber-500';
      return 'text-emerald-500';
    }
    if (type === 'glycemia') {
      if (v1 > 125) return 'text-red-500';
      if (v1 > 100) return 'text-amber-500';
      return 'text-emerald-500';
    }
    return 'text-stone-600';
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 mx-auto mb-4">
              <Heart size={32} />
            </div>
            <h1 className="text-3xl font-bold text-stone-900">Bienestar</h1>
            <p className="text-stone-500 mt-2">Tu salud, bajo control.</p>
          </div>

          <Card>
            <div className="flex mb-6 border-b border-stone-100">
              <button 
                onClick={() => setAuthMode('login')}
                className={`flex-1 pb-3 text-sm font-bold transition-all ${authMode === 'login' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-stone-400'}`}
              >
                Iniciar Sesión
              </button>
              <button 
                onClick={() => setAuthMode('register')}
                className={`flex-1 pb-3 text-sm font-bold transition-all ${authMode === 'register' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-stone-400'}`}
              >
                Registrarse
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="email"
                    required
                    value={authForm.email}
                    onChange={e => setAuthForm({...authForm, email: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="password"
                    required
                    value={authForm.password}
                    onChange={e => setAuthForm({...authForm, password: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={16} />
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
              >
                {loading ? 'Procesando...' : authMode === 'login' ? 'Entrar' : 'Crear Cuenta'}
              </button>
            </form>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur-lg border-b border-stone-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Heart size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">Bienestar</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={exportPDF}
              disabled={records.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-full text-sm font-medium hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              Exportar PDF
            </button>
            <button 
              onClick={generateInsights}
              disabled={isGeneratingInsights || records.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-full text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              <Brain size={16} />
              {isGeneratingInsights ? 'Analizando...' : 'Análisis IA'}
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-stone-400 hover:text-red-500 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Insights Section */}
        <AnimatePresence>
          {insights && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-emerald-50 border-emerald-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <button onClick={() => setInsights(null)} className="text-emerald-600 hover:text-emerald-800">
                    <Plus className="rotate-45" size={20} />
                  </button>
                </div>
                <div className="flex gap-3 mb-4">
                  <Brain className="text-emerald-600" />
                  <h3 className="font-bold text-emerald-900">Análisis de Salud Inteligente</h3>
                </div>
                <div className="text-emerald-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {insights}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex p-1 bg-stone-200/50 rounded-2xl w-fit">
          {[
            { id: 'hypertension', label: 'Presión', icon: Activity },
            { id: 'glycemia', label: 'Glicemia', icon: Droplets },
            { id: 'weight', label: 'Peso', icon: Scale },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-stone-900 shadow-sm' 
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form and Stats */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Plus size={18} className="text-emerald-600" />
                Nuevo Registro
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                      {activeTab === 'hypertension' ? 'Sistólica' : activeTab === 'glycemia' ? 'mg/dL' : 'Peso (kg)'}
                    </label>
                    <input
                      type="number"
                      required
                      step="0.1"
                      value={formData.value1}
                      onChange={e => setFormData({...formData, value1: e.target.value})}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                  {activeTab === 'hypertension' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Diastólica</label>
                        <input
                          type="number"
                          required
                          value={formData.value2}
                          onChange={e => setFormData({...formData, value2: e.target.value})}
                          className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Pulso (bpm)</label>
                        <input
                          type="number"
                          value={formData.value3}
                          onChange={e => setFormData({...formData, value3: e.target.value})}
                          className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="Opcional"
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Fecha y Hora</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.timestamp}
                    onChange={e => setFormData({...formData, timestamp: e.target.value})}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Notas (Opcional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none h-20"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Guardar Registro
                </button>
              </form>
            </Card>

            {latestRecord && (
              <Card className="bg-stone-900 text-white border-none">
                <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Último Registro</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">
                    {latestRecord.value1}
                    {latestRecord.value2 ? `/${latestRecord.value2}` : ''}
                  </span>
                  <span className="text-stone-400 text-sm">
                    {activeTab === 'hypertension' ? 'mmHg' : activeTab === 'glycemia' ? 'mg/dL' : 'kg'}
                  </span>
                </div>
                <p className="text-stone-500 text-xs mt-2">
                  {format(new Date(latestRecord.timestamp), "d 'de' MMMM, HH:mm", { locale: es })}
                </p>
              </Card>
            )}
          </div>

          {/* Chart and History */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="h-[400px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold">Tendencia Histórica</h3>
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Calendar size={14} />
                  Últimos registros
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  {activeTab === 'weight' ? (
                    <AreaChart data={filteredRecords}>
                      <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(str) => format(new Date(str), 'dd MMM', { locale: es })}
                        fontSize={10}
                        tick={{ fill: '#a8a29e' }}
                      />
                      <YAxis fontSize={10} tick={{ fill: '#a8a29e' }} domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip 
                        labelFormatter={(str) => format(new Date(str), 'PPP p', { locale: es })}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Area type="monotone" dataKey="value1" name="Peso" stroke="#10b981" fillOpacity={1} fill="url(#colorWeight)" strokeWidth={3} />
                    </AreaChart>
                  ) : (
                    <LineChart data={filteredRecords}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(str) => format(new Date(str), 'dd MMM', { locale: es })}
                        fontSize={10}
                        tick={{ fill: '#a8a29e' }}
                      />
                      <YAxis fontSize={10} tick={{ fill: '#a8a29e' }} />
                      <Tooltip 
                        labelFormatter={(str) => format(new Date(str), 'PPP p', { locale: es })}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend iconType="circle" />
                      {activeTab === 'hypertension' ? (
                        <>
                          <Line type="monotone" dataKey="value1" name="Sistólica" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="value2" name="Diastólica" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="value3" name="Pulso" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                        </>
                      ) : (
                        <Line type="monotone" dataKey="value1" name="Glicemia" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} activeDot={{ r: 6 }} />
                      )}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="font-bold mb-6">Historial de Registros</h3>
              <div className="space-y-3">
                {records.filter(r => r.type === activeTab).length === 0 ? (
                  <div className="text-center py-12 text-stone-400">
                    <AlertCircle className="mx-auto mb-2 opacity-20" size={48} />
                    <p>No hay registros para esta categoría.</p>
                  </div>
                ) : (
                  records
                    .filter(r => r.type === activeTab)
                    .map((record) => (
                      <div 
                        key={record.id}
                        className="group flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100 hover:border-emerald-200 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center text-[10px] font-bold ${getStatusColor(record.type, record.value1, record.value2)} bg-white shadow-sm`}>
                            <span>{record.value1}</span>
                            {record.value2 && <span className="border-t border-stone-100 w-full text-center">{record.value2}</span>}
                            {record.value3 && <span className="border-t border-stone-100 w-full text-center text-emerald-600">{record.value3}</span>}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-stone-900">
                              {format(new Date(record.timestamp), "d 'de' MMMM, HH:mm", { locale: es })}
                            </p>
                            {record.notes && <p className="text-xs text-stone-500 mt-0.5 italic">"{record.notes}"</p>}
                          </div>
                        </div>
                        <button 
                          onClick={() => record.id && deleteRecord(record.id)}
                          className="p-2 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 border-t border-stone-200">
        <div className="flex items-start gap-3 text-xs text-stone-400 bg-stone-100 p-4 rounded-xl">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p>
            <strong>Descargo de responsabilidad:</strong> Esta aplicación es una herramienta de seguimiento personal y no sustituye el consejo médico profesional, diagnóstico o tratamiento. Siempre busque el consejo de su médico u otro proveedor de salud calificado con cualquier pregunta que pueda tener con respecto a una condición médica.
          </p>
        </div>
      </footer>
    </div>
  );
}
