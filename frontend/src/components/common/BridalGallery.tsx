import { useEffect, useState } from 'react';
import { Pause, Play, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from './motion';
import './entry.css';

const photos = [
  {
    file: 'ivory',
    key: 'entry.ivory',
    by: 'Nataliya Vaitkevich',
    source:
      'https://www.pexels.com/photo/woman-wearing-white-wedding-dress-4456471/',
  },
  {
    file: 'elegance',
    key: 'entry.elegance',
    by: 'Hiren Lad',
    source:
      'https://www.pexels.com/photo/woman-wearing-white-wedding-dress-2929632/',
  },
  {
    file: 'atelier',
    key: 'entry.atelier',
    by: 'Esma Atak',
    source: 'https://www.pexels.com/photo/bride-wearing-white-dress-20370082/',
  },
];

export function BridalGallery({ complete = false }: { complete?: boolean }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => {
    const changed = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  const playing = !paused && !reduced;
  useEffect(() => {
    if (!playing || interacting || !visible) return;
    const timer = setInterval(
      () => setActive((value) => (value + 1) % photos.length),
      6500,
    );
    return () => clearInterval(timer);
  }, [playing, interacting, visible]);
  return (
    <section
      className={`bridal-gallery${complete ? ' bridal-gallery-complete' : ''}`}
      aria-label={t('entry.gallery')}
      aria-roledescription={t('entry.slideshow')}
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setInteracting(false);
      }}
    >
      <div className="bridal-fallback" aria-hidden="true">
        <Sparkles size={50} />
        <span>MYT</span>
      </div>
      {photos.map((photo, index) => (
        <div
          key={photo.file}
          className={`bridal-slide ${active === index ? 'is-active' : ''}`}
          aria-hidden={active !== index}
        >
          {!failed.includes(photo.file) && (
            <img
              src={`/images/bridal/${photo.file}.jpg`}
              alt={t(photo.key)}
              width={1200}
              height={photo.file === 'elegance' ? 800 : 1800}
              fetchPriority={index === 0 ? 'high' : 'auto'}
              decoding="async"
              onError={() => setFailed((items) => [...items, photo.file])}
            />
          )}
        </div>
      ))}
      <div className="bridal-badge">
        <Sparkles size={15} /> {t('entry.inspiration')}
      </div>
      <div className="bridal-caption" aria-live="off">
        <span className="bridal-caption-kicker">
          MYT · {t('entry.bridalInspiration')}
        </span>
        <h2>{t(photos[active]!.key)}</h2>
        <p>{t('entry.galleryNote')}</p>
        <div className="bridal-gallery-bottom">
          <div className="bridal-controls">
            {!reduced && (
              <button
                type="button"
                onClick={() => setPaused(!paused)}
                aria-label={t(playing ? 'entry.pause' : 'entry.play')}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
            )}
            {photos.map((photo, index) => (
              <button
                key={photo.file}
                type="button"
                className="bridal-dot"
                aria-label={t(photo.key)}
                aria-pressed={active === index}
                onClick={() => setActive(index)}
              >
                <span />
              </button>
            ))}
          </div>
          <a href={photos[active]!.source} target="_blank" rel="noreferrer">
            {photos[active]!.by} · Pexels ↗
          </a>
        </div>
      </div>
    </section>
  );
}
