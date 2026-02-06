import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Trash2, Plus, Download, Upload, Edit2, Check, X, Key, ShieldCheck, UserPlus, Users, Save } from 'lucide-react';
import { SettingItem, User, UserRole } from '../types';

export const SettingsPage: React.FC = () => {
  const { 
    settings, addSetting, removeSetting, updateSetting, 
    users, addUser, user: currentUser, changePassword, adminResetPassword,
    jobs, talents, candidates
  } = useData();
  
  const [newSettingName, setNewSettingName] = useState('');
  const [activeTab, setActiveTab] = useState<'SECTOR' | 'UNIT'>('SECTOR');
  
  // Estado de Criação de Usuário
  const [newUser, setNewUser] = useState({ 
    name: '', 
    username: '', 
    password: '', 
    role: 'RECRUITER' as UserRole 
  });

  // Estado de Troca de Senha (Pessoal)
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Estado de Reset de Senha (Admin)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [resetData, setResetData] = useState({ new: '', confirm: '' });
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Estado de Edição de Setores
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // --- CORREÇÃO DO MASTER: Garante que lê maiúsculo ou minúsculo ---
  const isMaster = currentUser?.role?.toUpperCase() === 'MASTER';

  // --- LÓGICA DE SETORES/UNIDADES ---
  const startEditing = (item: SettingItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEditing = (item: SettingItem) => {
    if (editingName.trim()) {
      updateSetting({ ...item, name: editingName });
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleAddSetting = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSettingName.trim()) {
      // Gera ID temporário (o backend pode substituir se quiser, mas UUID funciona bem)
      addSetting({
        id: crypto.randomUUID(),
        name: newSettingName,
        type: activeTab
      });
      setNewSettingName('');
    }
  };

  // --- LÓGICA DE SENHAS ---
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      setPasswordMsg({ type: 'error', text: 'A confirmação de senha não coincide.' });
      return;
    }
    const result = await changePassword(passwordData.current, passwordData.new);
    if (result.success) {
      setPasswordMsg({ type: 'success', text: result.message });
      setPasswordData({ current: '', new: '', confirm: '' });
    } else {
      setPasswordMsg({ type: 'error', text: result.message });
    }
  };

  const handleAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
