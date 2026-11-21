import type { ClientSession } from 'mongoose';
import {
  branchCurrency,
  catalogInput,
  customerInput,
  moneyToMinor,
  type Command,
} from '@myt/shared';
import { catalogModels, Customer } from '../../database/models.js';
import { requirePermission, type Context } from '../../security/identity.js';
import { audit, base, checkVersion, found } from '../../services/context.js';
import { HttpError } from '../../utils/errors.js';
import { ClothingPhoto } from './photos.js';
export async function catalogWrite(
  ctx: Context,
  command: Command,
  session: ClientSession,
) {
  if (!command.resource) throw new HttpError(400, 'invalid_resource');
  requirePermission(
    ctx.actor,
    `${command.resource}.${command.action === 'catalog.create' ? 'create' : 'update'}`,
  );
  const model = catalogModels[command.resource];
  const data = catalogInput.parse(command.data);
  if (command.resource === 'products') {
    if (command.action === 'catalog.create' && !data.clothingId)
      throw new HttpError(422, 'clothing_id_required');
    if (data.clothingId !== undefined) {
      if (!data.clothingId) throw new HttpError(422, 'clothing_id_required');
      data.clothingId = data.clothingId.normalize('NFKC').toUpperCase();
    }
    if (
      data.photoId &&
      !(await ClothingPhoto.exists({
        _id: data.photoId,
        branchId: ctx.branchId,
      }).session(session))
    )
      throw new HttpError(404, 'not_found');
  }
  if (data.categoryId)
    found(
      await catalogModels['product-categories']
        .findOne({
          _id: data.categoryId,
          branchId: ctx.branchId,
          status: 'active',
        })
        .session(session),
    );
  const { id, price, ...fields } = data;
  const normalizedName = data.name.normalize('NFKC').toLocaleLowerCase();
  const payload = {
    ...fields,
    currency: data.currency || branchCurrency(ctx.branchId),
    normalizedName,
    priceMinor: moneyToMinor(price),
  };
  if (command.action === 'catalog.create') {
    const [record] = await model.create(
      [{ ...base(ctx, 'CAT', id), ...payload }],
      { session },
    );
    await audit(
      ctx,
      session,
      command.deviceId,
      command.action,
      command.resource,
      record!._id,
      null,
      { version: 1, status: data.status },
    );
    return record!.toObject();
  }
  const record = found(
    await model
      .findOne({ _id: command.targetId, branchId: ctx.branchId })
      .session(session),
  );
  checkVersion(record, command.expectedVersion);
  const before = { version: record.version, status: record.status };
  if (!data.currency)
    payload.currency = record.currency || branchCurrency(ctx.branchId);
  record.set(payload);
  record.version++;
  await record.save({ session });
  await audit(
    ctx,
    session,
    command.deviceId,
    command.action,
    command.resource,
    record._id,
    before,
    { version: record.version, status: record.status },
  );
  return record.toObject();
}
export async function customerWrite(
  ctx: Context,
  command: Command,
  session: ClientSession,
) {
  requirePermission(ctx.actor, 'customers.write');
  const { id, ...data } = customerInput.parse(command.data);
  const payload = {
    ...data,
    normalizedName: data.fullName.normalize('NFKC').toLocaleLowerCase(),
  };
  if (command.action === 'customer.create') {
    const [record] = await Customer.create(
      [{ ...base(ctx, 'CUS', id), ...payload }],
      { session },
    );
    await audit(
      ctx,
      session,
      command.deviceId,
      command.action,
      'customers',
      record!._id,
      null,
      { version: 1 },
    );
    return record!.toObject();
  }
  const record = found(
    await Customer.findOne({
      _id: command.targetId,
      branchId: ctx.branchId,
    }).session(session),
  );
  checkVersion(record, command.expectedVersion);
  record.set(payload);
  record.version++;
  await record.save({ session });
  await audit(
    ctx,
    session,
    command.deviceId,
    command.action,
    'customers',
    record._id,
    { version: record.version - 1 },
    { version: record.version },
  );
  return record.toObject();
}
