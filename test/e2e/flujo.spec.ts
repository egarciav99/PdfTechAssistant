/**
 * Flujo completo en Chromium, en español y en inglés:
 * superadmin crea empresa → el admin acepta la invitación, sube un PDF, pone el logo
 * e invita a un usuario → el usuario acepta, ve el documento y pregunta.
 *
 * Requisitos: Supabase local, simulador de Gemini y funciones servidas
 * (ver docs/ENTREGA.md → Pruebas).
 */
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { ensureUser, PASSWORD, serviceClient } from '../integration/helpers';

const MAILPIT = process.env.MAILPIT_URL || 'http://127.0.0.1:54324';
const PDF = fileURLToPath(new URL('../fixtures/especificacion.pdf', import.meta.url));
// PNG de 1×1 para el logo.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const TEXT = {
  es: {
    signIn: 'Entrar', companies: 'Empresas', create: 'Crear e invitar al admin', setPassword: 'Guardar y entrar',
    upload: '+ Subir', uploadButton: 'Subir y analizar', ready: 'Listo', users: 'Usuarios', invite: 'Invitar',
    inviteSent: 'Invitación enviada', chat: 'Chat', answer: 'Según el documento', signOut: 'Cerrar sesión',
    roleUser: 'Usuario', roleAdmin: 'Admin', specialty: 'Ingeniería eléctrica', specialtyValue: 'electrical',
    saveOrg: 'Guardar empresa', saved: 'Datos de la empresa guardados.', summary: 'Resumen', summaryTitle: 'Resumen técnico',
    docsTitle: 'Documentos de la empresa', private: 'Tus conversaciones son privadas',
  },
  en: {
    signIn: 'Sign in', companies: 'Companies', create: 'Create and invite the admin', setPassword: 'Save and continue',
    upload: '+ Upload', uploadButton: 'Upload and analyze', ready: 'Ready', users: 'Users', invite: 'Invite',
    inviteSent: 'Invitation sent', chat: 'Chat', answer: 'According to the document', signOut: 'Sign out',
    roleUser: 'User', roleAdmin: 'Admin', specialty: 'Civil engineering', specialtyValue: 'civil',
    saveOrg: 'Save company', saved: 'Company details saved.', summary: 'Summary', summaryTitle: 'Technical summary',
    docsTitle: 'Company documents', private: 'Your conversations are private',
  },
} as const;

type Lang = keyof typeof TEXT;

