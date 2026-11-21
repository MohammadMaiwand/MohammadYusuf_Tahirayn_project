import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { advertisementInput, isActiveBranch } from '@myt/shared';
import type { Actor } from '../../security/identity.js';
import { HttpError } from '../../utils/errors.js';
import { Advertisement, AdvertisementImage } from './model.js';

type AdvertisementData = z.output<typeof advertisementInput>;

export interface AdvertisementView {
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
}

const serialize = (record: {
  _id: string;
  branchId?: string | null;
  title: string;
  body: string;
  linkUrl: string;
  linkLabel: string;
  photoId: string | null;
  active: boolean;
  order: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AdvertisementView => ({
  _id: record._id,
  branchId: record.branchId || null,
  title: record.title,
  body: record.body,
  linkUrl: record.linkUrl,
  linkLabel: record.linkLabel,
  photoId: record.photoId,
  active: record.active,
  order: record.order,
  startsAt: record.startsAt ? record.startsAt.toISOString() : null,
  endsAt: record.endsAt ? record.endsAt.toISOString() : null,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

function managerBranch(actor: Actor) {
  if (
    actor.role !== 'manager' ||
    actor.branchIds.length !== 1 ||
    !actor.branchIds[0] ||
    !isActiveBranch(actor.branchIds[0])
  )
    throw new HttpError(403, 'forbidden');
  return actor.branchIds[0];
}

function scopedFilter(actor: Actor, id?: string) {
  if (actor.role === 'admin') return id ? { _id: id } : {};
  return {
    branchId: managerBranch(actor),
    ...(id ? { _id: id } : {}),
  };
}

async function assertPhoto(photoId: string | null, actor: Actor) {
  if (!photoId) return;
  const image = await AdvertisementImage.findById(photoId)
    .select('branchId')
    .lean();
  if (!image) throw new HttpError(422, 'invalid_advertisement_photo');
  if (
    actor.role === 'manager' &&
    image.branchId &&
    image.branchId !== managerBranch(actor)
  )
    throw new HttpError(422, 'invalid_advertisement_photo');
}

export async function listAdvertisements(actor: Actor) {
  const rows = await Advertisement.find(scopedFilter(actor))
    .sort({ order: 1, createdAt: -1 })
    .limit(200)
    .lean();
  return rows.map((row) => serialize(row));
}

export async function publicAdvertisements() {
  const now = new Date();
  const rows = await Advertisement.find({
    active: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  })
    .sort({ order: 1, createdAt: -1 })
    .limit(20)
    .lean();
  return rows.map((row) => serialize(row));
}

// Only activates when the schedule window is open; an empty window means always.
function window(input: AdvertisementData) {
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (startsAt && endsAt && endsAt < startsAt)
    throw new HttpError(422, 'invalid_advertisement_dates');
  return { startsAt, endsAt };
}

export async function createAdvertisement(
  actor: Actor,
  input: AdvertisementData,
) {
  await assertPhoto(input.photoId, actor);
  const record = await Advertisement.create({
    _id: randomUUID(),
    branchId: actor.role === 'admin' ? null : managerBranch(actor),
    title: input.title,
    body: input.body,
    linkUrl: input.linkUrl,
    linkLabel: input.linkLabel,
    photoId: input.photoId,
    active: input.active,
    order: input.order,
    ...window(input),
    createdBy: actor.subject,
  });
  return serialize(record.toObject());
}

export async function updateAdvertisement(
  id: string,
  actor: Actor,
  input: AdvertisementData,
) {
  await assertPhoto(input.photoId, actor);
  const record = await Advertisement.findOneAndUpdate(
    scopedFilter(actor, id),
    {
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      linkLabel: input.linkLabel,
      photoId: input.photoId,
      active: input.active,
      order: input.order,
      ...window(input),
    },
    { new: true },
  ).lean();
  if (!record) throw new HttpError(404, 'not_found');
  return serialize(record);
}

export async function deleteAdvertisement(id: string, actor: Actor) {
  const record = await Advertisement.findOneAndDelete(
    scopedFilter(actor, id),
  ).lean();
  if (!record) throw new HttpError(404, 'not_found');
  if (
    record.photoId &&
    !(await Advertisement.exists({ photoId: record.photoId }))
  )
    await AdvertisementImage.deleteOne({ _id: record.photoId });
  return serialize(record);
}

export async function uploadAdvertisementImage(actor: Actor, encoded: string) {
  const input = Buffer.from(encoded, 'base64');
  if (input.length > 5 * 1024 * 1024)
    throw new HttpError(413, 'photo_too_large');
  let output: Buffer;
  try {
    const image = sharp(input, {
      limitInputPixels: 25000000,
      animated: false,
      failOn: 'warning',
    });
    const metadata = await image.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format || '') ||
      (metadata.pages || 1) > 1
    )
      throw new Error('Unsupported image');
    output = await image
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new HttpError(422, 'invalid_photo');
  }
  const id = randomUUID();
  await AdvertisementImage.create({
    _id: id,
    branchId: actor.role === 'admin' ? null : managerBranch(actor),
    data: output,
    createdBy: actor.subject,
  });
  return id;
}

export async function advertisementImage(id: string) {
  // Advertise an image only while it is still referenced by a record, so
  // deleted banners are not served from a guessable identifier.
  if (!(await Advertisement.exists({ photoId: id })))
    throw new HttpError(404, 'not_found');
  const image = await AdvertisementImage.findById(id);
  if (!image) throw new HttpError(404, 'not_found');
  return image.data;
}
