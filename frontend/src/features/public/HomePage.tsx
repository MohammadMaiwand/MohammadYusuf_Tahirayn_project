import { Link } from 'react-router';
import {
  Building2,
  Shirt,
  CalendarDays,
  ArrowLeft,
  Gem,
  ExternalLink,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { branches } from '@myt/shared';
import { AppearanceControls } from '../../components/common/Appearance';
import { BridalGallery } from '../../components/common/BridalGallery';
import { env } from '../../lib/env';
import { branchLabel } from '../../lib/branchLabel';
import { usePreferences } from '../../stores/preferences';
import './public.css';

interface PublicAd {
  _id: string;
  title: string;
  body: string;
  linkUrl: string;
  linkLabel: string;
  photoId: string | null;
}
const adImage = (id: string) =>
  `${env.VITE_API_URL}/public/advertisements/${id}/image`;
const adHref = (url: string) => {
  const value = url.trim();
  return /^(https?:\/\/|\/)/i.test(value) ? value : '';
};
export default function HomePage() {
  const { t, i18n } = useTranslation();
  const { language, setLanguage } = usePreferences();
  const [ads, setAds] = useState<PublicAd[]>([]);
  const rtl = language !== 'en';
  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [i18n, language]);
  useEffect(() => {
    const { lang, dir } = document.documentElement;
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
    return () => {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
    };
  }, [language]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch(`${env.VITE_API_URL}/public/advertisements`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : { data: [] }))
      .then((payload) =>
        setAds(Array.isArray(payload?.data) ? payload.data : []),
      )
      .catch(() => undefined)
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);
  const contact = import.meta.env.VITE_PUBLIC_CONTACT as string | undefined;
  const address = import.meta.env.VITE_PUBLIC_ADDRESS as string | undefined;
  const introduction = import.meta.env.VITE_PUBLIC_INTRODUCTION as
    string | undefined;
  const digits = new Intl.NumberFormat(i18n.language);
  return (
    <div className="public-site" dir={rtl ? 'rtl' : 'ltr'} lang={language}>
      <header className="public-header">
        <a href="#home" className="public-brand">
          <span className="public-logo" aria-label={t('publicSite.logoLabel')}>
            MYT
          </span>
          <span>
            {t('publicSite.brand')}
            <small>{t('publicSite.brandSuffix')}</small>
          </span>
        </a>
        <nav aria-label={t('publicSite.navLabel')}>
          <a href="#home">{t('publicSite.nav.home')}</a>
          <a href="#about">{t('publicSite.nav.about')}</a>
          <a href="#services">{t('publicSite.nav.services')}</a>
          <a href="#branches">{t('publicSite.nav.branches')}</a>
          <a href="#contact">{t('publicSite.nav.contact')}</a>
        </nav>
        <div className="public-header-actions">
          <AppearanceControls themeOnly />
          <select
            aria-label={t('common.language')}
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value as typeof language)
            }
          >
            <option value="fa-AF">دری</option>
            <option value="ps-AF">پښتو</option>
            <option value="en">English</option>
          </select>
          <Link className="public-login" to="/login">
            {t('auth.login')} <ArrowLeft size={16} />
          </Link>
        </div>
      </header>
      <main>
        <section id="home" className="public-hero">
          <div className="public-hero-copy">
            <p className="public-kicker">{t('publicSite.heroKicker')}</p>
            <h1>
              {t('publicSite.heroTitle')}
              <br />
              <em>{t('publicSite.brand')}</em>
            </h1>
            <p>{t('publicSite.heroText')}</p>
            <div className="public-actions">
              <a href="#branches" className="public-login">
                {t('publicSite.ctaBranches')} <ArrowLeft size={17} />
              </a>
              <a href="#services">{t('publicSite.ctaServices')}</a>
            </div>
          </div>
          <div className="public-showcase">
            <BridalGallery />
            <span className="public-showcase-seal">
              <Gem size={20} />
              {t('publicSite.seal')}
            </span>
          </div>
        </section>
        {ads.length > 0 && (
          <section id="ads" className="public-section public-ads">
            <p className="public-kicker">{t('publicSite.adsKicker')}</p>
            <h2>{t('publicSite.adsTitle')}</h2>
            <div className="public-ads-grid">
              {ads.map((ad) => {
                const href = adHref(ad.linkUrl);
                return (
                  <article className="ad-banner" key={ad._id}>
                    {ad.photoId && (
                      <div className="ad-banner-media">
                        <img
                          src={adImage(ad.photoId)}
                          alt={ad.title}
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="ad-banner-body">
                      <h3>{ad.title}</h3>
                      {ad.body && <p>{ad.body}</p>}
                      {href && (
                        <a
                          className="ad-banner-link"
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {ad.linkLabel || t('publicSite.readMore')}
                          <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
        <section id="about" className="public-section public-about">
          <p className="public-kicker">{t('publicSite.aboutKicker')}</p>
          <h2>{t('publicSite.aboutTitle')}</h2>
          <p>{introduction || t('publicSite.aboutText')}</p>
        </section>
        <section id="services" className="public-section">
          <p className="public-kicker">{t('publicSite.servicesKicker')}</p>
          <h2>{t('publicSite.servicesTitle')}</h2>
          <div className="public-grid">
            {[
              {
                title: 'publicSite.saleTitle',
                text: 'publicSite.saleText',
                Icon: Shirt,
              },
              {
                title: 'publicSite.rentTitle',
                text: 'publicSite.rentText',
                Icon: Gem,
              },
              {
                title: 'publicSite.reserveTitle',
                text: 'publicSite.reserveText',
                Icon: CalendarDays,
              },
            ].map(({ title, text, Icon }) => (
              <article key={title}>
                <Icon size={29} />
                <h3>{t(title)}</h3>
                <p>{t(text)}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="branches" className="public-section">
          <p className="public-kicker">{t('publicSite.branchesKicker')}</p>
          <h2>{t('publicSite.branchesTitle')}</h2>
          <div className="public-grid">
            {branches
              .filter((item) => item.active)
              .map((item, index) => (
                <article key={item.id}>
                  <span className="public-branch-number">
                    {digits.format(index + 1)}
                  </span>
                  <Building2 size={26} />
                  <h3>{branchLabel(item.id, item.name)}</h3>
                  <p>
                    {item.id === 'dollar'
                      ? t('publicSite.branchDollarText')
                      : t('publicSite.branchServiceText')}
                  </p>
                  <a href="#contact">
                    {t('publicSite.contactDetails')} <ArrowLeft size={15} />
                  </a>
                </article>
              ))}
          </div>
        </section>
        <section id="contact" className="public-section public-contact">
          <div>
            <p className="public-kicker">{t('publicSite.contactKicker')}</p>
            <h2>{t('publicSite.contactTitle')}</h2>
            <p>{contact || t('publicSite.contactPending')}</p>
            <p>{address || t('publicSite.addressPending')}</p>
          </div>
          <div>
            <h3>{t('publicSite.staffTitle')}</h3>
            <p>{t('publicSite.staffText')}</p>
            <Link className="public-login" to="/login">
              {t('auth.login')} <ArrowLeft size={16} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <span>{t('app.company')}</span>
        <a href="#home">{t('publicSite.backToTop')}</a>
      </footer>
    </div>
  );
}