/** Enlace de invitación del último correo recibido en Mailpit para esa dirección. */
async function inviteLink(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then((r) => r.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
      const body = `${message.HTML || ''}\n${message.Text || ''}`;
      const link = body.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/)?.[0];
      if (link) return link.replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No llegó la invitación a ${email}`);
}

async function signIn(page: Page, email: string, lang: Lang) {
  await page.goto('/');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: TEXT[lang].signIn, exact: true }).click();
}

async function acceptInvite(page: Page, email: string, lang: Lang) {
  await page.goto(await inviteLink(email));
  await expect(page.locator('#btn-set-password')).toHaveText(TEXT[lang].setPassword);
  await page.locator('#new-password').fill(PASSWORD);
  await page.locator('#confirm-password').fill(PASSWORD);
  await page.locator('#btn-set-password').click();
}

async function signOut(page: Page, lang: Lang) {
  await page.getByRole('button', { name: TEXT[lang].signOut }).click();
  await expect(page.locator('#login-email')).toBeVisible();
}

// Navegador en español: en 'es' se comprueba la detección automática del idioma
// y en 'en' el cambio con el selector.
test.use({ locale: 'es-ES' });

for (const lang of ['es', 'en'] as const) {
  test(`superadmin → empresa → admin sube PDF → invita → el usuario pregunta (${lang})`, async ({ page }) => {
    const T = TEXT[lang];
    const run = `${lang}${Date.now().toString(36)}`;
    const superEmail = `super-${run}@example.test`;
    const adminEmail = `admin-${run}@example.test`;
    const userEmail = `user-${run}@example.test`;
    const orgName = `Empresa E2E ${run}`;

    const superId = await ensureUser(superEmail);
    await serviceClient().from('platform_admins').upsert({ user_id: superId });

    await page.goto('/');
    if (lang === 'en') {
      await page.locator('#language-select').selectOption('en');
    }
    await expect(page.getByRole('button', { name: T.signIn, exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);

    // 1. Superadmin crea la empresa e invita a su admin.
    await signIn(page, superEmail, lang);
    await page.getByRole('button', { name: T.companies }).click();
    await page.locator('#org-name').fill(orgName);
    await page.locator('#org-admin').fill(adminEmail);
    await page.locator('#org-specialty').selectOption(T.specialtyValue);
    await page.getByRole('button', { name: T.create }).click();
    await expect(page.locator('#org-name-header')).toHaveText(orgName);
    await expect(page.locator('#org-tagline')).toContainText(T.specialty);
    await signOut(page, lang);

    // 2. El admin acepta la invitación y sube un PDF.
    await acceptInvite(page, adminEmail, lang);
    await expect(page.locator('#org-name-header')).toHaveText(orgName);
    await expect(page.locator('#role-badge')).toHaveText(T.roleAdmin);
    await expect(page.getByRole('heading', { name: T.docsTitle })).toBeVisible();
    await page.getByRole('button', { name: T.upload, exact: true }).click();
    await page.locator('#pdf-upload').setInputFiles(PDF);
    await page.getByRole('button', { name: T.uploadButton }).click();
    const doc = page.locator('[data-document-name="especificacion.pdf"]');
    await expect(doc.locator('[data-status]')).toHaveText(T.ready, { timeout: 60_000 });

    // 3. El admin pone el logo e invita a un usuario.
    await page.getByRole('button', { name: T.users }).click();
    await page.locator('#org-logo-file').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
    await page.getByRole('button', { name: T.saveOrg }).click();
    await expect(page.getByText(T.saved)).toBeVisible();
    await page.locator('#invite-email').fill(userEmail);
    await page.locator('#invite-role').selectOption('user');
    await page.getByRole('button', { name: T.invite, exact: true }).click();
    await expect(page.getByRole('status')).toContainText(T.inviteSent);
    await expect(page.locator('#members-list')).toContainText(userEmail);
    await page.keyboard.press('Escape');
    await expect(page.locator('#org-logo')).toBeVisible();
    await signOut(page, lang);

    // 4. El usuario acepta, ve el documento (sin gestión de usuarios) y pregunta.
    await acceptInvite(page, userEmail, lang);
    await expect(page.locator('#org-name-header')).toHaveText(orgName);
    await expect(page.locator('#role-badge')).toHaveText(T.roleUser);
    await expect(page.getByRole('button', { name: T.users })).toHaveCount(0);
    await expect(page.getByRole('button', { name: T.companies })).toHaveCount(0);
    await expect(doc.locator('[data-status]')).toHaveText(T.ready);
    await expect(doc.getByRole('button', { name: /Borrar|Delete/ })).toHaveCount(0);

    await doc.getByRole('button', { name: T.summary }).click();
    await expect(page.locator('#summary')).toContainText(T.summaryTitle);
    await page.locator('#btn-back').click();

    await doc.getByRole('button', { name: T.chat, exact: true }).click();
    await expect(page.getByText(T.private)).toBeVisible();
    await page.locator('#chat-input').fill(lang === 'es' ? '¿Qué calibre tiene el alimentador principal?' : 'What gauge is the main feeder?');
    await page.locator('#btn-send').click();
    const answer = page.locator('#chat-messages [data-sender="bot"]').last();
    await expect(answer).toContainText(T.answer, { timeout: 60_000 });
    await expect(answer).toContainText('4/0 AWG');
    // Los datos personales del PDF llegan anonimizados.
    await expect(answer).not.toContainText('residente@ejemplo.com');

    // La conversación se conserva al volver a entrar en el chat.
    await page.locator('#btn-back').click();
    await doc.getByRole('button', { name: T.chat, exact: true }).click();
    await expect(page.locator('#chat-messages [data-sender="bot"]').last()).toContainText('4/0 AWG');
  });
}
