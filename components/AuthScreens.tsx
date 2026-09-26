import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getConfig } from '../config';
import { supabase } from '../services/supabase';
import { FileTextIcon } from './IconComponents';
import LanguageSwitcher from './LanguageSwitcher';
import CreatedBy from './CreatedBy';

const card = 'w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8';
const input = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm';
const primary = 'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-60';

function Brand() {
  const { t } = useTranslation();
  const { companyName, logoUrl } = getConfig();
  return (
    <div className="text-center mb-6">
      {logoUrl
        ? <img src={logoUrl} alt={companyName || 'Logo'} className="h-12 mx-auto mb-3 object-contain" />
        : <FileTextIcon className="w-10 h-10 mx-auto mb-3 text-blue-600" aria-hidden="true" />}
      <h1 className="text-2xl font-extrabold text-gray-800">{t('app.name')}</h1>
      {companyName && <p className="text-sm text-gray-500 mt-1">{companyName}</p>}
    </div>
  );
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <LanguageSwitcher className="absolute top-4 right-4" />
      <Brand />
      {children}
      <CreatedBy className="mt-6" />
    </div>
  );
}

export function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [forgot, setForgot] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (err) setError(/invalid login/i.test(err.message) ? t('auth.invalidCredentials') : err.message);
    setBusy(false);
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (err) setError(err.message);
    else setNotice(t('auth.resetSent'));
    setBusy(false);
  };

  return (
    <AuthLayout>
      <form className={card} onSubmit={forgot ? sendReset : signIn}>
        <h2 className="text-lg font-bold text-gray-800 mb-1">{forgot ? t('auth.resetTitle') : t('auth.signInTitle')}</h2>
        <p className="text-xs text-gray-500 mb-5">{forgot ? t('auth.resetSubtitle') : t('auth.signInSubtitle')}</p>
        <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="login-email">{t('auth.email')}</label>
        <input id="login-email" type="email" required autoComplete="email" className={`${input} mb-4`} value={email} onChange={(e) => setEmail(e.target.value)} />
        {!forgot && (
          <>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="login-password">{t('auth.password')}</label>
            <input id="login-password" type="password" required autoComplete="current-password" className={`${input} mb-5`} value={password} onChange={(e) => setPassword(e.target.value)} />
          </>
        )}
        {error && <p className="text-xs text-red-600 mb-3" role="alert">{error}</p>}
        {notice && <p className="text-xs text-emerald-700 mb-3">{notice}</p>}
        <button type="submit" disabled={busy} className={primary} id="btn-login">
          {forgot ? t('auth.sendLink') : t('auth.signIn')}
        </button>
        <button
          type="button"
          onClick={() => { setForgot(!forgot); setError(''); setNotice(''); }}
          className="w-full mt-3 text-xs text-gray-500 hover:text-blue-700"
        >
          {forgot ? t('auth.backToSignIn') : t('auth.forgot')}
        </button>
        <p className="mt-4 text-[11px] text-gray-400 text-center">{t('auth.inviteOnly')}</p>
      </form>
    </AuthLayout>
  );
}

/** Tras abrir una invitación o un enlace de recuperación: crear contraseña. */
export function SetPasswordScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError(t('auth.passwordTooShort'));
    if (password !== confirm) return setError(t('auth.passwordsDontMatch'));
    setBusy(true);
    const { error: err } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (err) setError(err.message);
    else onDone();
  };

  return (
    <AuthLayout>
      <form className={card} onSubmit={save}>
        <h2 className="text-lg font-bold text-gray-800 mb-1">{t('auth.setPasswordTitle')}</h2>
        <p className="text-xs text-gray-500 mb-5">{t('auth.setPasswordSubtitle')}</p>
        <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="new-password">{t('auth.newPassword')}</label>
        <input id="new-password" type="password" autoComplete="new-password" className={`${input} mb-4`} value={password} onChange={(e) => setPassword(e.target.value)} />
        <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="confirm-password">{t('auth.confirmPassword')}</label>
        <input id="confirm-password" type="password" autoComplete="new-password" className={`${input} mb-5`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p className="text-xs text-red-600 mb-3" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className={primary} id="btn-set-password">{t('auth.saveAndEnter')}</button>
      </form>
    </AuthLayout>
  );
}

export function NotConfiguredScreen() {
  const { t } = useTranslation();
  return (
    <AuthLayout>
      <div className={card} role="alert">
        <h2 className="text-lg font-bold text-gray-800 mb-2">{t('config.notConfiguredTitle')}</h2>
        <p className="text-sm text-gray-600">{t('config.notConfiguredBody')}</p>
      </div>
    </AuthLayout>
  );
}
