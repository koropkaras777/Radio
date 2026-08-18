import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../../../config/constants.js';
import { LangSwitcher } from '../../shared/LangSwitcher.jsx';
import { pickLocalized } from '../../../i18n/serverMessage.js';
import { t } from '../../../i18n/index.js';
import { useDirectionSync } from '../../../i18n/rtl.js';

const INPUT_CLASS = 'p-4 rounded-xl text-[16px] font-black transition-all border-none outline-none text-center shadow-inner bg-white/90 text-gray-800 placeholder-gray-400 placeholder:text-xs';

const AdminLogin = ({ navigate }) => {
  const [isNight,  setIsNight]  = useState(false);
  const [lang,     setLang]     = useState(() => localStorage.getItem('lang') || 'uk');
  const [login,    setLogin]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');

  useDirectionSync(lang);

  useEffect(() => {
    document.title = `${t('radio.radioNameDay', {}, lang)} - ${t('adminLogin.loginTitle', {}, lang)}`;
  }, [lang]);

  useEffect(() => {
    const socket = io(SERVER_URL);
    socket.on('sync', (state) => {
      if (state.mode) setIsNight(state.mode === 'night');
    });
    return () => socket.disconnect();
  }, []);

  const handleLangChange = (l) => {
    setLang(l);
    localStorage.setItem('lang', l);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res  = await fetch(`${SERVER_URL}/api/admin/login`, {
        method     : 'POST',
        headers    : { 'Content-Type': 'application/json' },
        credentials: 'include',
        body       : JSON.stringify({ login, password }),
      });
      const data = await res.json();

      if (res.ok) {
        if (data.token) sessionStorage.setItem('adminToken', data.token);
        navigate('/adpanel');
      } else {
        setError(pickLocalized(data.error, lang) || t('common.connectionError', {}, lang));
      }
    } catch {
      setError(t('common.connectionError', {}, lang));
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center transition-colors duration-1000 ${isNight ? 'bg-[#0f0505]' : 'bg-gray-900'}`}
      style={{ fontFamily: "'Segoe UI', Roboto, sans-serif" }}
    >
      <div className="fixed top-3 left-4 z-50">
        <LangSwitcher lang={lang} onChange={handleLangChange} align="left" />
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-6 w-80 items-center">
        <h2
          className="text-4xl font-extrabold uppercase tracking-wider text-center"
          style={{
            color: isNight ? '#bc0000' : '#ffffff',
            WebkitTextStroke: isNight ? '1px #4a0404' : 'none',
            textShadow: isNight ? 'none' : '0 2px 10px rgba(0,0,0,0.1)',
          }}
        >
          {t('adminLogin.loginTitle', {}, lang)}
        </h2>

        <div className="flex flex-col gap-3 w-full">
          <input
            type="text"
            placeholder={t('adminLogin.login', {}, lang)}
            className={INPUT_CLASS}
            onChange={(e) => setLogin(e.target.value)}
          />
          <input
            type="password"
            placeholder={t('adminLogin.pass', {}, lang)}
            className={INPUT_CLASS}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className={`px-8 py-3 rounded-xl text-lg text-white font-bold transition-all transform active:scale-95 flex items-center gap-2 shadow-lg ${
            isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          {t('adminLogin.enter', {}, lang)}
        </button>

        {error && (
          <p className="text-[10px] font-black uppercase text-white bg-red-600/80 px-4 py-2 rounded-full mt-2 animate-bounce">
            {error}
          </p>
        )}
      </form>
    </div>
  );
};

export default AdminLogin;