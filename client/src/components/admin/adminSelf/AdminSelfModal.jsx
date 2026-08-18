import { useState } from 'react';
import { SERVER_URL } from '../../../config/constants.js';
import { pickLocalized } from '../../../i18n/serverMessage.js';
import { t as translate, useNamespace } from '../../../i18n/index.js';
import { PasswordField } from '../shared/PasswordField.jsx';
import { accentBtn, accentPanel, inputBorder } from '../shared/theme.js';
import { SectionHeader } from './SectionHeader.jsx';

export function AdminSelfModal({ open, onClose, isNight, lang = 'uk', showToast, authorized, login, onActivated }) {
  const t = useNamespace('adminSelfModal', lang);

  // ── Section open state ─────────────────────────────────────────────────────
  const [openSection, setOpenSection] = useState(authorized ? null : 'activate');
  const toggleSection = (name) => setOpenSection((s) => (s === name ? null : name));

  // ── Activate ───────────────────────────────────────────────────────────────
  const [tempPass,    setTempPass]    = useState('');
  const [newPass1,    setNewPass1]    = useState('');
  const [newPass2,    setNewPass2]    = useState('');
  const [activating,  setActivating]  = useState(false);

  const handleActivate = async () => {
    if (newPass1 !== newPass2) { showToast(t('passNoMatch'), 'error'); return; }
    setActivating(true);
    try {
      const res  = await fetch(`${SERVER_URL}/api/admin/admins/self/activate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempPassword: tempPass, newPassword: newPass1 }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(pickLocalized(data.message, lang) || t('success'), 'success');
        setTempPass(''); setNewPass1(''); setNewPass2('');
        onActivated?.();
      } else {
        showToast(pickLocalized(data.error, lang) || t('error'), 'error');
      }
    } catch { showToast(translate('common.connectionError', {}, lang), 'error'); }
    setActivating(false);
  };

  // ── Change login ───────────────────────────────────────────────────────────
  const [newLogin,    setNewLogin]    = useState('');
  const [loginPass,   setLoginPass]   = useState('');
  const [savingLogin, setSavingLogin] = useState(false);

  const handleSaveLogin = async () => {
    setSavingLogin(true);
    try {
      const res  = await fetch(`${SERVER_URL}/api/admin/admins/self/login`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newLogin, currentPassword: loginPass }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(pickLocalized(data.message, lang) || t('success'), 'success');
        setNewLogin(''); setLoginPass('');
      } else {
        showToast(pickLocalized(data.error, lang) || t('error'), 'error');
      }
    } catch { showToast(translate('common.connectionError', {}, lang), 'error'); }
    setSavingLogin(false);
  };

  // ── Change password ────────────────────────────────────────────────────────
  const [curPass,    setCurPass]    = useState('');
  const [chgPass1,   setChgPass1]   = useState('');
  const [chgPass2,   setChgPass2]   = useState('');
  const [savingPass, setSavingPass] = useState(false);

  const handleSavePass = async () => {
    if (chgPass1 !== chgPass2) { showToast(t('passNoMatch'), 'error'); return; }
    setSavingPass(true);
    try {
      const res  = await fetch(`${SERVER_URL}/api/admin/admins/self/password`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: curPass, newPassword: chgPass1 }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(pickLocalized(data.message, lang) || t('success'), 'success');
        setCurPass(''); setChgPass1(''); setChgPass2('');
      } else {
        showToast(pickLocalized(data.error, lang) || t('error'), 'error');
      }
    } catch { showToast(translate('common.connectionError', {}, lang), 'error'); }
    setSavingPass(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${accentPanel(isNight)}`} onClick={(e) => e.stopPropagation()}>

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

        <div className="p-6 divide-y divide-white/10">

          <div>
            {authorized ? (
              <div className="flex items-center gap-2 py-3">
                <div className="w-4 h-4 rounded-full bg-emerald-500 shrink-0 shadow shadow-emerald-500/40" />
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                  {t('accountActivated')}
                </span>
              </div>
            ) : (
              <>
                <SectionHeader label={t('activateSection')} open={openSection === 'activate'} onToggle={() => toggleSection('activate')} locked={false} />
                {openSection === 'activate' && (
                  <div className="space-y-3 pb-4">
                    <PasswordField value={tempPass}  onChange={setTempPass}  placeholder={t('tempPass')}   isNight={isNight} />
                    <PasswordField value={newPass1}  onChange={setNewPass1}  placeholder={t('newPass')}    isNight={isNight} />
                    <PasswordField value={newPass2}  onChange={setNewPass2}  placeholder={t('repeatPass')} isNight={isNight} />
                    <div className="flex justify-end">
                      <button onClick={handleActivate} disabled={activating || !tempPass || !newPass1 || !newPass2} className={`px-4 py-2 rounded-xl text-xs font-black text-white transition-all disabled:opacity-50 ${accentBtn(isNight)}`}>
                        {activating ? t('activating') : t('activate')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <SectionHeader label={t('loginSection')} open={openSection === 'login'} onToggle={() => toggleSection('login')} locked={!authorized} />
            {openSection === 'login' && authorized && (
              <div className="space-y-3 pb-4">
                <div className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/60">{login}</div>
                <input
                  value={newLogin}
                  onChange={(e) => setNewLogin(e.target.value)}
                  placeholder={t('newLogin')}
                  className={`w-full rounded-xl bg-white/5 border px-3 py-2 text-sm text-white outline-none ${inputBorder(isNight)}`}
                />
                <PasswordField value={loginPass} onChange={setLoginPass} placeholder={t('confirmPass')} isNight={isNight} />
                <div className="flex justify-end">
                  <button onClick={handleSaveLogin} disabled={savingLogin || !newLogin.trim() || !loginPass} className={`px-4 py-2 rounded-xl text-xs font-black text-white transition-all disabled:opacity-50 ${accentBtn(isNight)}`}>
                    {savingLogin ? t('savingLogin') : t('saveLogin')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <SectionHeader label={t('passwordSection')} open={openSection === 'password'} onToggle={() => toggleSection('password')} locked={!authorized} />
            {openSection === 'password' && authorized && (
              <div className="space-y-3 pb-4">
                <PasswordField value={curPass}  onChange={setCurPass}  placeholder={t('currentPass')} isNight={isNight} />
                <PasswordField value={chgPass1} onChange={setChgPass1} placeholder={t('newPass')}     isNight={isNight} />
                <PasswordField value={chgPass2} onChange={setChgPass2} placeholder={t('repeatPass')}  isNight={isNight} />
                <div className="flex justify-end">
                  <button onClick={handleSavePass} disabled={savingPass || !curPass || !chgPass1 || !chgPass2} className={`px-4 py-2 rounded-xl text-xs font-black text-white transition-all disabled:opacity-50 ${accentBtn(isNight)}`}>
                    {savingPass ? t('savingPass') : t('savePass')}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}