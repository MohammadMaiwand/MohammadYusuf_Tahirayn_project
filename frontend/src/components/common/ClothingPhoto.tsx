import { useEffect, useState } from 'react';
import { env } from '../../lib/env';
import { branch } from '../../services/api';
import { useTranslation } from 'react-i18next';

export function ClothingPhoto({
  photoId,
  branchId = branch(),
  large = false,
}: {
  photoId?: string | null | undefined;
  branchId?: string;
  large?: boolean;
}) {
  const { t } = useTranslation();
  const [src, setSrc] = useState('');
  useEffect(() => {
    setSrc('');
    if (!photoId) return;
    const abort = new AbortController();
    let url = '';
    void fetch(
      `${env.VITE_API_URL}/branches/${encodeURIComponent(branchId)}/clothing-photos/${encodeURIComponent(photoId)}`,
      { credentials: 'include', signal: abort.signal },
    )
      .then(async (response) => {
        if (!response.ok) return;
        const blob = await response.blob();
        if (abort.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      abort.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId, branchId]);
  return src ? (
    <img
      className={`clothing-photo ${large ? 'large' : ''}`}
      src={src}
      alt={t('clothing.photo')}
    />
  ) : (
    <span
      className={`clothing-photo placeholder ${large ? 'large' : ''}`}
      role="img"
      aria-label={t('clothing.noPhoto')}
    >
      ◇
    </span>
  );
}
