import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowLeft,
  LockKeyhole,
  UserRound,
  Mail,
  Building2,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router';
import { branches } from '@myt/shared';
import * as api from '../../services/api';
import { usePreferences } from '../../stores/preferences';
import { Button, ErrorState } from '../../components/common/ui';
import { AppearanceControls } from '../../components/common/Appearance';
import { BridalGallery } from '../../components/common/BridalGallery';
interface Challenge {
  challenge: string;
  image?: string;
  question?: string;
}
export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const { t, i18n } = useTranslation();
  const { language, setLanguage } = usePreferences();
  const [role, setRole] = useState('employee'),
    [branch, setBranch] = useState('sham-royal'),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [answer, setAnswer] = useState(''),
    [show, setShow] = useState(false),
    [accessible, setAccessible] = useState(false),
    [challenge, setChallenge] = useState<Challenge>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  useEffect(() => {
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
  }, [language, i18n]);
  function refresh(mode = accessible) {
    setChallenge(undefined);
    setAnswer('');
    void api
      .request<Challenge>(`/auth/captcha${mode ? '?mode=accessible' : ''}`)
      .then(setChallenge)
      .catch(setError);
  }
  useEffect(() => {
    refresh(false);
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError(undefined);
    try {
      await api.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          role,
          branchId: role === 'admin' ? null : branch,
          name,
          email: email.trim().toLowerCase(),
          password,
          challenge: challenge.challenge,
          answer,
        }),
      });
      localStorage.removeItem('myt-logged-out');
      setPassword('');
      onLogin();
    } catch (err) {
      setError(err);
      refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand">
          <span className="myt-wordmark" aria-hidden="true">
            MYT
          </span>
          <span>
            <strong>{t('app.company')}</strong>
            <small>{t('design.companyMotto')}</small>
          </span>
        </div>
        <div className="login-story-copy">
          <span className="entry-eyebrow">{t('entry.workspace')}</span>
          <h1>{t('auth.welcome')}</h1>
          <p>{t('entry.story')}</p>
        </div>
        <BridalGallery complete />
        <div className="login-branches">
          {branches
            .filter((b) => b.active)
            .map((b) => (
              <span key={b.id}>{t('branch.' + b.id)}</span>
            ))}
        </div>
        <div className="login-trust">
          <ShieldCheck size={20} />
          <span>{t('entry.trust')}</span>
        </div>
      </section>
      <section className="login-card">
        <div className="login-card-top">
          <Link to="/" className="login-back">
            <ArrowLeft size={17} />
            {t('entry.home')}
          </Link>
          <AppearanceControls themeOnly />
          <select
            aria-label={t('common.language')}
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
          >
            <option value="fa-AF">دری</option>
            <option value="ps-AF">پښتو</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="login-intro">
          <span className="login-lock">
            <LockKeyhole size={22} />
          </span>
          <div>
            <span className="login-form-kicker">{t('entry.staffAccess')}</span>
            <h2>{t('auth.login')}</h2>
            <p>{t('entry.loginHint')}</p>
          </div>
        </div>
        <form onSubmit={(e) => void submit(e)}>
          <label className="field">
            <span>
              <UsersRound size={15} aria-hidden="true" />
              {t('auth.role')}
            </span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {['admin', 'manager', 'employee'].map((r) => (
                <option key={r} value={r}>
                  {t('session.' + r)}
                </option>
              ))}
            </select>
          </label>
          {role === 'admin' ? (
            <p className="login-global">{t('auth.global')}</p>
          ) : (
            <label className="field">
              <span>
                <Building2 size={15} aria-hidden="true" />
                {t('auth.branch')}
              </span>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              >
                {branches
                  .filter((b) => b.active)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {t('branch.' + b.id)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>
              <UserRound size={15} aria-hidden="true" />
              {t('auth.name')}
            </span>
            <input
              required
              maxLength={160}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>
              <Mail size={15} aria-hidden="true" />
              {t('auth.email')}
            </span>
            <input
              required
              type="email"
              dir="ltr"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field login-password">
            <span>
              <LockKeyhole size={15} aria-hidden="true" />
              {t('auth.password')}
            </span>
            <div className="password-control">
              <input
                required
                type={show ? 'text' : 'password'}
                dir="ltr"
                autoComplete="current-password"
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={t(show ? 'auth.hide' : 'auth.show')}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <fieldset className="captcha-box">
            <legend>{t('auth.captcha')}</legend>
            {challenge?.image ? (
              <img src={challenge.image} alt={t('auth.captcha')} />
            ) : (
              <p dir="ltr" className="captcha-question">
                {challenge?.question || '…'}
              </p>
            )}
            <input
              aria-label={t('auth.captcha')}
              required
              autoComplete="off"
              maxLength={20}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              dir="ltr"
            />
            <div className="captcha-actions">
              <button type="button" onClick={() => refresh()}>
                {t('auth.refreshCaptcha')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccessible(!accessible);
                  refresh(!accessible);
                }}
              >
                {t(accessible ? 'auth.visual' : 'auth.accessible')}
              </button>
            </div>
          </fieldset>
          {error !== undefined && <ErrorState error={error} />}
          <Button type="submit" loading={busy} disabled={busy || !challenge}>
            <LockKeyhole size={17} />
            {t('auth.login')}
          </Button>
        </form>
        <p className="login-help">{t('entry.accountHelp')}</p>
      </section>
    </main>
  );
}
