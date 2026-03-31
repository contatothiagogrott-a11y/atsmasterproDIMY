import React, { useState, useMemo, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Calendar as CalendarIcon, Plus, Save, Settings2, Trash2, Edit3, DollarSign, Building2, X } from 'lucide-react'; // <--- O "X" AGORA ESTÁ AQUI
import { SettingItem } from '../types';

export const GestaoRefeitorio: React.FC = () => {
  const { 
    user, hasPermission, settings, addSetting, updateSetting, removeSetting,
    refeitorioRecords = [], addRefeitorioRecord, updateRefeitorioRecord 
  } = useData() as any;

  if (!hasPermission('REFEITORIO', 'VIEW')) {
    return <Navigate to="/" replace />;
  }

  const canEdit = hasPermission('REFEITORIO', 'EDIT_BASIC');

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  const [selectedUnit, setSelectedUnit] = useState('Geral');

  const activeUnits = useMemo(() => {
    return settings.filter((s: SettingItem) => s.type === 'UNIT').map((s: SettingItem) => s.name).sort();
  }, [settings]);

  const products = useMemo(() => {
    return settings
      .filter((s: SettingItem) => s.type === 'REFEITORIO_PRODUCT')
      .map((s: SettingItem) => {
        const parsed = JSON.parse(s.value || '{}');
        return { id: s.id, name: s.name, unitPrice: parsed.unitPrice || 0 };
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [settings]);

  const [localQuantities, setLocalQuantities] = useState<Record<string, Record<string, number>>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadedData: Record<string, Record<string, number>> = {};
    
    refeitorioRecords.forEach((record: any) => {
      const recordUnit = record.unit || 'Geral'; 
      
      if (recordUnit === selectedUnit) {
        loadedData[record.date] = record.quantities;
      }
    });
    
    setLocalQuantities(loadedData);
  }, [refeitorioRecords, selectedUnit]);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<{id?: string, name: string, unitPrice: number} | null>(null);

  const daysInRange = useMemo(() => {
    const days: string[] = [];
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  }, [startDate, endDate]);

  const handleQuantityChange = (date: string, productId: string, value: string) => {
    if (!canEdit) return;
    const qty = parseInt(value, 10);
    const validQty = isNaN(qty) ? 0 : qty;

    setLocalQuantities(prev => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [productId]: validQty
      }
    }));
  };

  const getQuantity = (date: string, productId: string) => {
    return localQuantities[date]?.[productId] || 0;
  };

  const handleSaveMonth = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    
    try {
      for (const date of daysInRange) {
        const qtyForDay = localQuantities[date] || {};
        const hasData = Object.values(qtyForDay).some(val => val > 0);
        const existingRecord = refeitorioRecords.find((r: any) => r.date === date && (r.unit || 'Geral') === selectedUnit);

        if (hasData || existingRecord) {
          const recordToSave = {
            id: existingRecord?.id || crypto.randomUUID(),
            date,
            unit: selectedUnit, 
            quantities: qtyForDay
          };

          if (existingRecord) {
            await updateRefeitorioRecord(recordToSave);
          } else {
            await addRefeitorioRecord(recordToSave);
          }
        }
      }
      alert('✅ Fechamento da unidade salvo com sucesso no banco de dados!');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar os dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const getDayTotal = (date: string) => {
    return products.reduce((acc: number, product: any) => {
      const qty = getQuantity(date, product.id);
      return acc + (qty * product.unitPrice);
    }, 0);
  };

  const getProductTotalQty = (productId: string) => {
    return daysInRange.reduce((acc, date) => acc + getQuantity(date, productId), 0);
  };

  const getProductTotalValue = (productId: string) => {
    const product = products.find((p: any) => p.id === productId);
    if (!product) return 0;
    return getProductTotalQty(productId) * product.unitPrice;
  };

  const grandTotal = daysInRange.reduce((acc, date) => acc + getDayTotal(date), 0);

  const formatMoney = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !canEdit) return;

    const valueStr = JSON.stringify({ unitPrice: editingProduct.unitPrice });

    if (editingProduct.id) {
      const originalSetting = settings.find((s: SettingItem) => s.id === editingProduct.id);
      if (originalSetting) {
        await updateSetting({ ...originalSetting, name: editingProduct.name, value: valueStr });
      }
    } else {
      await addSetting({ id: crypto.randomUUID(), type: 'REFEITORIO_PRODUCT', name: editingProduct.name, value: valueStr });
    }
    
    setEditingProduct(null);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!canEdit) return;
    if (confirm("ATENÇÃO: Apagar este produto fará com que os valores antigos dele sumam das planilhas. Tem certeza?")) {
      await removeSetting(id);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
           <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
             <CalendarIcon className="text-blue-600" /> Fechamento de Refeitório
           </h1>
           <p className="text-sm text-slate-500 font-medium mt-1">Controle diário de consumos e faturamento.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          
          <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded-xl border border-indigo-200">
            <Building2 size={16} className="text-indigo-600 ml-1" />
            <select 
               className="bg-transparent text-sm font-bold text-indigo-900 outline-none cursor-pointer pr-2"
               value={selectedUnit}
               onChange={e => setSelectedUnit(e.target.value)}
            >
               <option value="Geral">Sede / Geral</option>
               {activeUnits.map((u: string) => (
                  <option key={u} value={u}>{u}</option>
               ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase px-2">Período:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
            />
            <span className="text-slate-300">até</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
            />
          </div>

          {canEdit && (
            <>
              <button 
                onClick={() => setIsProductModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm border border-slate-200"
              >
                <Settings2 size={16} /> Produtos e Preços
              </button>

              <button 
                onClick={handleSaveMonth}
                disabled={isSaving}
                className={`flex items-center gap-2 px-6 py-2.5 text-white font-bold rounded-xl shadow-md transition-all text-sm ${isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
              >
                <Save size={16} /> {isSaving ? 'Salvando...' : 'Salvar Fechamento'}
              </button>
            </>
          )}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
           <h3 className="text-lg font-bold text-slate-700 mb-2">Nenhum produto cadastrado!</h3>
           <p className="text-slate-500 mb-6">Para iniciar o controle, adicione os produtos (ex: Almoço, Café, Leite) e seus valores.</p>
           {canEdit && (
             <button onClick={() => setIsProductModalOpen(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-md">Cadastrar Primeiro Produto</button>
           )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar max-h-[65vh]">
            <table className="w-full text-sm text-center border-collapse min-w-max">
              <thead className="bg-slate-800 text-white sticky top-0 z-20 shadow-md">
                <tr>
                  <th className="p-3 border-b border-r border-slate-700 sticky left-0 bg-slate-900 z-30 w-24">Data</th>
                  {products.map((product: any) => (
                    <th key={product.id} colSpan={2} className="p-2 border-b border-r border-slate-700">
                      <div className="font-bold text-sm truncate max-w-[120px] mx-auto" title={product.name}>{product.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{formatMoney(product.unitPrice)}/un</div>
                    </th>
                  ))}
                  <th className="p-3 border-b border-slate-700 bg-slate-900 font-black text-emerald-400">Total/Dia</th>
                </tr>
                <tr className="bg-slate-700 text-slate-300 text-[10px] uppercase tracking-widest">
                  <th className="p-1 border-b border-r border-slate-600 sticky left-0 bg-slate-800 z-30">Dia</th>
                  {products.map((product: any) => (
                    <React.Fragment key={`sub-${product.id}`}>
                      <th className="p-1.5 border-b border-r border-slate-600 w-20 bg-slate-700/50">Qtd</th>
                      <th className="p-1.5 border-b border-r border-slate-600 w-24">Valor</th>
                    </React.Fragment>
                  ))}
                  <th className="p-1.5 border-b border-slate-600 bg-slate-800">R$</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-100">
                {daysInRange.map(date => {
                  const dayNum = parseInt(date.split('-')[2], 10);
                  const dayTotal = getDayTotal(date);
                  
                  return (
                    <tr key={date} className="hover:bg-blue-50/50 transition-colors group">
                      <td className="p-2 border-r border-slate-100 sticky left-0 bg-white group-hover:bg-blue-50/50 font-bold text-slate-500">
                        {dayNum.toString().padStart(2, '0')}
                      </td>
                      
                      {products.map((product: any) => {
                        const qty = getQuantity(date, product.id);
                        const val = qty * product.unitPrice;
                        
                        return (
                          <React.Fragment key={`${date}-${product.id}`}>
                            <td className="p-1 border-r border-slate-100 bg-slate-50/50">
                              <input 
                                type="number"
                                min="0"
                                disabled={!canEdit}
                                className={`w-full bg-transparent text-center font-bold outline-none rounded px-1 py-1 ${canEdit ? 'text-slate-700 focus:ring-2 focus:ring-blue-500' : 'text-slate-500 cursor-not-allowed'}`}
                                value={qty === 0 ? '' : qty}
                                onChange={(e) => handleQuantityChange(date, product.id, e.target.value)}
                                placeholder="-"
                              />
                            </td>
                            <td className={`p-2 border-r border-slate-100 text-right pr-4 font-medium ${val > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                              {val > 0 ? formatMoney(val) : '-'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      
                      <td className={`p-2 font-black text-right pr-4 border-l-2 border-slate-200 ${dayTotal > 0 ? 'text-blue-700 bg-blue-50/30' : 'text-slate-300'}`}>
                        {dayTotal > 0 ? formatMoney(dayTotal) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className="bg-red-600 text-white font-black text-sm relative z-20">
                <tr>
                  <td className="p-3 border-r border-red-500 sticky left-0 bg-red-700 z-30">TOTAIS</td>
                  {products.map((product: any) => (
                    <React.Fragment key={`total-${product.id}`}>
                      <td className="p-3 border-r border-red-500 text-center bg-red-700/50">
                        {getProductTotalQty(product.id) || '-'}
                      </td>
                      <td className="p-3 border-r border-red-500 text-right pr-4">
                        {getProductTotalValue(product.id) > 0 ? formatMoney(getProductTotalValue(product.id)) : '-'}
                      </td>
                    </React.Fragment>
                  ))}
                  <td className="p-3 text-right pr-4 bg-red-700 text-lg">
                    {formatMoney(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURAÇÃO DE PRODUTOS E PREÇOS */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                <Settings2 className="text-blue-600"/> Gerenciar Produtos
              </h3>
              <button onClick={() => {setIsProductModalOpen(false); setEditingProduct(null);}} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6">
              <form onSubmit={handleSaveProduct} className="flex gap-2 items-end bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Nome (Produto/Serviço)</label>
                  <input required className="w-full border border-blue-200 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-700" placeholder="Ex: Marmitex Extra" value={editingProduct?.name || ''} onChange={e => setEditingProduct({ ...(editingProduct as any), name: e.target.value })} />
                </div>
                <div className="w-32">
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Preço (R$)</label>
                  <input required type="number" step="0.01" className="w-full border border-blue-200 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-700" value={editingProduct?.unitPrice || ''} onChange={e => setEditingProduct({ ...(editingProduct as any), unitPrice: parseFloat(e.target.value) })} />
                </div>
                <button type="submit" className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 font-bold text-sm px-4 transition-colors">
                  {editingProduct?.id ? 'Salvar' : 'Add'}
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {products.map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center p-3 border border-slate-200 rounded-xl hover:border-blue-300 transition-colors">
                    <div>
                      <span className="font-bold text-slate-700 block">{p.name}</span>
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><DollarSign size={12}/> {formatMoney(p.unitPrice)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingProduct(p)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={16}/></button>
                      <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};