import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, updateDoc, doc, deleteDoc, where } from 'firebase/firestore';
import {
  Plus, CheckCircle2, Circle, Trash2, Calendar,
  ListTodo, X, Edit3, Check, Loader2, Search, ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CryptoJS from 'crypto-js';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';

const Tasks = () => {
  const { user, activeCompany, getTenantCollection, getTenantDoc } = useUser();
  const { t, viewSettings, isMobile, density } = useTheme();
  const rawScale = density / 100;
  const modalScale = isMobile ? 1 : rawScale;

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  const [taskForm, setTaskForm] = useState({
    title: '', description: '', start: '', end: '', subtasks: [], assignedTo: []
  });

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('todas'); // 'todas', 'pendentes', 'concluidas'
  const [sortOption, setSortOption] = useState('default');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showItemsMenu, setShowItemsMenu] = useState(false);

  const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'crm-ultra-secret-key-2026';
  const decrypt = (val) => {
    if (!val) return '';
    try {
      const bytes = CryptoJS.AES.decrypt(val, SECRET_KEY);
      const original = bytes.toString(CryptoJS.enc.Utf8);
      return original || val;
    } catch (e) { return val; }
  };

  useEffect(() => {
    if (!user) return;

    const unsubTasks = onSnapshot(getTenantCollection('tasks'), (s) =>
      setTasks(s.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );

    const targetCompany = activeCompany || user.empresa;

    const unsubUsers = onSnapshot(query(collection(db, 'users'), where('empresa', '==', targetCompany)), (s) => {
      const activeUsers = s.docs
        .map(d => {
          const data = d.data();
          const isActive = data.active === undefined || decrypt(data.active) === 'true' || data.active === true;
          return {
            id: d.id,
            name: data.nome,
            active: isActive
          };
        })
        .filter(u => u.active);
      setEmployees(activeUsers);
    });

    return () => {
      unsubTasks();
      unsubUsers();
    };
  }, [user, activeCompany]);

  // Lock scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showModal]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  const addSubtaskToList = () => {
    if (!newSubtask.trim()) return;
    setTaskForm({ ...taskForm, subtasks: [...taskForm.subtasks, { text: newSubtask.trim(), completed: false }] });
    setNewSubtask('');
  };

  const toggleEmployee = (id) => {
    if (id === user?.id) return; // Cannot toggle self
    const current = taskForm.assignedTo || [];
    setTaskForm({ ...taskForm, assignedTo: current.includes(id) ? current.filter(i => i !== id) : [...current, id] });
  };

  const assignEveryone = () => {
    const allIds = employees.map(e => e.id);
    const current = taskForm.assignedTo || [];
    if (current.length === allIds.length) {
      setTaskForm({ ...taskForm, assignedTo: user?.id ? [user.id] : [] });
    } else {
      setTaskForm({ ...taskForm, assignedTo: allIds });
    }
  };

  const handleOpenModal = (task = null) => {
    if (task) {
      setEditingId(task.id);
      setTaskForm({ ...task });
      setIsReadOnly(true);
    } else {
      setEditingId(null);
      setTaskForm({ title: '', description: '', start: '', end: '', subtasks: [], assignedTo: user?.id ? [user.id] : [] });
      setIsReadOnly(false);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    setSaving(true);
    try {
      const finalAssignedTo = Array.from(new Set([...(taskForm.assignedTo || []), user.id]));
      const dataToSave = {
        ...taskForm,
        assignedTo: finalAssignedTo
      };
      if (editingId) {
        await updateDoc(getTenantDoc('tasks', editingId), {
          ...dataToSave,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(getTenantCollection('tasks'), {
          ...dataToSave,
          status: 'pending',
          createdAt: new Date().toISOString(),
          creatorId: user.id
        });
      }
      setShowModal(false);
      setTaskForm({ title: '', description: '', start: '', end: '', subtasks: [], assignedTo: [] });
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar tarefa.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Excluir esta tarefa permanentemente?')) {
      try {
        await deleteDoc(getTenantDoc('tasks', id));
        setShowModal(false);
      } catch (err) {
        alert('Erro ao excluir tarefa.');
      }
    }
  };

  const updateTaskStatus = async (taskId, subtaskIdx) => {
    const task = tasks.find(t => t.id === taskId);
    const updatedSubtasks = [...task.subtasks];
    updatedSubtasks[subtaskIdx].completed = !updatedSubtasks[subtaskIdx].completed;

    const allDone = updatedSubtasks.every(s => s.completed);
    await updateDoc(getTenantDoc('tasks', taskId), {
      subtasks: updatedSubtasks,
      status: allDone ? 'completed' : 'pending'
    });
  };

  // Memoized task filtering and sorting
  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    // Filter by task access (only assigned users or creator can see the task, unless the user is admin or developer)
    const isPowerUser = user?.funcao === 'admin' || user?.funcao === 'developer';
    if (!isPowerUser && user?.id) {
      list = list.filter(t => {
        const isCreator = t.creatorId === user.id;
        const isAssigned = (t.assignedTo || []).includes(user.id);
        return isCreator || isAssigned;
      });
    }

    // Filter by Active Tab
    if (activeTab === 'pendentes') {
      list = list.filter(t => t.status === 'pending' || t.status === undefined);
    } else if (activeTab === 'concluidas') {
      list = list.filter(t => t.status === 'completed');
    }

    // Filter by Search Query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => {
        const titleMatch = (t.title || '').toLowerCase().includes(q);
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const employeeMatch = (t.assignedTo || []).some(empId => {
          const emp = employees.find(e => e.id === empId);
          return emp && emp.name.toLowerCase().includes(q);
        });
        return titleMatch || descMatch || employeeMatch;
      });
    }

    // Sorting
    if (sortOption === 'name-asc') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sortOption === 'name-desc') {
      list.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    } else if (sortOption === 'deadline-asc') {
      list.sort((a, b) => {
        if (!a.end) return 1;
        if (!b.end) return -1;
        return new Date(a.end) - new Date(b.end);
      });
    } else if (sortOption === 'deadline-desc') {
      list.sort((a, b) => {
        if (!a.end) return 1;
        if (!b.end) return -1;
        return new Date(b.end) - new Date(a.end);
      });
    } else {
      // Default: newest first
      list.sort((a, b) => {
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
    }

    return list;
  }, [tasks, activeTab, searchQuery, sortOption, employees, user]);

  // Pagination calculations
  const totalItems = filteredTasks.length;
  const paginatedTasks = useMemo(() => {
    if (itemsPerPage === 'all') return filteredTasks;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTasks.slice(start, start + itemsPerPage);
  }, [filteredTasks, currentPage, itemsPerPage]);

  const renderTaskList = (items) => (
    <div style={{ backgroundColor: t.bg, border: t.borderBold, borderRadius: t.radiusMedium, overflowX: 'auto', boxShadow: t.shadowSmall }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
        <thead>
          <tr style={{ backgroundColor: t.bgSecondary, borderBottom: t.borderBold }}>
            <th style={{ padding: '1.25rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Tarefa</th>
            <th style={{ padding: '1.25rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Responsáveis</th>
            <th style={{ padding: '1.25rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Checklist</th>
            <th style={{ padding: '1.25rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Prazo</th>
            <th style={{ padding: '1.25rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: t.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map(task => {
            const completedSubtasks = (task.subtasks || []).filter(s => s.completed).length;
            const totalSubtasks = (task.subtasks || []).length;
            const isOverdue = task.end && new Date(task.end) < new Date() && task.status !== 'completed';

            return (
              <tr
                key={task.id}
                onClick={() => handleOpenModal(task)}
                style={{ borderBottom: t.border, cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = t.bgSecondary}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={{ padding: '1.25rem 1rem' }}>
                  <div style={{ fontWeight: 700, color: t.textMain, fontSize: '0.95rem' }}>{task.title}</div>
                  <div style={{ color: t.textSecondary, fontSize: '0.8rem', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                    {task.description || 'Sem descrição'}
                  </div>
                </td>
                <td style={{ padding: '1.25rem 1rem' }}>
                  <div style={{ display: 'flex', marginLeft: '6px' }}>
                    {(task.assignedTo || []).length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: t.textSecondary, fontWeight: 500 }}>Nenhum</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {(task.assignedTo || []).slice(0, 3).map((userId, i) => {
                          const emp = employees.find(e => e.id === userId);
                          const initial = emp ? emp.name[0].toUpperCase() : '?';
                          return (
                            <div
                              key={`assigned-${i}-${userId}`}
                              style={{
                                width: '28px',
                                height: '28px',
                                backgroundColor: t.bgSecondary,
                                border: `2px solid ${t.bg}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: t.textMain,
                                marginLeft: i > 0 ? '-8px' : '0',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                zIndex: 10 - i
                              }}
                              title={emp?.name}
                            >
                              {initial}
                            </div>
                          );
                        })}
                        {(task.assignedTo || []).length > 3 && (
                          <div style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: t.accentSoft,
                            border: `2px solid ${t.bg}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: t.accent,
                            marginLeft: '-8px',
                            zIndex: 5
                          }}>
                            +{(task.assignedTo || []).length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ padding: '1.25rem 1rem' }}>
                  {totalSubtasks === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: t.textSecondary, fontWeight: 500 }}>Nenhum item</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '140px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: t.textMain }}>
                        <span>{completedSubtasks}/{totalSubtasks}</span>
                        <span>{Math.round((completedSubtasks / totalSubtasks) * 100)}%</span>
                      </div>
                      <div style={{ width: '100%', height: '5px', backgroundColor: t.bgSecondary, borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%`, height: '100%', backgroundColor: t.success, borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
                      </div>
                    </div>
                  )}
                </td>
                <td style={{ padding: '1.25rem 1rem' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: isOverdue ? t.danger : t.textSecondary,
                    backgroundColor: isOverdue ? `${t.danger}15` : 'transparent',
                    padding: isOverdue ? '4px 10px' : '0',
                    borderRadius: '20px'
                  }}>
                    <Calendar size={14} />
                    <span>{task.end ? new Date(task.end).toLocaleDateString('pt-BR') : 'Sem prazo'}</span>
                  </div>
                </td>
                <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '100px',
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    backgroundColor: task.status === 'completed' ? '#f0fdf4' : (isOverdue ? '#fff1f2' : '#eff6ff'),
                    color: task.status === 'completed' ? '#166534' : (isOverdue ? '#9f1239' : '#1e40af'),
                    border: `1px solid ${task.status === 'completed' ? '#bbf7d0' : (isOverdue ? '#fecdd3' : '#bfdbfe')}`
                  }}>
                    {task.status === 'completed' ? 'Concluída' : (isOverdue ? 'Atrasada' : 'Pendente')}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderTaskCard = (task) => {
    const completedSubtasks = (task.subtasks || []).filter(s => s.completed).length;
    const totalSubtasks = (task.subtasks || []).length;
    const isOverdue = task.end && new Date(task.end) < new Date() && task.status !== 'completed';

    return (
      <motion.div
        key={task.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={() => handleOpenModal(task)}
        style={{
          backgroundColor: t.bg,
          border: isOverdue ? `2px solid ${t.danger}` : t.border,
          boxShadow: isOverdue ? `0 8px 20px ${t.danger}10` : t.shadow,
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          borderRadius: t.radiusInner,
          minHeight: '220px',
          overflow: 'hidden',
          gap: '0.85rem'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = isOverdue ? `0 12px 25px ${t.danger}20` : t.shadowHover;
          if (!isOverdue) e.currentTarget.style.borderColor = t.accentLight;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = isOverdue ? `0 8px 20px ${t.danger}10` : t.shadow;
          if (!isOverdue) e.currentTarget.style.borderColor = t.border.split(' ')[2];
        }}
      >
        {/* Upper Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              padding: '4px 10px',
              borderRadius: '100px',
              fontWeight: 700,
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              backgroundColor: task.status === 'completed' ? '#f0fdf4' : (isOverdue ? '#fff1f2' : '#eff6ff'),
              color: task.status === 'completed' ? '#166534' : (isOverdue ? '#9f1239' : '#1e40af'),
              border: `1px solid ${task.status === 'completed' ? '#bbf7d0' : (isOverdue ? '#fecdd3' : '#bfdbfe')}`
            }}>
              {task.status === 'completed' ? 'Concluída' : (isOverdue ? 'Atrasada' : 'Pendente')}
            </span>
          </div>

          <div>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: t.textMain,
              margin: 0,
              textDecoration: task.status === 'completed' ? 'line-through' : 'none',
              opacity: task.status === 'completed' ? 0.6 : 1,
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {task.title}
            </h3>
          </div>

          <p style={{
            fontSize: '0.8rem',
            color: t.textSecondary,
            margin: 0,
            fontWeight: 500,
            lineHeight: '1.4',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {task.description || 'Sem descrição detalhada.'}
          </p>

          {/* Checklist Progress */}
          {totalSubtasks > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: t.textSecondary, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ListTodo size={12} /> PROGRESSO
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: t.textMain }}>
                  {completedSubtasks}/{totalSubtasks} ({Math.round((completedSubtasks / totalSubtasks) * 100)}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '5px', backgroundColor: t.bgSecondary, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%`, height: '100%', backgroundColor: t.success, borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: t.border, marginTop: '0.5rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', marginLeft: '6px' }}>
            {(task.assignedTo || []).length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: t.textSecondary, fontWeight: 500 }}>Sem responsáveis</span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {(task.assignedTo || []).slice(0, 3).map((userId, i) => {
                  const emp = employees.find(e => e.id === userId);
                  const initial = emp ? emp.name[0].toUpperCase() : '?';
                  return (
                    <div
                      key={`assigned-${i}-${userId}`}
                      style={{
                        width: '24px',
                        height: '24px',
                        backgroundColor: t.bgSecondary,
                        border: `2px solid ${t.bg}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: t.textMain,
                        marginLeft: i > 0 ? '-6px' : '0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        zIndex: 10 - i
                      }}
                      title={emp?.name}
                    >
                      {initial}
                    </div>
                  );
                })}
                {(task.assignedTo || []).length > 3 && (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    backgroundColor: t.accentSoft,
                    border: `2px solid ${t.bg}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: t.accent,
                    marginLeft: '-6px',
                    zIndex: 5
                  }}>
                    +{(task.assignedTo || []).length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: isOverdue ? t.danger : t.textSecondary,
            backgroundColor: isOverdue ? `${t.danger}15` : t.bgSecondary,
            padding: '4px 10px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Calendar size={12} /> {task.end ? new Date(task.end).toLocaleDateString('pt-BR') : 'Sem prazo'}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="tasks-page max-w-[1600px] mx-auto p-4">
      <header style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>

          {/* Group 1: Title & Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: t.textMain, margin: 0 }}>Tarefas</h1>
            </div>

            <div style={{ display: 'flex', gap: '4px', backgroundColor: t.bg, padding: '4px', borderRadius: t.radiusSmall, border: t.border, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              {[
                { id: 'todas', label: 'Todas', icon: ListTodo },
                { id: 'pendentes', label: 'Pendentes', icon: Circle },
                { id: 'concluidas', label: 'Concluídas', icon: CheckCircle2 }
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '8px 16px',
                      border: isActive ? `1px solid ${t.accent}33` : '1px solid transparent',
                      borderRadius: t.radiusSmall,
                      backgroundColor: isActive ? t.accentSoft : 'transparent',
                      color: isActive ? t.accent : t.textSecondary,
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s',
                      boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.02)' : 'none'
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = t.bgSecondary;
                        e.currentTarget.style.color = t.textMain;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = t.textSecondary;
                      }
                    }}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group 2: Search, Sort & Items Per Page */}
          <div style={{ display: 'flex', flex: 1, gap: '0.75rem', alignItems: 'center', justifyContent: 'center', minWidth: '400px' }}>
            <div style={{ flex: 1, position: 'relative', maxWidth: '400px' }}>
              <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} size={18} />
              <input
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 16px 0 45px',
                  backgroundColor: t.bgSecondary,
                  border: t.borderBold,
                  borderRadius: t.radiusSmall,
                  fontSize: '0.85rem',
                  color: t.textMain,
                  outline: 'none',
                  fontWeight: 600,
                  boxShadow: t.shadowSmall,
                  transition: 'all 0.2s'
                }}
                placeholder="Buscar por tarefa, descrição, responsável..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                style={{
                  height: '42px',
                  padding: '0 1.25rem',
                  border: t.borderBold,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: showSortMenu ? t.accentSoft : t.bgSecondary,
                  color: showSortMenu ? t.accent : t.textSecondary,
                  boxShadow: t.shadowSmall,
                  cursor: 'pointer',
                  borderRadius: t.radiusSmall,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s',
                  minWidth: '160px'
                }}
                onMouseEnter={e => {
                  if (!showSortMenu) {
                    e.currentTarget.style.backgroundColor = t.bg;
                    e.currentTarget.style.color = t.textMain;
                  }
                }}
                onMouseLeave={e => {
                  if (!showSortMenu) {
                    e.currentTarget.style.backgroundColor = t.bgSecondary;
                    e.currentTarget.style.color = t.textSecondary;
                  }
                }}
              >
                <ArrowUpDown size={18} /> {
                  sortOption === 'default' ? 'Ordenação' :
                  sortOption === 'name-asc' ? 'Título A-Z' :
                  sortOption === 'name-desc' ? 'Título Z-A' :
                  sortOption === 'deadline-asc' ? 'Prazo ↑ (Mais próximo)' :
                  sortOption === 'deadline-desc' ? 'Prazo ↓ (Mais distante)' : sortOption
                }
              </button>

              <AnimatePresence>
                {showSortMenu && (
                  <>
                    <div
                      onClick={() => setShowSortMenu(false)}
                      style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 40,
                        backgroundColor: 'rgba(0,0,0,0)',
                        cursor: 'default'
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      style={{
                        position: 'absolute', top: '50px', right: 0, width: '220px',
                        backgroundColor: t.bg, border: t.border, boxShadow: t.shadow,
                        zIndex: 50, padding: '0.5rem', borderRadius: t.radiusSmall
                      }}
                    >
                      <div className="flex flex-col gap-1">
                        {[
                          { id: 'default', label: 'Ordenação' },
                          { id: 'name-asc', label: 'Título A-Z' },
                          { id: 'name-desc', label: 'Título Z-A' },
                          { id: 'deadline-asc', label: 'Prazo ↑ (Mais próximo)' },
                          { id: 'deadline-desc', label: 'Prazo ↓ (Mais distante)' }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => { setSortOption(opt.id); setShowSortMenu(false); }}
                            style={{
                              padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem',
                              border: 'none', cursor: 'pointer',
                              backgroundColor: sortOption === opt.id ? t.accentSoft : 'transparent',
                              color: sortOption === opt.id ? t.accent : t.textMain,
                              borderRadius: '8px', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                              if (sortOption !== opt.id) {
                                e.currentTarget.style.backgroundColor = t.bgSecondary;
                                e.currentTarget.style.color = t.textMain;
                              }
                            }}
                            onMouseLeave={e => {
                              if (sortOption !== opt.id) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = t.textMain;
                              }
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: t.bgSecondary, border: t.borderBold, borderRadius: t.radiusSmall, height: '42px', boxShadow: t.shadowSmall, overflow: 'hidden' }}>
                <span style={{ color: t.textSecondary, fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', paddingLeft: '12px', borderRight: t.borderBold, height: '100%', display: 'flex', alignItems: 'center', paddingRight: '10px', backgroundColor: t.bg }}>Exibir</span>
                <button
                  onClick={() => setShowItemsMenu(!showItemsMenu)}
                  style={{
                    border: 'none',
                    fontWeight: 600,
                    color: t.textMain,
                    cursor: 'pointer',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '0.85rem',
                    height: '100%',
                    padding: '0 12px',
                    minWidth: '80px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = t.bg;
                    e.currentTarget.style.color = t.accent;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = t.textMain;
                  }}
                >
                  <span>{itemsPerPage === 'all' ? 'Tudo' : itemsPerPage}</span>
                  <span style={{ fontSize: '0.6rem', color: t.textSecondary }}>▼</span>
                </button>
              </div>

              <AnimatePresence>
                {showItemsMenu && (
                  <>
                    <div
                      onClick={() => setShowItemsMenu(false)}
                      style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 40,
                        backgroundColor: 'rgba(0,0,0,0)',
                        cursor: 'default'
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      style={{
                        position: 'absolute', top: '50px', right: 0, width: '100px',
                        backgroundColor: t.bg, border: t.border, boxShadow: t.shadow,
                        zIndex: 50, padding: '0.5rem', borderRadius: t.radiusSmall
                      }}
                    >
                      <div className="flex flex-col gap-1">
                        {[10, 25, 50, 100, 'all'].map(opt => (
                          <button
                            key={opt}
                            onClick={() => { setItemsPerPage(opt === 'all' ? 'all' : Number(opt)); setShowItemsMenu(false); }}
                            style={{
                              padding: '8px 10px', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem',
                              border: 'none', cursor: 'pointer',
                              backgroundColor: itemsPerPage === opt ? t.accentSoft : 'transparent',
                              color: itemsPerPage === opt ? t.accent : t.textMain,
                              borderRadius: '6px', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                              if (itemsPerPage !== opt) {
                                e.currentTarget.style.backgroundColor = t.bgSecondary;
                                e.currentTarget.style.color = t.textMain;
                              }
                            }}
                            onMouseLeave={e => {
                              if (itemsPerPage !== opt) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = t.textMain;
                              }
                            }}
                          >
                            {opt === 'all' ? 'Tudo' : opt}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Group 3: Add Button */}
          <button
            onClick={() => handleOpenModal()}
            style={{
              backgroundColor: t.accent,
              color: t.accentContrast,
              padding: '0 1.5rem',
              height: '42px',
              fontWeight: 600,
              border: 'none',
              borderRadius: t.radiusSmall,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
              fontSize: '0.9rem',
              boxShadow: `0 4px 15px ${t.accent}33`
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${t.accent}44`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 15px ${t.accent}33`; }}
          >
            <Plus size={18} strokeWidth={3} /> Criar Tarefa
          </button>
        </div>
      </header>

      {/* Main List / Grid */}
      <div style={{ flex: 1 }}>
        {tasks.length === 0 ? (
          <EmptyState
            title="NENHUMA TAREFA"
            description="Organize seu dia criando sua primeira tarefa."
            icon={ListTodo}
            color={t.accentLight}
          />
        ) : paginatedTasks.length === 0 ? (
          <EmptyState
            title="NENHUM RESULTADO"
            description="Sua busca ou filtros não retornaram nenhuma tarefa."
            icon={Search}
            color={t.accent}
          />
        ) : (
          <>
            {viewSettings?.tasks === 'list' ? (
              renderTaskList(paginatedTasks)
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                <AnimatePresence mode="popLayout">
                  {paginatedTasks.map(task => renderTaskCard(task))}
                </AnimatePresence>
              </div>
            )}

            {itemsPerPage !== 'all' && totalItems > itemsPerPage && (
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                setItemsPerPage={setItemsPerPage}
                setCurrentPage={setCurrentPage}
              />
            )}

            <div style={{ marginTop: '1.5rem', fontWeight: 600, fontSize: '0.85rem', color: t.textSecondary, textAlign: 'right' }}>
              Mostrando {paginatedTasks.length} de {totalItems} tarefas
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)'
            }}
          >
            <motion.div
              initial={{ scale: modalScale * 0.9, opacity: 0, y: 20 }}
              animate={{ scale: modalScale, opacity: 1, y: 0 }}
              exit={{ scale: modalScale * 0.9, opacity: 0, y: 20 }}
              className="modal-content"
              style={{
                width: isMobile ? '100%' : '600px',
                maxWidth: '100%',
                maxHeight: '95vh',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden',
                border: t.border,
                boxShadow: t.shadowLarge,
                borderRadius: t.radius,
                backgroundColor: t.bg
              }}
            >
              {/* Header */}
              <div style={{
                padding: '1rem 1.5rem',
                borderBottom: t.border,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: t.bgSecondary,
                borderRadius: `${t.radius} ${t.radius} 0 0`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ backgroundColor: t.accentSoft, color: t.accent, padding: '8px', borderRadius: '8px', display: 'flex' }}>
                    <ListTodo size={18} />
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0 }}>
                      {editingId ? (isReadOnly ? 'Detalhes da Tarefa' : 'Editar Tarefa') : 'Nova Tarefa'}
                    </h3>
                  </div>
                </div>
                <motion.button
                  onClick={() => { setShowModal(false); setEditingId(null); setIsReadOnly(false); }}
                  className="modal-close-btn"
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              {/* Form Content */}
              <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1, backgroundColor: t.bg }}>
                <form id="taskForm" onSubmit={handleSubmit}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>

                    {/* Row 1: Title & Dates */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="field-label">Título da Tarefa *</label>
                        <input
                          type="text"
                          required
                          disabled={isReadOnly}
                          placeholder="Ex: Reunião de alinhamento"
                          value={taskForm.title}
                          onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                          className="field-input"
                        />
                      </div>

                      <div className="form-group">
                        <label className="field-label">Data Início *</label>
                        <div style={{ position: 'relative' }}>
                          <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} />
                          <input
                            type="date"
                            required
                            disabled={isReadOnly}
                            value={taskForm.start}
                            onChange={e => setTaskForm({ ...taskForm, start: e.target.value })}
                            className="field-input"
                            style={{ paddingLeft: '2.5rem' }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="field-label">Prazo Final *</label>
                        <div style={{ position: 'relative' }}>
                          <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} />
                          <input
                            type="date"
                            required
                            disabled={isReadOnly}
                            value={taskForm.end}
                            onChange={e => setTaskForm({ ...taskForm, end: e.target.value })}
                            className="field-input"
                            style={{ paddingLeft: '2.5rem' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Description */}
                    <div className="form-group">
                      <label className="field-label">Descrição Detalhada</label>
                      <textarea
                        rows="3"
                        disabled={isReadOnly}
                        placeholder="Descreva os objetivos e detalhes desta tarefa..."
                        value={taskForm.description}
                        onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                        className="field-input"
                        style={{
                          padding: '0.75rem 1rem',
                          resize: 'none',
                          minHeight: '80px',
                          height: 'auto'
                        }}
                      />
                    </div>

                    {/* Responsáveis */}
                    <div className="form-group">
                      <label className="field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Responsáveis (Quem terá acesso à tarefa)</span>
                        {!isReadOnly && (
                          <span
                            style={{ fontSize: '0.75rem', cursor: 'pointer', color: t.accent, fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}
                            onClick={assignEveryone}
                          >
                            {(taskForm.assignedTo || []).length === employees.length ? 'Limpar seleção' : 'Selecionar todos'}
                          </span>
                        )}
                      </label>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        padding: '0.75rem',
                        border: t.border,
                        borderRadius: '12px',
                        backgroundColor: t.bgSecondary,
                        minHeight: '60px'
                      }}>
                        {employees.map(emp => {
                          const isSelf = emp.id === user?.id;
                          const isChecked = (taskForm.assignedTo || []).includes(emp.id) || isSelf;
                          return (
                            <label key={emp.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '4px 10px',
                              cursor: (isReadOnly || isSelf) ? 'default' : 'pointer',
                              backgroundColor: isChecked ? `${t.accent}15` : t.bg,
                              border: isChecked ? `1.5px solid ${t.accent}` : t.border,
                              borderRadius: '8px',
                              opacity: isSelf ? 0.85 : 1,
                              transition: 'all 0.2s',
                              userSelect: 'none'
                            }}>
                              <input
                                type="checkbox"
                                disabled={isReadOnly || isSelf}
                                checked={isChecked}
                                onChange={() => toggleEmployee(emp.id)}
                                style={{ width: '14px', height: '14px', accentColor: t.accent }}
                              />
                              <span style={{ fontWeight: 600, fontSize: '0.8rem', color: t.textMain }}>
                                {emp.name} {isSelf && ' (Você)'}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Checklist */}
                    <div className="form-group">
                      <label className="field-label">Checklist de Atividades</label>
                      {!isReadOnly && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="Adicionar novo item..."
                            value={newSubtask}
                            onChange={e => setNewSubtask(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addSubtaskToList();
                              }
                            }}
                            className="field-input"
                          />
                          <button
                            type="button"
                            onClick={addSubtaskToList}
                            style={{
                              width: '42px',
                              height: '42px',
                              backgroundColor: t.accent,
                              color: t.accentContrast,
                              border: 'none',
                              borderRadius: t.radiusSmall,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: `0 4px 15px ${t.accent}33`
                            }}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {(taskForm.subtasks || []).map((st, i) => (
                          <div key={`taskform-subtask-${i}`} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            width: 'fit-content',
                            backgroundColor: t.bgSecondary,
                            border: t.border,
                            borderRadius: '8px',
                            padding: '6px 12px',
                            transition: 'all 0.2s'
                          }}>
                            <div
                              onClick={async () => {
                                if (isReadOnly && editingId) {
                                  await updateTaskStatus(editingId, i);
                                  const updated = [...taskForm.subtasks];
                                  updated[i].completed = !updated[i].completed;
                                  setTaskForm({ ...taskForm, subtasks: updated });
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: (isReadOnly && editingId) ? 'pointer' : 'default'
                              }}
                            >
                              {st.completed ? <CheckCircle2 size={16} style={{ color: t.success }} /> : <Circle size={16} color={t.textSecondary} opacity={0.5} />}
                              <span style={{
                                fontWeight: 600,
                                color: t.textMain,
                                fontSize: '0.85rem',
                                textDecoration: st.completed ? 'line-through' : 'none',
                                opacity: st.completed ? 0.6 : 1,
                                whiteSpace: 'nowrap'
                              }}>
                                {st.text}
                              </span>
                            </div>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => setTaskForm({ ...taskForm, subtasks: taskForm.subtasks.filter((_, idx) => idx !== i) })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: t.danger, display: 'flex', alignItems: 'center' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '1.25rem 1.5rem',
                borderTop: t.border,
                backgroundColor: t.bgSecondary,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {isReadOnly && editingId ? (
                  <button
                    type="button"
                    onClick={() => setIsReadOnly(false)}
                    style={{
                      width: '100%',
                      height: '45px',
                      backgroundColor: t.accent,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: `0 4px 12px ${t.accent}33`,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                  >
                    <Edit3 size={16} /> Editar Registro
                  </button>
                ) : (
                  <div style={{ width: '100%', display: 'flex', flexDirection: editingId ? 'row' : 'column', gap: '0.75rem', alignItems: 'stretch' }}>
                    {editingId && (
                      <button
                        type="button"
                        onClick={() => handleDelete(editingId)}
                        style={{
                          height: '45px',
                          flex: 1,
                          backgroundColor: '#fee2e2',
                          color: '#ef4444',
                          border: 'none',
                          borderRadius: '12px',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fecaca'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
                      >
                        <Trash2 size={16} /> Excluir Registro
                      </button>
                    )}

                    <button
                      form="taskForm"
                      type="submit"
                      disabled={saving}
                      style={{
                        height: '45px',
                        width: editingId ? 'auto' : '100%',
                        flex: editingId ? 1 : 'none',
                        backgroundColor: '#22c55e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#16a34a'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(22, 197, 94, 0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#22c55e'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.2)'; }}
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                      {editingId ? 'Salvar Alterações' : 'Criar Tarefa'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tasks;
