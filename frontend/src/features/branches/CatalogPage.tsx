import { CurrencySelect } from '../../components/forms/CurrencySelect';
import { branchCurrency } from '@myt/shared';
import { useRef, useState, useEffect } from 'react';
import type { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil } from 'lucide-react';
import { catalogInput, minorToMoney, type CatalogType } from '@myt/shared';
import { mutate } from '../../offline/operations';
import { allowed, request, branch, ApiError } from '../../services/api';
import { ClothingPhoto } from '../../components/common/ClothingPhoto';
import {
  Button,
  Field,
  Modal,
  Loading,
  ErrorState,
  Empty,
  Pagination,
  Status,
  useData,
  useDebounced,
  useSave,
  useFormat,
  Confirm,
} from '../../components/common/ui';
import type { Catalog, Page } from '../../types/business';
import { ListPrintButton } from '../../components/printing/ListPrintButton';

function payload(item: Catalog) {
  return {
    ...(item.clothingId ? { clothingId: item.clothingId } : {}),
    photoId: item.photoId || null,
    name: item.name,
    productType: item.productType,
    brand: item.brand,
    color: item.color,
    currency: item.currency || branchCurrency(branch()),
    price: minorToMoney(item.priceMinor),
    quantity: item.quantity,
    description: item.description,
    status: item.status,
    categoryId: item.categoryId,
    guaranteeType: item.guaranteeType as 'manual',
  };
}
export function catalogLabel(item: Catalog, t: (key: string) => string) {
  return item.code.startsWith('GUA-') && item.name === item.guaranteeType
    ? t(`guarantee.${item.guaranteeType}`)
    : item.name;
}
function CatalogForm({
  resource,
  item,
  onClose,
}: {
  resource: CatalogType;
  item: Catalog | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [photo, setPhoto] = useState<File>();
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!photo) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const categories = useData<Page<Catalog>>(
    '/product-categories?limit=100&status=active',
    resource === 'products',
  );
  const form = useForm<
    z.input<typeof catalogInput>,
    unknown,
    z.output<typeof catalogInput>
  >({
    resolver: zodResolver(catalogInput),
    defaultValues: item
      ? payload(item)
      : {
          name: '',
          productType: '',
          brand: '',
          color: '',
          currency: branchCurrency(branch()),
          price: '0',
          quantity: 1,
          description: '',
          status: 'active' as const,
          categoryId: null,
          guaranteeType: 'manual' as const,
        },
  });
  const save = useSave(
    async (input: Parameters<typeof catalogInput.parse>[0]) => {
      const data = catalogInput.parse(input);
      if (photo) {
        if (!navigator.onLine) throw new ApiError(422, 'online_required');
        if (photo.size > 5 * 1024 * 1024)
          throw new ApiError(413, 'photo_too_large');
        const encoded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]!);
          reader.onerror = reject;
          reader.readAsDataURL(photo);
        });
        data.photoId = (
          await request<{ photoId: string }>(
            `/branches/${branch()}/clothing-photos`,
            { method: 'POST', body: JSON.stringify({ data: encoded }) },
          )
        ).photoId;
        form.setValue('photoId', data.photoId);
        setPhoto(undefined);
      }
      return mutate(
        ('catalog.' + (item ? 'update' : 'create')) as
          'catalog.create' | 'catalog.update',
        data,
        {
          resource,
          ...(item
            ? { targetId: item._id, expectedVersion: item.version }
            : {}),
        },
      );
    },
    () => onClose(),
  );
  return (
    <Modal
      size="large"
      title={item ? 'common.edit' : 'common.add'}
      onClose={onClose}
    >
      <form
        onSubmit={form.handleSubmit((data) => save.mutate(data))}
        className="form-grid"
      >
        <CurrencySelect {...form.register('currency')} />
        {resource === 'products' && (
          <>
            <Field label="clothing.id" error={form.formState.errors.clothingId}>
              <input
                {...form.register('clothingId', {
                  setValueAs: (value: string) => value || undefined,
                })}
                required={!item || !!item.clothingId}
                maxLength={64}
                dir="ltr"
                placeholder="SR-001"
              />
            </Field>
            <Field label="clothing.photo">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setPhoto(e.target.files?.[0])}
              />
              {preview ? (
                <img
                  src={preview}
                  className="clothing-photo large"
                  alt={t('clothing.photo')}
                />
              ) : (
                <ClothingPhoto photoId={form.watch('photoId')} large />
              )}
              <Button
                type="button"
                className="ghost"
                onClick={() => {
                  setPhoto(undefined);
                  form.setValue('photoId', null);
                }}
              >
                {t('clothing.remove')}
              </Button>
            </Field>
          </>
        )}
        <Field label="field.name" error={form.formState.errors.name}>
          <input
            {...form.register('name')}
            maxLength={160}
            autoComplete="off"
          />
        </Field>
        {resource === 'guarantees' ? (
          <Field label="field.guaranteeType">
            <select {...form.register('guaranteeType')}>
              {[
                'tazkira',
                'ring',
                'necklace',
                'cash',
                'telephone',
                'manual',
              ].map((type) => (
                <option key={type} value={type}>
                  {t(`guarantee.${type}`)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            {resource === 'products' && (
              <>
                <Field label="field.productType">
                  <input {...form.register('productType')} />
                </Field>
                <Field label="field.brand">
                  <input {...form.register('brand')} />
                </Field>
                <Field label="field.categoryId">
                  <select
                    value={form.watch('categoryId') || ''}
                    onChange={(e) =>
                      form.setValue('categoryId', e.target.value || null)
                    }
                  >
                    <option value="">{t('common.select')}</option>
                    {categories.data?.items.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {resource !== 'product-categories' && (
              <>
                <Field label="field.color">
                  <input {...form.register('color')} />
                </Field>
                <Field
                  currency={form.watch('currency')}
                  label="field.price"
                  error={form.formState.errors.price}
                >
                  <input
                    inputMode="decimal"
                    dir="ltr"
                    {...form.register('price')}
                  />
                </Field>
              </>
            )}
            {resource === 'package-items' && (
              <Field label="field.quantity">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  {...form.register('quantity', { valueAsNumber: true })}
                />
              </Field>
            )}
          </>
        )}
        <Field label="field.status">
          <select {...form.register('status')}>
            <option value="active">{t('common.active')}</option>
            <option value="inactive">{t('common.inactive')}</option>
          </select>
        </Field>
        <Field label="field.description">
          <textarea {...form.register('description')} rows={3} />
        </Field>
        {save.error && <ErrorState error={save.error} />}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {t(save.isPending ? 'common.loading' : 'common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export default function CatalogPage({ resource }: { resource: CatalogType }) {
  const printTarget = useRef<HTMLElement>(null);
  const { t } = useTranslation();
  const fmt = useFormat();
  const [q, setQ] = useState('');
  const search = useDebounced(q);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [productType, setProductType] = useState('');
  const [editor, setEditor] = useState<Catalog | null | undefined>();
  const [deactivate, setDeactivate] = useState<Catalog>();
  const params = new URLSearchParams({
    q: search,
    page: String(page),
    sort,
    ...(status ? { status } : {}),
    ...(brand ? { brand } : {}),
    ...(color ? { color } : {}),
    ...(productType ? { productType } : {}),
  });
  const query = useData<Page<Catalog>>(`/${resource}?${params}`);
  const remove = useSave(
    (item: Catalog) =>
      mutate(
        'catalog.update',
        { ...payload(item), status: 'inactive' },
        { resource, targetId: item._id, expectedVersion: item.version },
      ),
    () => setDeactivate(undefined),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('common.branch')}</p>
          <h1>{t(`nav.${resource}`)}</h1>
        </div>
        <div className="row-actions">
          <ListPrintButton
            target={printTarget}
            title={`nav.${resource}`}
            ready={
              !!query.data?.items.length && !query.isFetching && !query.error
            }
            page={page}
            total={query.data?.total ?? 0}
          />
          {allowed(`${resource}.create`) && (
            <Button onClick={() => setEditor(null)}>
              <Plus size={17} />
              {t('common.add')}
            </Button>
          )}
        </div>
      </div>
      <div className="toolbar">
        <input
          aria-label={t('common.search')}
          placeholder={t('common.search')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label={t('field.status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('common.all')}</option>
          <option value="active">{t('common.active')}</option>
          <option value="inactive">{t('common.inactive')}</option>
        </select>
        <select
          aria-label={t('common.sort')}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="createdAt">{t('field.createdAt')}</option>
          <option value="name">{t('field.name')}</option>
          <option value="updatedAt">{t('field.updatedAt')}</option>
        </select>
        {resource === 'products' && (
          <>
            <input
              aria-label={t('field.productType')}
              placeholder={t('field.productType')}
              value={productType}
              onChange={(e) => {
                setProductType(e.target.value);
                setPage(1);
              }}
            />
            <input
              aria-label={t('field.brand')}
              placeholder={t('field.brand')}
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setPage(1);
              }}
            />
            <input
              aria-label={t('field.color')}
              placeholder={t('field.color')}
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setPage(1);
              }}
            />
          </>
        )}
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data?.items.length ? (
        <Empty />
      ) : (
        <section className="panel" ref={printTarget}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    'code',
                    'name',
                    ...(resource === 'products'
                      ? ['productType', 'brand']
                      : []),
                    ...(resource !== 'guarantees' &&
                    resource !== 'product-categories'
                      ? ['color', 'price']
                      : []),
                    ...(resource === 'package-items' ? ['quantity'] : []),
                    'status',
                    'createdAt',
                    'updatedAt',
                  ].map((field) => (
                    <th key={field}>{t(`field.${field}`)}</th>
                  ))}
                  <th className="print-exclude">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item._id}>
                    <td className="code">
                      {resource === 'products'
                        ? item.clothingId || item.code
                        : item.code}
                    </td>
                    <td>
                      {resource === 'products' && (
                        <details>
                          <summary aria-label={t('clothing.photo')}>
                            <ClothingPhoto photoId={item.photoId} />
                          </summary>
                          <ClothingPhoto photoId={item.photoId} large />
                        </details>
                      )}
                      <strong>{catalogLabel(item, t)}</strong>
                      {item.description && <small>{item.description}</small>}
                    </td>
                    {resource === 'products' && (
                      <>
                        <td>{item.productType}</td>
                        <td>{item.brand}</td>
                      </>
                    )}
                    {resource !== 'guarantees' &&
                      resource !== 'product-categories' && (
                        <>
                          <td>{item.color}</td>
                          <td dir="ltr">
                            {fmt.money(item.priceMinor, item.currency)}
                          </td>
                        </>
                      )}
                    {resource === 'package-items' && <td>{item.quantity}</td>}
                    <td>
                      <Status value={item.status} />
                    </td>
                    <td>{fmt.date(item.createdAt)}</td>
                    <td>{fmt.date(item.updatedAt)}</td>
                    <td className="print-exclude">
                      {allowed(`${resource}.update`) && (
                        <div className="row-actions">
                          <Button
                            className="ghost"
                            aria-label={t('common.edit')}
                            onClick={() => setEditor(item)}
                          >
                            <Pencil size={16} />
                          </Button>
                          {item.status === 'active' && (
                            <Button
                              className="ghost danger"
                              onClick={() => setDeactivate(item)}
                            >
                              {t('action.deactivate')}
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination data={query.data} onPage={setPage} />
        </section>
      )}
      {editor !== undefined && (
        <CatalogForm
          key={editor?._id || 'new'}
          resource={resource}
          item={editor}
          onClose={() => setEditor(undefined)}
        />
      )}
      {deactivate && (
        <Confirm
          busy={remove.isPending}
          onCancel={() => setDeactivate(undefined)}
          onConfirm={() => remove.mutate(deactivate)}
        />
      )}
    </>
  );
}
