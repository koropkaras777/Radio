import { useState, useEffect, useCallback } from 'react';
import { SERVER_URL } from '../../../config/constants.js';
import { pickLocalized, apiRequest } from '../../../i18n/serverMessage.js';
import { t as translate, useNamespace } from '../../../i18n/index.js';
import { PasswordField } from '../shared/PasswordField.jsx';
import { accentBtn, accentPanel, inputBorder } from '../shared/theme.js';
import { generatePassword } from './adminManageHelpers.js';
import { PrivilegeColumns } from './PrivilegeColumns.jsx';
import { AdminSelect } from './AdminSelect.jsx';

export function AdminManageModal({ open, onClose, isNight, lang = 'uk', showToast, socketRef, radioHostsMode = true, streamMode = true }) {
  const t = useNamespace('adminManage', lang);

  const [admins,        setAdmins]        = useState([]);
  const [allPrivileges, setAllPrivileges]  = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [selectedId,    setSelectedId]    = useState('');
  const [editPrivs,     setEditPrivs]     = useState([]);
  const [saving,        setSaving]        = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [resetConfirm, setResetConfirm]   = useState(false);
  const [resetting,    setResetting]      = useState(false);
  const [resetPass,    setResetPass]      = useState('');
  const [resetResult,  setResetResult]    = useState('');
  const [copied,        setCopied]        = useState(false);

  const [showCreate,    setShowCreate]    = useState(false);
  const [newLogin,      setNewLogin]      = useState('');
  const [newPass,       setNewPass]       = useState('');
  const [newPrivs,      setNewPrivs]      = useState(['stats']);
  const [creating,      setCreating]      = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/admins`, {}, lang);
      setAdmins(data.admins || []);
      if (Array.isArray(data.allPrivileges)) {
        const filtered = data.allPrivileges.filter((p) => {
          if (!radioHostsMode && (p === 'radio_host' || p === 'radio_moderator')) return false;
          if (!streamMode && p === 'jingles_uploader') return false;
          return true;
        });
        setAllPrivileges(filtered);
      }
    } catch (error) {
      showToast(error instanceof TypeError ? translate('common.connectionError', {}, lang) : (error.message || t('genericError')), 'error');
    }
    setLoading(false);
  }, [lang, showToast, radioHostsMode, streamMode, t]);

  useEffect(() => { if (open) fetchAdmins(); }, [open, fetchAdmins]);

  useEffect(() => {
    if (!open || !socketRef?.current) return;
    const socket = socketRef.current;
    const handleAuthorized = ({ adminId, authorized }) => {
      setAdmins((prev) =>
        prev.map((a) => a.adminId === adminId ? { ...a, authorized } : a)
      );
    };
    socket.on('admin_authorized', handleAuthorized);
    return () => socket.off('admin_authorized', handleAuthorized);
  }, [open, socketRef]);

  useEffect(() => {
    const admin = admins.find((a) => a.adminId === selectedId);
    setEditPrivs(admin ? [...admin.privileges] : []);
    setDeleteConfirm(false);
    setResetConfirm(false);
    setResetResult('');
  }, [selectedId, admins]);

  const selectedAdmin = admins.find((a) => a.adminId === selectedId) || null;

  const handleSavePrivs = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/admins/${selectedId}/privileges`, {
        method: 'PUT',
        body:   JSON.stringify({ privileges: editPrivs }),
      }, lang);
      showToast(pickLocalized(data.message, lang) || t('genericSuccess'), 'success');
      setAdmins((prev) => prev.map((a) => a.adminId === selectedId ? { ...a, privileges: editPrivs } : a));
    } catch (error) {
      showToast(error instanceof TypeError ? translate('common.connectionError', {}, lang) : (error.message || t('genericError')), 'error');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/admins/${selectedId}`, { method: 'DELETE' }, lang);
      showToast(pickLocalized(data.message, lang) || t('genericSuccess'), 'success');
      setAdmins((prev) => prev.filter((a) => a.adminId !== selectedId));
      setSelectedId('');
    } catch (error) {
      showToast(error instanceof TypeError ? translate('common.connectionError', {}, lang) : (error.message || t('genericError')), 'error');
    }
    setDeleting(false);
    setDeleteConfirm(false);
  };

  const openResetPassword = () => {
    setResetPass(generatePassword());
    setResetResult('');
    setResetConfirm(true);
  };

  const handleResetPassword = async () => {
    if (!selectedId || !resetPass.trim()) return;
    setResetting(true);
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/admins/${selectedId}/reset-password`, {
        method: 'PUT',
        body:   JSON.stringify({ newPassword: resetPass }),
      }, lang);
      showToast(pickLocalized(data.message, lang) || t('genericSuccess'), 'success');
      setResetResult(resetPass);
      setResetConfirm(false);
    } catch (error) {
      showToast(error instanceof TypeError ? translate('common.connectionError', {}, lang) : (error.message || t('genericError')), 'error');
    }
    setResetting(false);
  };

  const handleCreate = async () => {
    if (!newLogin.trim() || !newPass.trim()) return;
    setCreating(true);
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/admins`, {
        method: 'POST',
        body:   JSON.stringify({ login: newLogin.trim(), password: newPass, privileges: newPrivs }),
      }, lang);
      showToast(pickLocalized(data.message, lang) || t('genericSuccess'), 'success');
      setAdmins((prev) => [...prev, data.admin]);
      setNewLogin('');
      setNewPass('');
      setNewPrivs(['stats']);
      setShowCreate(false);
      setSelectedId(data.admin.adminId);
    } catch (error) {
      showToast(error instanceof TypeError ? translate('common.connectionError', {}, lang) : (error.message || t('genericError')), 'error');
    }
    setCreating(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4">
      <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl ${accentPanel(isNight)}`} onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className={`text-sm font-black uppercase tracking-wider ${isNight ? 'text-red-400' : 'text-blue-400'}`}>{t('title')}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <AdminSelect
              admins={admins}
              value={selectedId}
              onChange={setSelectedId}
              loading={loading}
              t={t}
              isNight={isNight}
            />
          </div>

          {selectedAdmin && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-white">{selectedAdmin.login}</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${selectedAdmin.authorized ? 'bg-emerald-700/40 text-emerald-300' : 'bg-amber-700/40 text-amber-300'}`}>
                  {selectedAdmin.authorized ? t('authorized') : t('notAuthorized')}
                </span>
              </div>

              <PrivilegeColumns privs={editPrivs} onChange={setEditPrivs} t={t} isNight={isNight} allPrivileges={allPrivileges} />

              {(resetResult || resetConfirm) && (
                <div className="space-y-2">
                  {resetResult ? (
                    <div className="flex flex-col gap-2 rounded-xl border border-emerald-700/40 bg-emerald-900/10 p-3">
                      <span className="text-[10px] font-black uppercase text-emerald-400">{t('newPasswordLabel')}</span>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm text-white font-mono break-all">{resetResult}</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(resetResult); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                          className={`shrink-0 px-3 py-2 rounded-lg text-[10px] font-black text-white transition-all ${accentBtn(isNight)}`}
                        >
                          {copied ? t('copied') : t('copy')}
                        </button>
                      </div>
                      <span className="text-[10px] text-white/40">{t('resetDoneHint')}</span>
                      <button onClick={() => setResetResult('')} className="self-start text-[10px] font-black text-white/40 hover:text-white/70">
                        {t('close')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-xl border border-white/10 p-3">
                      <span className="text-[10px] font-black uppercase text-gray-400">{t('resetConfirmTitle', { login: selectedAdmin.login })}</span>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <PasswordField value={resetPass} onChange={setResetPass} placeholder="••••••••" isNight={isNight} />
                        </div>
                        <button
                          onClick={() => setResetPass(generatePassword())}
                          className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-black text-white transition-all ${accentBtn(isNight)}`}
                        >
                          {t('generatePass')}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={handleResetPassword} disabled={resetting || !resetPass.trim()} className={`px-3 py-1.5 rounded-lg text-[10px] font-black text-white disabled:opacity-50 transition-all ${accentBtn(isNight)}`}>
                          {resetting ? t('resetting') : t('resetYes')}
                        </button>
                        <button onClick={() => setResetConfirm(false)} className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-white/10 hover:bg-white/20 text-white/60 transition-all">
                          {t('resetNo')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                {!deleteConfirm && !resetConfirm && !resetResult && (
                  <button onClick={openResetPassword} className="px-4 py-2 rounded-xl text-xs font-black text-white bg-amber-900/60 hover:bg-amber-800/80 transition-all">
                    {t('resetPassword')}
                  </button>
                )}
                {deleteConfirm ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-red-400">{t('deleteConfirm', { login: selectedAdmin.login })}</span>
                    <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-red-700 hover:bg-red-600 text-white disabled:opacity-50 transition-all">
                      {deleting ? '…' : t('deleteYes')}
                    </button>
                    <button onClick={() => setDeleteConfirm(false)} className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-white/10 hover:bg-white/20 text-white/60 transition-all">
                      {t('deleteNo')}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(true)} className="px-4 py-2 rounded-xl text-xs font-black text-white bg-red-900/60 hover:bg-red-800/80 transition-all">
                    {t('delete')}
                  </button>
                )}
                <button onClick={handleSavePrivs} disabled={saving} className={`px-4 py-2 rounded-xl text-xs font-black text-white transition-all disabled:opacity-50 ${accentBtn(isNight)}`}>
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-white/10 pt-4">
            <button
              onClick={() => setShowCreate((v) => !v)}
              className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${
                isNight ? 'border-red-900/40 text-red-700 hover:bg-red-900/10' : 'border-white/20 text-white/50 hover:bg-white/5'
              }`}
            >
              {t('addNew')}
            </button>
          </div>

          {showCreate && (
            <div className="space-y-4 border border-white/10 rounded-xl p-4">
              <div className="text-xs font-black text-white/60 uppercase tracking-widest">{t('createTitle')}</div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">{t('loginLabel')}</label>
                <input
                  value={newLogin}
                  onChange={(e) => setNewLogin(e.target.value)}
                  placeholder={t('loginAdmin')}
                  className={`w-full rounded-xl bg-white/5 border px-3 py-2 text-sm text-white outline-none ${inputBorder(isNight)}`}
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">{t('passwordLabel')}</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <PasswordField value={newPass} onChange={setNewPass} placeholder="••••••••" isNight={isNight} />
                  </div>
                  <button
                    onClick={() => setNewPass(generatePassword())}
                    className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-black text-white transition-all ${accentBtn(isNight)}`}
                  >
                    {t('generatePass')}
                  </button>
                </div>
              </div>

              <PrivilegeColumns privs={newPrivs} onChange={setNewPrivs} t={t} isNight={isNight} allPrivileges={allPrivileges} />

              <div className="flex justify-end">
                <button onClick={handleCreate} disabled={creating || !newLogin.trim() || !newPass.trim()} className={`px-4 py-2 rounded-xl text-xs font-black text-white transition-all disabled:opacity-50 ${accentBtn(isNight)}`}>
                  {creating ? t('creating') : t('createSave')}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}