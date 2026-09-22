import { stdin as input, stdout as output } from 'node:process';
import { pathToFileURL } from 'node:url';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module.js';
import { LocalReviewProvisioningService, type LocalReviewProvisioningReport } from './local-review-provisioning.service.js';

type JsonRecord = Record<string, unknown>;

async function readHiddenPassword(): Promise<string | undefined> {
  if (!input.isTTY || !output.isTTY) return undefined;
  output.write('Local review password: ');
  return new Promise((resolve) => {
    let value = '';
    const complete = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
      resolve(value || undefined);
    };
    const onData = (chunk: Buffer) => {
      const character = chunk.toString('utf8');
      if (character === '\r' || character === '\n') return complete();
      if (character === '\u0003') { value = ''; return complete(); }
      if (character === '\b' || character === '\u007f') { value = value.slice(0, -1); return; }
      value += character;
    };
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

async function requestJson(url: string, init?: RequestInit): Promise<{ status: number; body: JsonRecord }> {
  const response = await fetch(url, init);
  const body = await response.json() as JsonRecord;
  return { status: response.status, body };
}

async function waitForRuntime(url: string, attempts = 40): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`review-runtime-unavailable-${url}`);
}

async function verifyRuntime(report: LocalReviewProvisioningReport, password: string): Promise<void> {
  const base = 'http://127.0.0.1:3000';
  await waitForRuntime(`${base}/health/live`);
  await waitForRuntime('http://127.0.0.1:8081');
  const passportByKey = new Map(report.passports.map((passport) => [passport.key, passport.passportId]));
  const academyId = report.academyId;
  const documents = ['NTREV-ADULT-001', 'NTREV-DRAFT-001', 'NTREV-REPONE-001', 'NTREV-REPMULTI-001', 'NTREV-REPMULTI-002', 'NTREV-MIXED-001', 'NTREV-ACADEMY-001', 'NTREV-ACADEMY-002', 'NTREV-DUPLICATE-BASE', 'NTREV-DUPLICATE-REVIEW', 'NTREV-ANALYST-001', 'NTREV-ADMIN-001', 'NTREV-TUTOR-001'];
  const sessions = new Map<string, string>();
  for (const account of report.accounts) {
    const login = await requestJson(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: account.email, password }) });
    if (![200, 201].includes(login.status) || typeof login.body.accessToken !== 'string') throw new Error(`review-login-failed-${account.email}-${login.status}`);
    sessions.set(account.key, login.body.accessToken);
  }
  const get = async (accountKey: string, path: string) => {
    const token = sessions.get(accountKey);
    if (!token) throw new Error(`review-session-missing-${accountKey}`);
    return requestJson(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } });
  };
  const particular = async (key: string) => get(key, '/passports?context=PARTICULAR');
  const academy = async (key: string) => get(key, `/passports?context=ACADEMY&academyId=${academyId}`);
  const adult = await particular('adult');
  const representativeOne = await particular('representativeOne');
  const representativeMultiple = await particular('representativeMultiple');
  const academyPortfolio = await academy('academy');
  const mixedParticular = await particular('mixed');
  const mixedAcademy = await academy('mixed');
  const unauthorized = await particular('unauthorized');
  const size = (result: { body: JsonRecord }) => Array.isArray(result.body.passports) ? result.body.passports.length : -1;
  if (size(adult) !== 1 || size(representativeOne) !== 1 || size(representativeMultiple) !== 2 || size(academyPortfolio) < 2 || size(mixedParticular) !== 1 || size(mixedAcademy) < 2 || size(unauthorized) !== 0) throw new Error('review-runtime-collection-shape');
  const duplicateId = passportByKey.get('duplicate-review');
  const approvedId = passportByKey.get('admin-approved');
  if (!duplicateId || !approvedId) throw new Error('review-runtime-passport-missing');
  const analyst = await get('analyst', `/passports/${duplicateId}`);
  const administrator = await get('admin', `/passports/${approvedId}`);
  const analystActions = Array.isArray(analyst.body.availableActions) ? analyst.body.availableActions : [];
  const administratorActions = Array.isArray(administrator.body.availableActions) ? administrator.body.availableActions : [];
  const analystText = JSON.stringify(analystActions);
  const administratorText = JSON.stringify(administratorActions);
  if (!analystText.includes('RESOLVE_DUPLICATE') || analystText.includes('ACTIVATE')) throw new Error('review-runtime-analyst-capabilities');
  if (!administratorText.includes('ACTIVATE') || administratorText.includes('APPROVE')) throw new Error('review-runtime-administrator-capabilities');
  const presentationAccounts: Record<string, string> = {
    'adult-active': 'adult', 'adult-draft': 'adultDraft', 'represented-one': 'representativeOne',
    'represented-returned': 'representativeMultiple', 'represented-active': 'representativeMultiple', 'mixed-self': 'mixed',
    'academy-active': 'academy', 'academy-draft': 'academy', 'duplicate-base': 'academy', 'duplicate-review': 'academy',
    'analyst-candidate': 'academy', 'admin-approved': 'academy', 'historical-tutor': 'tutor',
  };
  const presentations: JsonRecord[] = [];
  for (const passport of report.passports) {
    const accountKey = presentationAccounts[passport.key];
    if (!accountKey) throw new Error(`review-presentation-account-${passport.key}`);
    const result = await get(accountKey, `/passports/${passport.passportId}/presentation`);
    if (result.status !== 200) throw new Error(`review-presentation-status-${passport.key}-${result.status}`);
    const identity = result.body.identity as JsonRecord | undefined;
    const sections = Array.isArray(result.body.sections) ? result.body.sections as JsonRecord[] : [];
    const available = (field: unknown) => typeof field === 'object' && field !== null && (field as JsonRecord).availability === 'AVAILABLE' && typeof (field as JsonRecord).value === 'string' && ((field as JsonRecord).value as string).length > 0;
    if (!identity || typeof identity.displayName !== 'string' || !available(identity.primaryPosition) || !available(identity.declaredAgeCategory) || !available(identity.city) || !available(identity.country) || !available(identity.dominantFoot)) throw new Error(`review-presentation-summary-${passport.key}`);
    if ((identity.photograph as JsonRecord | undefined)?.state !== 'NEUTRAL_LOCAL_PLACEHOLDER' || result.body.lifecycleState !== passport.state) throw new Error(`review-presentation-identity-${passport.key}`);
    if (passport.key.startsWith('academy-') || ['duplicate-base', 'duplicate-review', 'analyst-candidate', 'admin-approved'].includes(passport.key)) {
      if (!available(identity.academyOrigin) || (identity.academyOrigin as JsonRecord).value !== report.academyDisplayName) throw new Error(`review-presentation-academy-${passport.key}`);
    }
    for (const section of ['STATISTICS', 'MATCHES', 'VIDEOS']) {
      if (!sections.some((item) => item.section === section && item.availability === 'FUTURE_DEPENDENCY')) throw new Error(`review-presentation-future-${passport.key}-${section}`);
    }
    presentations.push(result.body);
  }
  const draftId = passportByKey.get('adult-draft');
  if (!draftId) throw new Error('review-runtime-draft-missing');
  const draftStatus = await get('adultDraft', `/passports/${draftId}`);
  const draftActions = Array.isArray(draftStatus.body.availableActions) ? JSON.stringify(draftStatus.body.availableActions) : '';
  if (!draftActions.includes('EDIT') || !draftActions.includes('SUBMIT')) throw new Error('review-runtime-draft-actions');
  const allPublic = JSON.stringify([adult.body, representativeOne.body, representativeMultiple.body, academyPortfolio.body, mixedParticular.body, mixedAcademy.body, unauthorized.body, analyst.body, administrator.body, draftStatus.body, ...presentations]);
  if (documents.some((document) => allPublic.includes(document)) || allPublic.includes(password)) throw new Error('review-runtime-protected-data');
  const frontendRoutes = ['adult-active', 'represented-one', 'academy-active', 'duplicate-review', 'admin-approved'];
  for (const key of frontendRoutes) {
    const passportId = passportByKey.get(key);
    if (!passportId) throw new Error(`review-route-missing-${key}`);
    const response = await fetch(`http://127.0.0.1:8081/passports/${passportId}/sections/resumen`);
    if (!response.ok) throw new Error(`review-frontend-route-${key}-${response.status}`);
  }
  output.write(`runtime-verification logins=${report.accounts.length} direct=2 selector=1 portfolio=1 mixed=2 capabilities=3 summaries=${presentations.length} future-sections=39 protected-data=clean nested-routes=${frontendRoutes.length}\n`);
}

export async function runProvisionReviewCommand(): Promise<number> {
  const password = await readHiddenPassword();
  if (!password) { output.write('review-provision-refused\n'); return 2; }
  const context = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: ['error', 'warn'] });
  try {
    const report = await context.get(LocalReviewProvisioningService).provision(password);
    await verifyRuntime(report, password);
    output.write(`${JSON.stringify(report, null, 2)}\n`);
    output.write('review-provision-complete\n');
    return 0;
  } catch (error) {
    const category = error instanceof Error ? error.message : 'unknown';
    output.write(`review-provision-failed ${category}\n`);
    return 1;
  } finally {
    await context.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProvisionReviewCommand().then((exitCode) => { process.exitCode = exitCode; });
}
