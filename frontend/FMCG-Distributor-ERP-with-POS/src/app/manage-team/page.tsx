'use client';

import React, { useState, useEffect } from 'react';
import ERPLayout from '@/components/layout/ERPLayout';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Edit2,
  Trash2,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
  X,
  Check,
  Sparkles,
  LayoutDashboard,
  FileText,
  Truck,
  Store,
  ShoppingCart,
  Warehouse,
  Navigation,
  Tag,
  IndianRupee,
  Landmark,
  BarChart3,
  Settings,
  AlertCircle
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const AVAILABLE_MODULES = [
  { id: '/', name: 'Dashboard', desc: 'Main sales summary & live activity', icon: LayoutDashboard },
  { id: '/orders-billing', name: 'Orders & Billing', desc: 'POS billing, tax invoices & orders', icon: FileText },
  { id: '/van-sales', name: 'Van Sales', desc: 'Spot sales, truck inventory & cash sales', icon: Truck },
  { id: '/outlets-beats', name: 'Outlets & Beats', desc: 'Retailer directory, credit limits & routes', icon: Store },
  { id: '/purchase', name: 'Purchase & PO', desc: 'Vendor orders, GRN receiving & company inward', icon: ShoppingCart },
  { id: '/godown', name: 'Godown / Stock', desc: 'Inventory batches, audit & physical stock', icon: Warehouse },
  { id: '/delivery-fleet', name: 'Delivery & Fleet', desc: 'Dispatch routes, van loading & trip delivery', icon: Navigation },
  { id: '/schemes', name: 'Schemes & Offers', desc: 'Brand discount slabs & trade promotions', icon: Tag },
  { id: '/claims', name: 'Claims Management', desc: 'Damage/expiry credit notes & settlements', icon: ShieldAlert },
  { id: '/collections', name: 'Collections', desc: 'Payment receipts, cashier counter & outstanding', icon: IndianRupee },
  { id: '/accounts', name: 'Accounts & Ledger', desc: 'Retailer balances, cash book & statements', icon: Landmark },
  { id: '/field-team', name: 'Field Team', desc: 'Sales rep beats, store visits & daily incentives', icon: Users },
  { id: '/reports', name: 'Reports & Analytics', desc: 'GST reports, sales analysis & distributor exports', icon: BarChart3 },
  { id: '/settings', name: 'Settings & Risk', desc: 'Firm GST, trade profile & statutory settings', icon: Settings },
];

const PRESETS: Record<string, { label: string; modules: string[] }> = {
  manager: {
    label: 'Branch Manager Preset',
    modules: ['/', '/orders-billing', '/godown', '/purchase', '/outlets-beats', '/delivery-fleet', '/collections', '/reports'],
  },
  billing: {
    label: 'Billing Desk Preset',
    modules: ['/', '/orders-billing', '/delivery-fleet', '/outlets-beats'],
  },
  godown: {
    label: 'Godown Preset',
    modules: ['/', '/godown', '/purchase'],
  },
  cashier: {
    label: 'Cashier Preset',
    modules: ['/', '/collections', '/accounts', '/outlets-beats'],
  },
  salesman: {
    label: 'Salesman Preset',
    modules: ['/', '/van-sales', '/field-team'],
  },
  all: {
    label: 'All Modules (Full Access)',
    modules: AVAILABLE_MODULES.map((m) => m.id),
  },
};

