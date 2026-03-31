import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, Plus, Save, Settings2, Trash2, Edit3, DollarSign } from 'lucide-react';

// --- TIPAGENS ---
interface Product {
  id: string;
  name: string;
  unitPrice: number;
}

interface DailyRecord {
  date: string; // Formato YYYY-MM-DD
  quantities: Record<string, number>; // { 'prod-1': 90, 'prod-2': 8 }
}

export const GestaoRefeitorio: React.FC = () => {
  // --- ESTADOS INICIAIS ---
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  // Produtos baseados na sua imagem (Preços unitários calculados reversamente)
  const [products, setProducts] = useState<Product[]>([
    { id: 'p1', name: 'Almoços', unitPrice: 18.51 }, // 1665.90 / 90
    { id: 'p2', name: 'Lanches', unitPrice: 10.00 },
    { id: 'p3', name: 'Café', unitPrice: 5.09 },     // 40.72 / 8
    { id: 'p4', name: 'Leite', unitPrice: 11.73 },   // 23.46 / 2
    { id: 'p5', name: 'Coffee I', unitPrice: 25.00 },
  ]);

  const [records, setRecords] = useState<DailyRecord[]>([]);
  
  // Estados para o Modal de Produtos
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // --- LÓGICA DE DATAS ---
  const daysInRange = useMemo(() => {
    const days: string[] = [];
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  }, [startDate, endDate]);

  // --- HANDLERS ---
  const handleQuantityChange = (date: string, productId: string, value: string) => {
    const qty = parseInt(value, 10);
    const validQty = isNaN(qty) ? 0 : qty;

    setRecords(prev => {
      const existingDayIndex = prev.findIndex(r => r.date === date);
      if (existingDayIndex >= 0) {
        const newRecords = [...prev];
        newRecords[existingDayIndex] = {
          ...newRecords[existingDayIndex],
          quantities: {
            ...newRecords[existingDayIndex].quantities,
            [productId]: validQty
          }
        };
        return newRecords;
      } else {
        return [...prev, { date, quantities: { [productId]: validQty } }];
      }
    });
  };

  const getQuantity = (date: string, productId: string) => {
    const record = records.find(r => r.date === date);
    return record?.quantities[productId] || 0;
  };

  // --- CÁLCULOS DE TOTAIS ---
  const getDayTotal = (date: string) => {
    const record = records.find(r => r.date === date);
    if (!record) return 0;
    
    return products.reduce((acc, product) => {
      const qty = record.quantities[product.id] || 0;
      return acc + (qty * product.unitPrice);
    }, 0);
  };

  const getProductTotalQty = (productId: string) => {
    return daysInRange.reduce((acc, date) => acc + getQuantity(date, productId), 0);
  };

  const getProductTotalValue = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    return getProductTotalQty(productId) * product.unitPrice;
  };

  const grandTotal = daysInRange.reduce((acc, date) => acc + getDayTotal(date), 0);

  // Formatação monetária BRL
  const formatMoney = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      if (products.some(p => p.id === editingProduct.id)) {
        setProducts(products.map(p => p.id === editingProduct.id ? editingProduct : p));
      } else {
        setProducts([...products, { ...editingProduct, id: crypto.randomUUID() }]);
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      
      {/* HEADER E CONTROLES */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
           <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
             <CalendarIcon className="text-blue-600" /> Fechamento de Refeitório
           </h1>
           <p className="text-sm text-slate-500 font-medium mt-1">Controle diário de consumos e faturamento.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
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

          <button 
            onClick={() => setIsProductModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
          >
            <Settings2 size={16} /> Produtos e Preços
          </button>

          <button 
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
            onClick={() => alert('Aqui você conectará com a sua função do DataContext para salvar os dados no BD!')}
          >
            <Save size={16} /> Salvar Mês
          </button>
        </div>
      </div>

      {/* PLANILHA DINÂMICA */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-center border-collapse min-w-max">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-3 border-b border-r border-slate-700 sticky left-0 bg-slate-900 z-10 w-24">Data</th>
                {products.map(product => (
                  <th key={product.id} colSpan={2} className="p-2 border-b border-r border-slate-700">
                    <div className="font-bold text-sm">{product.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{formatMoney(product.unitPrice)}/un</div>
                  </th>
                ))}
                <th className="p-3 border-b border-slate-700 bg-slate-900 font-black text-emerald-400">Total/Dia</th>
              </tr>
              <tr className="bg-slate-700 text-slate-300 text-[10px] uppercase tracking-widest">
                <th className="p-1 border-b border-r border-slate-600 sticky left-0 bg-slate-800 z-10">Dia</th>
                {products.map(product => (
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
                    
                    {products.map(product => {
                      const qty = getQuantity(date, product.id);
                      const val = qty * product.unitPrice;
                      
                      return (
                        <React.Fragment key={`${date}-${product.id}`}>
                          <td className="p-1 border-r border-slate-100 bg-slate-50/50">
                            <input 
                              type="number"
                              min="0"
                              className="w-full bg-transparent text-center font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 py-1"
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

            {/* RODAPÉ COM TOTAIS (LINHA VERMELHA DA SUA PLANILHA) */}
            <tfoot className="bg-red-600 text-white font-black text-sm">
              <tr>
                <td className="p-3 border-r border-red-500 sticky left-0 bg-red-700">TOTAIS</td>
                {products.map(product => (
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

      {/* MODAL: CONFIGURAÇÃO DE PRODUTOS E PREÇOS */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                <Settings2 className="text-blue-600"/> Gerenciar Produtos
              </h3>
              <button onClick={() => {setIsProductModalOpen(false); setEditingProduct(null);}} className="text-slate-400 hover:text-slate-600"><Trash2 size={20} className="hidden" /> Fechar</button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Formulário de Adição/Edição */}
              <form onSubmit={handleSaveProduct} className="flex gap-2 items-end bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Nome do Produto/Serviço</label>
                  <input required className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Ex: Marmitex Extra" value={editingProduct?.name || ''} onChange={e => setEditingProduct({ ...(editingProduct as Product), name: e.target.value })} />
                </div>
                <div className="w-32">
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Preço Unitário (R$)</label>
                  <input required type="number" step="0.01" className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={editingProduct?.unitPrice || ''} onChange={e => setEditingProduct({ ...(editingProduct as Product), unitPrice: parseFloat(e.target.value) })} />
                </div>
                <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 font-bold text-sm px-4 h-[38px]">
                  {editingProduct?.id ? 'Salvar' : 'Adicionar'}
                </button>
              </form>

              {/* Lista de Produtos Existentes */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {products.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 border border-slate-200 rounded-xl hover:border-blue-300 transition-colors">
                    <div>
                      <span className="font-bold text-slate-700 block">{p.name}</span>
                      <span className="text-xs font-medium text-emerald-600 flex items-center gap-1"><DollarSign size={12}/> {formatMoney(p.unitPrice)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingProduct(p)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={16}/></button>
                      <button onClick={() => setProducts(products.filter(prod => prod.id !== p.id))} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
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