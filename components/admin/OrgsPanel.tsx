import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createOrg, SPECIALTIES, type Org, type Specialty } from '../../services/orgs';
import { BuildingIcon } from '../IconComponents';
import { field, primaryButton, Sheet, useErrorText } from './Sheet';

const autoSlug = (v: string) =>
  v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Solo superadmin: crear empresas (e invitar a su admin) y entrar en cualquiera. */
export function OrgsPanel({ orgs, onClose, onCreated, onOpen }: {
  orgs: Org[];
  onClose: () => void;
  onCreated: (orgId: string) => void;
  onOpen: (orgId: string) => void;
}) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [specialty, setSpecialty] = useState<Specialty>('general');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await createOrg(name.trim(), slug || autoSlug(name), adminEmail.trim(), specialty);
      onCreated((res.org as Org).id);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t('orgs.title')} icon={<BuildingIcon className="w-5 h-5 text-blue-700" />} onClose={onClose}>
      <ul className="divide-y divide-gray-100 border border-gray-100 rounded-2xl mb-6" id="orgs-list">
        {orgs.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">{t('orgs.empty')}</li>}
        {orgs.map((o) => (
          <li key={o.id} className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {o.logo_url && <img src={o.logo_url} alt="" className="h-6 w-6 object-contain" />}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">{o.name}</div>
                <div className="text-[11px] text-gray-400">
                  <span className="font-mono">{o.slug}</span> · {t(`specialties.${o.specialty}`)}
                </div>
              </div>
            </div>
            <button type="button" onClick={() => onOpen(o.id)} className="text-xs font-semibold text-blue-700 hover:underline">{t('orgs.enter')}</button>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{t('orgs.new')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={field} required maxLength={120} placeholder={t('orgs.name')} value={name}
            onChange={(e) => { setName(e.target.value); setSlug(autoSlug(e.target.value)); }} aria-label={t('orgs.name')} id="org-name" />
          <input className={`${field} font-mono`} required placeholder={t('orgs.slug')} value={slug}
            onChange={(e) => setSlug(autoSlug(e.target.value))} aria-label={t('orgs.slugLabel')} id="org-slug" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="email" className={field} required placeholder={t('orgs.adminEmail')} value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)} aria-label={t('orgs.adminEmail')} id="org-admin" />
          <select className={field} value={specialty} onChange={(e) => setSpecialty(e.target.value as Specialty)} aria-label={t('orgs.specialty')} id="org-specialty">
            {SPECIALTIES.map((s) => <option key={s} value={s}>{t(`specialties.${s}`)}</option>)}
          </select>
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className={primaryButton} id="btn-create-org">{t('orgs.create')}</button>
      </form>
    </Sheet>
  );
}

export default OrgsPanel;