export default function ManageTeamPage() {
  const { user, token } = useAuth();
  const { showNotification } = useNotification();

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  // Add / Edit Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('manager');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [formStatus, setFormStatus] = useState('active');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const isOwner = user?.role === 'distributor_owner';

  // Fetch Team Members
  const fetchTeam = async () => {
    try {
      setLoading(true);
      const authToken = token || localStorage.getItem('fmcg_auth_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/team`, {
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMembers(data.data || []);
      } else {
        throw new Error(data.message || 'Failed to load team members');
      }
    } catch (err: any) {
      console.error(err);
      showNotification({
        title: 'Error loading team',
        message: err.message || 'Could not fetch team members',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) {
      fetchTeam();
    } else {
      setLoading(false);
    }
  }, [token, isOwner]);

  const openAddModal = () => {
    setEditingMember(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormPhone('');
    setFormRole('manager');
    setFormPermissions(PRESETS.manager.modules);
    setFormStatus('active');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (member: any) => {
    setEditingMember(member);
    setFormName(member.name || '');
    setFormEmail(member.email || '');
    setFormPassword('');
    setFormPhone(member.phone || '');
    setFormRole(member.role || 'manager');
    const existingPerms = Array.isArray(member.permissions) && member.permissions.length > 0
      ? member.permissions
      : (PRESETS[member.role]?.modules || ['/']);
    setFormPermissions(existingPerms);
    setFormStatus(member.status || 'active');
    setFormError('');
    setIsModalOpen(true);
  };

  const toggleModule = (id: string) => {
    setFormPermissions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const applyPreset = (presetKey: string) => {
    if (presetKey === 'clear') {
      setFormPermissions([]);
    } else if (PRESETS[presetKey]) {
      setFormPermissions([...PRESETS[presetKey].modules]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim() || !formEmail.trim()) {
      setFormError('Please enter member name and email address.');
      return;
    }

    if (!editingMember && !formPassword.trim()) {
      setFormError('Please provide a temporary password for new member.');
      return;
    }

    try {
      setSubmitting(true);
      const authToken = token || localStorage.getItem('fmcg_auth_token') || localStorage.getItem('token');

      const url = editingMember
        ? `${API_BASE}/team/${editingMember.id}`
        : `${API_BASE}/team`;

      const method = editingMember ? 'PUT' : 'POST';

      const payload: any = {
        name: formName.trim(),
        role: formRole,
        phone: formPhone.trim(),
        permissions: formPermissions,
        status: formStatus,
      };

      if (!editingMember) {
        payload.email = formEmail.trim().toLowerCase();
        payload.password = formPassword.trim();
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Operation failed');
      }

      showNotification({
        title: editingMember ? 'Permissions Updated' : 'Team Member Added',
        message: `${formName} has been ${editingMember ? 'updated' : 'added'} with customized module access.`,
        type: 'success',
      });

      setIsModalOpen(false);
      fetchTeam();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove team member "${name}"?`)) return;

    try {
      const authToken = token || localStorage.getItem('fmcg_auth_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/team/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Could not delete user');
      }

      showNotification({
        title: 'Member Removed',
        message: `${name} has been removed from your enterprise team.`,
        type: 'success',
      });

      fetchTeam();
    } catch (err: any) {
      showNotification({
        title: 'Action Failed',
        message: err.message,
        type: 'error',
      });
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (!isOwner) {
    return (
      <ERPLayout>
        <div className="max-w-2xl mx-auto py-12 px-4 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <ShieldAlert className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Restricted Access</h2>
          <p className="text-sm text-slate-600 mb-6">
            Only the <strong>Distributor Owner</strong> has authorization to view, create, and manage staff members and module access permissions.
          </p>
        </div>
      </ERPLayout>
    );
  }

  return (
    <ERPLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 font-medium">
              <span className="text-teal-700 font-semibold uppercase tracking-wider">Enterprise Security &amp; Access Control</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              Manage Team &amp; Module Permissions
            </h1>
            <p className="text-xs text-slate-500">
              Add managers, billing operators, and desk staff. Control exactly which ERP modules each employee can access.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-gradient-to-r from-[#00897b] to-[#006d77] hover:from-[#009688] hover:to-[#00796b] text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Team Member</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
            <p className="text-[11px] font-medium text-slate-500">Total Staff Accounts</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{members.length}</p>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
            <p className="text-[11px] font-medium text-slate-500">Active Members</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">
              {members.filter((m) => m.status === 'active').length}
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
            <p className="text-[11px] font-medium text-slate-500">Configured Modules</p>
            <p className="text-xl font-bold text-teal-700 mt-0.5">{AVAILABLE_MODULES.length}</p>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
            <p className="text-[11px] font-medium text-slate-500">Primary Authority</p>
            <p className="text-xs font-bold text-slate-800 mt-1.5 flex items-center gap-1.5 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Owner Superadmin</span>
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search member by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 focus:outline-hidden focus:border-teal-500 cursor-pointer"
            >
              <option value="All">All Roles</option>
              <option value="distributor_owner">Distributor Owner</option>
              <option value="manager">Manager</option>
              <option value="billing_operator">Billing Desk</option>
              <option value="godown_manager">Godown Manager</option>
              <option value="cashier">Cashier</option>
              <option value="salesman">Salesman</option>
            </select>
          </div>
        </div>

        {/* Team Members List / Table */}
        <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Allowed Modules</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading team members...
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No team members found.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const isOwnerRole = m.role === 'distributor_owner';
                    const permsCount = isOwnerRole
                      ? AVAILABLE_MODULES.length
                      : (Array.isArray(m.permissions) ? m.permissions.length : 0);

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200 text-teal-700 font-bold flex items-center justify-center shrink-0 text-xs">
                              {m.name ? m.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">{m.name}</p>
                              <p className="text-[11px] text-slate-400 font-normal">{m.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              isOwnerRole
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : m.role === 'manager'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : m.role === 'billing_operator'
                                ? 'bg-teal-50 text-teal-700 border-teal-200'
                                : m.role === 'godown_manager'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : m.role === 'cashier'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {m.role ? m.role.replace('_', ' ') : 'Staff'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500">
                          <div className="flex flex-col gap-0.5">
                            {m.phone && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-600">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {m.phone}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              Joined {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isOwnerRole ? (
                            <span className="inline-flex items-center gap-1 text-purple-700 font-semibold text-[11px] bg-purple-50 px-2 py-1 rounded-md border border-purple-200">
                              <Sparkles className="w-3 h-3" />
                              Full Access (All Modules)
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                              <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-[11px]">
                                {permsCount} Modules
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {Array.isArray(m.permissions) && m.permissions.length > 0
                                  ? m.permissions.map((p: string) => p.replace('/', '') || 'dash').slice(0, 3).join(', ') + (m.permissions.length > 3 ? '...' : '')
                                  : 'Role Default'}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              m.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {m.status === 'active' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <XCircle className="w-3 h-3 text-rose-600" />
                            )}
                            <span className="capitalize">{m.status || 'active'}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {isOwnerRole ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                              <span>Master Account (You)</span>
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditModal(m)}
                                title="Edit Details & Module Permissions"
                                className="px-2.5 py-1 text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md text-[11px] font-semibold border border-teal-200 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDelete(m.id, m.name)}
                                title="Delete Member"
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md border border-rose-200 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ADD / EDIT MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden my-6">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-[#072428] to-[#0c383e] text-white flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base tracking-tight">
                    {editingMember ? `Manage Access: ${editingMember.name}` : 'Add New Team Member'}
                  </h3>
                  <p className="text-[11px] text-teal-200">
                    {editingMember
                      ? 'Configure allowed modules and account status.'
                      : 'Create a new employee login and grant custom module access.'}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {formError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2 text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Member Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-teal-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Login Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      disabled={!!editingMember}
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="e.g. rahul@distributor.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 disabled:opacity-60 focus:outline-hidden focus:border-teal-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {editingMember ? 'Phone Number' : 'Contact Phone'}
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+91 98..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-teal-500 focus:bg-white"
                    />
                  </div>

                  {!editingMember ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Temporary Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-teal-500 focus:bg-white"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Account Status
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-teal-500 cursor-pointer"
                      >
                        <option value="active">Active (Access Allowed)</option>
                        <option value="inactive">Deactivated (Blocked)</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Designation / Role
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormRole(val);
                        if (val === 'distributor_owner') {
                          setFormPermissions(AVAILABLE_MODULES.map((mod) => mod.id));
                        } else if (PRESETS[val]) {
                          setFormPermissions(PRESETS[val].modules);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-teal-500 cursor-pointer"
                    >
                      <option value="distributor_owner">Distributor Owner</option>
                      <option value="manager">Manager / Branch Supervisor</option>
                      <option value="billing_operator">Billing Desk Operator</option>
                      <option value="godown_manager">Godown / Warehouse Incharge</option>
                      <option value="cashier">Cashier / Accountant</option>
                      <option value="salesman">Field Sales Representative</option>
                      <option value="custom">Custom Staff</option>
                    </select>
                  </div>
                </div>

                {/* Module Permissions Configurator */}
                <div className="pt-3 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                        <span>Module Access &amp; Permissions</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Check the modules this user is allowed to access. Unchecked modules will be hidden.
                      </p>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => applyPreset('all')}
                        className="px-2 py-0.5 text-[10px] bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 rounded font-semibold cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('billing')}
                        className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 rounded font-semibold cursor-pointer"
                      >
                        Billing Desk
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('godown')}
                        className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 rounded font-semibold cursor-pointer"
                      >
                        Godown
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('cashier')}
                        className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 rounded font-semibold cursor-pointer"
                      >
                        Cashier
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('clear')}
                        className="px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50 rounded font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Modules Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
                    {AVAILABLE_MODULES.map((mod) => {
                      const Icon = mod.icon;
                      const isChecked = formPermissions.includes(mod.id);

                      return (
                        <div
                          key={mod.id}
                          onClick={() => toggleModule(mod.id)}
                          className={`p-2.5 rounded-lg border flex items-start gap-2.5 cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-teal-50/80 border-teal-300 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent div
                            className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Icon className={`w-3.5 h-3.5 ${isChecked ? 'text-teal-700' : 'text-slate-400'}`} />
                              <span className={`text-xs font-bold leading-none ${isChecked ? 'text-teal-900' : 'text-slate-700'}`}>
                                {mod.name}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{mod.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{editingMember ? 'Save Permissions' : 'Create Team Account'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ERPLayout>
  );
}