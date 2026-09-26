import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  inviteMember, listMembers, removeMember, setMemberRole, SPECIALTIES, updateOrg, uploadLogo,
  type Member, type Org, type Role, type Specialty,
} from '../../services/orgs';
import { TrashIcon, UsersIcon } from '../IconComponents';
import { field, primaryButton, Sheet, useErrorText } from './Sheet';

/** Admin de empresa: usuarios (invitar, cambiar rol, quitar) y datos de la empresa. */
export function MembersPanel({ org, currentUserId, onClose, onOrgChanged }: {
  org: Org;
  currentUserId: string;
  onClose: () => void;
  onOrgChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const errorText = useErrorText();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [orgName, setOrgName] = useState(org.name);
  const [logoUrl, setLogoUrl] = useState(org.logo_url || '');
  const [specialty, setSpecialty] = useState<Specialty>(org.specialty);
  const [instructions, setInstructions] = useState(org.assistant_instructions || '');

  const reload = useCallback(
    () => listMembers(org.id).then(setMembers).catch((e) => setError(errorText(e))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org.id],
  );
  useEffect(() => { reload(); }, [reload]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      if (ok) setNotice(ok);
      await reload();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = email.trim();
    let already = false;
    const ok = await run(async () => {
      const res = await inviteMember(org.id, target, role);
      already = Boolean(res.already_member);
    });
    if (ok) {
      setNotice(already ? t('members.alreadyMember', { email: target }) : t('members.inviteSent', { email: target }));
      setEmail('');
    }
  };

  const onLogoFile = async (file: File | undefined) => {
    if (!file) return;
    await run(async () => setLogoUrl(await uploadLogo(org.id, file)));
  };

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(
      () => updateOrg(org.id, {
        name: orgName.trim(),
        logo_url: logoUrl.trim() || null,
        specialty,
        assistant_instructions: instructions.trim(),
      }),
      t('orgSettings.saved'),
    );
    if (ok) onOrgChanged();
  };

  const dateFormat = (iso: string) => new Date(iso).toLocaleDateString(i18n.resolvedLanguage);

  return (
    <Sheet title={t('members.title', { org: org.name })} icon={<UsersIcon className="w-5 h-5 text-blue-700" />} onClose={onClose}>
      <form className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 mb-2" onSubmit={invite}>
        <input type="email" required placeholder={t('members.emailPlaceholder')} className={field} value={email}
          onChange={(e) => setEmail(e.target.value)} aria-label={t('members.emailLabel')} id="invite-email" />
        <select className={field} value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label={t('members.roleLabel')} id="invite-role">
          <option value="user">{t('members.roleUser')}</option>
          <option value="admin">{t('members.roleAdmin')}</option>
        </select>
        <button type="submit" disabled={busy} className={primaryButton} id="btn-invite">{t('members.invite')}</button>
      </form>
      <p className="text-xs text-gray-500 mb-4">{t('members.inviteHint')}</p>
      {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
      {notice && <p className="text-sm text-emerald-700 mb-3" role="status">{notice}</p>}

      {!members ? (
        <p className="text-sm text-gray-400">{t('common.loading')}</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-2xl" id="members-list">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-[180px]">
                <div className="text-sm font-semibold text-gray-800 break-all">
                  {m.email}{m.user_id === currentUserId && <span className="text-xs text-gray-400 font-normal"> {t('members.you')}</span>}
                </div>
                <div className="text-[11px] text-gray-400">
                  {m.last_sign_in_at ? t('members.lastAccess', { date: dateFormat(m.last_sign_in_at) }) : t('members.pendingInvite')}
                </div>
              </div>
              <select className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs" value={m.role} disabled={busy}
                onChange={(e) => run(() => setMemberRole(org.id, m.user_id, e.target.value as Role))} aria-label={t('members.roleOf', { email: m.email })}>
                <option value="user">{t('roles.user')}</option>
                <option value="admin">{t('roles.admin')}</option>
              </select>
              <button type="button" disabled={busy} title={t('members.remove', { email: m.email })} aria-label={t('members.remove', { email: m.email })}
                onClick={() => window.confirm(t('members.confirmRemove', { email: m.email, org: org.name })) && run(() => removeMember(org.id, m.user_id))}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                <TrashIcon className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="mt-6 pt-5 border-t border-gray-100 space-y-3" onSubmit={saveOrg} id="org-settings">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{t('orgSettings.title')}</p>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">{t('orgSettings.name')}</span>
          <input className={field} value={orgName} onChange={(e) => setOrgName(e.target.value)} required maxLength={120} id="org-settings-name" />
        </label>

        <div>
          <span className="block text-xs font-semibold text-gray-600 mb-1">{t('orgSettings.logo')}</span>
          <div className="flex flex-wrap items-center gap-3">
            {logoUrl && <img src={logoUrl} alt="" className="h-10 max-w-[140px] object-contain border border-gray-100 rounded" />}
            <label className="text-xs text-blue-700 font-semibold cursor-pointer hover:underline">
              {t('orgSettings.logoUpload')}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="org-logo-file"
                onChange={(e) => onLogoFile(e.target.files?.[0])} disabled={busy} />
            </label>
            {logoUrl && (
              <button type="button" className="text-xs text-gray-500 hover:text-red-600" onClick={() => setLogoUrl('')}>{t('orgSettings.removeLogo')}</button>
            )}
          </div>
          <input className={`${field} mt-2`} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder={t('orgSettings.logoUrl')}
            aria-label={t('orgSettings.logoUrl')} pattern="https?://.+" />
        </div>

        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">{t('orgSettings.specialty')}</span>
          <select className={field} value={specialty} onChange={(e) => setSpecialty(e.target.value as Specialty)} id="org-settings-specialty">
            {SPECIALTIES.map((s) => <option key={s} value={s}>{t(`specialties.${s}`)}</option>)}
          </select>
          <span className="block text-[11px] text-gray-400 mt-1">{t('orgSettings.specialtyHint')}</span>
        </label>

        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">{t('orgSettings.instructions')}</span>
          <textarea className={`${field} min-h-[80px]`} value={instructions} maxLength={2000} onChange={(e) => setInstructions(e.target.value)} id="org-settings-instructions" />
          <span className="block text-[11px] text-gray-400 mt-1">{t('orgSettings.instructionsHint')}</span>
        </label>

        <button type="submit" disabled={busy} className={primaryButton} id="btn-save-org">{t('orgSettings.save')}</button>
      </form>
    </Sheet>
  );
}

export default MembersPanel;
