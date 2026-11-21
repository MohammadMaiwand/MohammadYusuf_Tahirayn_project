import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
  ExternalLink,
  Power,
} from 'lucide-react';
import * as api from '../../services/api';
import { env } from '../../lib/env';
import { JalaliPicker } from '../../components/forms/JalaliPicker';
import {
  Button,
  Confirm,
  Empty,
  ErrorState,
  Field,
  Loading,
  Modal,
  toast,
  useFormat,
  useSave,
} from '../../components/common/ui';

interface Advertisement {
  _id: string;
  branchId: string | null;
  title: string;
  body: string;
  linkUrl: string;
  linkLabel: string;
  photoId: string | null;
  active: boolean;
  order: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  provisional?: boolean;
}
type Draft = Pick<
  Advertisement,
  | 'title'
  | 'body'
  | 'linkUrl'
  | 'linkLabel'
  | 'photoId'
  | 'active'
  | 'order'
  | 'startsAt'
  | 'endsAt'
>;
const imageUrl = (id: string) =>
  `${env.VITE_API_URL}/public/advertisements/${id}/image`;
const toDraft = (ad: Advertisement): Draft => ({
  title: ad.title,
  body: ad.body,
  linkUrl: ad.linkUrl,
  linkLabel: ad.linkLabel,
  photoId: ad.photoId,
  active: ad.active,
  order: ad.order,
  startsAt: ad.startsAt,
  endsAt: ad.endsAt,
});
const payload = (draft: Draft) => ({
  title: draft.title.trim(),
  body: draft.body.trim(),
  linkUrl: draft.linkUrl.trim(),
  linkLabel: draft.linkLabel.trim(),
  photoId: draft.photoId,
  active: draft.active,
  order: draft.order,
  startsAt: draft.startsAt,
  endsAt: draft.endsAt,
});
function statusOf(ad: Advertisement) {
  if (!ad.active) return 'inactive';
  const now = Date.now();
  if (ad.startsAt && Date.parse(ad.startsAt) > now) return 'scheduled';
  if (ad.endsAt && Date.parse(ad.endsAt) < now) return 'expired';
  return 'active';
}
function AdvertisementForm({
  initial,
  onClose,
}: {
  initial: Advertisement | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(
    initial
      ? toDraft(initial)
      : {
          title: '',
          body: '',
          linkUrl: '',
          linkLabel: '',
          photoId: null,
          active: true,
          order: 0,
          startsAt: null,
          endsAt: null,
        },
  );
  const [titleMissing, setTitleMissing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const save = useSave(async (value: Draft) => {
    const body = JSON.stringify(payload(value));
    return initial
      ? await api.request(`/advertisements/${initial._id}`, {
          method: 'PATCH',
          body,
        })
      : await api.request('/advertisements', { method: 'POST', body });
  }, onClose);
  const pickPhoto = async (selected: File) => {
    if (selected.size > 5 * 1024 * 1024) {
      toast('error.photo_too_large');
      return;
    }
    setUploading(true);
    try {
      const encoded = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(selected);
      });
      const result = await api.request<{ photoId: string }>(
        '/advertisements/photos',
        {
          method: 'POST',
          body: JSON.stringify({ data: encoded }),
          signal: AbortSignal.timeout(60000),
        },
      );
      setDraft((current) => ({ ...current, photoId: result.photoId }));
    } catch (error) {
      toast(
        error instanceof api.ApiError
          ? `error.${error.code}`
          : 'error.request_failed',
      );
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  };
  return (
    <Modal
      title={initial ? 'advertisements.edit' : 'advertisements.add'}
      onClose={onClose}
      size="large"
    >
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.title.trim()) {
            setTitleMissing(true);
            return;
          }
          save.mutate(draft);
        }}
      >
        <Field
          label="advertisements.title"
          required
          error={titleMissing ? true : undefined}
        >
          <input
            value={draft.title}
            maxLength={160}
            onChange={(event) => {
              setTitleMissing(false);
              setDraft({ ...draft, title: event.target.value });
            }}
          />
        </Field>
        <Field label="advertisements.body" error={undefined}>
          <textarea
            value={draft.body}
            maxLength={2000}
            rows={3}
            onChange={(event) =>
              setDraft({ ...draft, body: event.target.value })
            }
          />
        </Field>
        <div className="ad-photo-field">
          <span>{t('advertisements.photo')}</span>
          <div className="ad-photo-control">
            <div className="ad-photo-preview">
              {draft.photoId ? (
                <img src={imageUrl(draft.photoId)} alt="" />
              ) : (
                <Megaphone size={30} aria-hidden="true" />
              )}
            </div>
            <div className="ad-photo-actions">
              <input
                ref={file}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) void pickPhoto(selected);
                }}
              />
              <Button
                type="button"
                className="secondary"
                loading={uploading}
                onClick={() => file.current?.click()}
              >
                <Upload size={16} />
                {t(
                  draft.photoId
                    ? 'advertisements.changePhoto'
                    : 'advertisements.upload',
                )}
              </Button>
              {draft.photoId && !uploading && (
                <Button
                  type="button"
                  className="ghost danger"
                  onClick={() => setDraft({ ...draft, photoId: null })}
                >
                  <X size={16} />
                  {t('advertisements.removePhoto')}
                </Button>
              )}
              <small className="field-hint">
                {t('advertisements.imageHint')}
              </small>
            </div>
          </div>
        </div>
        <Field label="advertisements.linkUrl">
          <input
            value={draft.linkUrl}
            maxLength={500}
            dir="ltr"
            placeholder="https://"
            onChange={(event) =>
              setDraft({ ...draft, linkUrl: event.target.value })
            }
          />
        </Field>
        <Field label="advertisements.linkLabel">
          <input
            value={draft.linkLabel}
            maxLength={60}
            onChange={(event) =>
              setDraft({ ...draft, linkLabel: event.target.value })
            }
          />
        </Field>
        <Field label="advertisements.order" hint="advertisements.orderNote">
          <input
            type="number"
            min={0}
            max={100000}
            dir="ltr"
            value={draft.order}
            onChange={(event) =>
              setDraft({
                ...draft,
                order: Math.max(0, Number(event.target.value) || 0),
              })
            }
          />
        </Field>
        <label className="ad-toggle">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) =>
              setDraft({ ...draft, active: event.target.checked })
            }
          />
          <span>{t('advertisements.active')}</span>
        </label>
        <div className="ad-schedule">
          <div>
            <JalaliPicker
              label="advertisements.startsAt"
              value={draft.startsAt || ''}
              onChange={(value) => setDraft({ ...draft, startsAt: value })}
            />
            {draft.startsAt && (
              <Button
                type="button"
                className="ghost"
                onClick={() => setDraft({ ...draft, startsAt: null })}
              >
                {t('advertisements.clearDate')}
              </Button>
            )}
          </div>
          <div>
            <JalaliPicker
              label="advertisements.endsAt"
              value={draft.endsAt || ''}
              onChange={(value) => setDraft({ ...draft, endsAt: value })}
            />
            {draft.endsAt && (
              <Button
                type="button"
                className="ghost"
                onClick={() => setDraft({ ...draft, endsAt: null })}
              >
                {t('advertisements.clearDate')}
              </Button>
            )}
          </div>
        </div>
        {save.error && <ErrorState error={save.error} />}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export default function AdvertisementsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Advertisement | null>(null);
  const [removing, setRemoving] = useState<Advertisement | null>(null);
  const query = useQuery({
    queryKey: ['advertisements'],
    queryFn: () => api.request<Advertisement[]>('/advertisements'),
    staleTime: 30000,
  });
  const remove = useSave(
    (id: string) => api.request(`/advertisements/${id}`, { method: 'DELETE' }),
    () => setRemoving(null),
  );
  const toggle = useSave((ad: Advertisement) =>
    api.request(`/advertisements/${ad._id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload({ ...toDraft(ad), active: !ad.active })),
    }),
  );
  const rows = query.data || [];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('nav.advertisements')}</h1>
          <p>{t('advertisements.scope')}</p>
        </div>
        <div className="row-actions">
          <Button onClick={() => setCreating(true)}>
            <Plus size={17} />
            {t('advertisements.add')}
          </Button>
        </div>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !rows.length ? (
        <Empty />
      ) : (
        <div className="ad-list">
          {rows.map((ad) => {
            const status = statusOf(ad);
            const href = /^(https?:\/\/|\/)/i.test(ad.linkUrl.trim())
              ? ad.linkUrl.trim()
              : '';
            return (
              <article className={`ad-card status-${status}`} key={ad._id}>
                <div className="ad-card-media">
                  {ad.photoId ? (
                    <img src={imageUrl(ad.photoId)} alt="" loading="lazy" />
                  ) : (
                    <Megaphone size={30} aria-hidden="true" />
                  )}
                </div>
                <div className="ad-card-body">
                  <header>
                    <h3>{ad.title}</h3>
                    <span className={`badge status-${status}`}>
                      {t(`advertisements.status.${status}`)}
                    </span>
                  </header>
                  {ad.body && <p>{ad.body}</p>}
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={15} />
                      {ad.linkLabel || href}
                    </a>
                  )}
                  <dl className="ad-card-meta">
                    <div>
                      <dt>{t('advertisements.ownerScope')}</dt>
                      <dd>
                        {ad.branchId
                          ? t(`branch.${ad.branchId}`, {
                              defaultValue: ad.branchId,
                            })
                          : t('advertisements.companyWide')}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('advertisements.order')}</dt>
                      <dd>{ad.order}</dd>
                    </div>
                    <div>
                      <dt>{t('advertisements.schedule')}</dt>
                      <dd>
                        {ad.startsAt || ad.endsAt
                          ? `${ad.startsAt ? fmt.date(ad.startsAt) : t('advertisements.always')} — ${ad.endsAt ? fmt.date(ad.endsAt) : t('advertisements.always')}`
                          : t('advertisements.always')}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="ad-card-actions">
                  <Button
                    className="ghost"
                    aria-label={t('advertisements.active')}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(ad)}
                  >
                    <Power size={17} />
                  </Button>
                  <Button
                    className="ghost"
                    aria-label={t('advertisements.edit')}
                    onClick={() => setEditing(ad)}
                  >
                    <Pencil size={17} />
                  </Button>
                  <Button
                    className="ghost danger"
                    aria-label={t('advertisements.delete')}
                    onClick={() => setRemoving(ad)}
                  >
                    <Trash2 size={17} />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {creating && (
        <AdvertisementForm initial={null} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <AdvertisementForm initial={editing} onClose={() => setEditing(null)} />
      )}
      {removing && (
        <Confirm
          title="advertisements.confirmDelete"
          busy={remove.isPending}
          onCancel={() => setRemoving(null)}
          onConfirm={() => remove.mutate(removing._id)}
        >
          <p>{removing.title}</p>
        </Confirm>
      )}
    </>
  );
}
