import { Alteration } from '../alterations/model.js';
import mongoose, { Schema } from 'mongoose';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { uuid } from '@myt/shared';
import type { Router } from 'express';
import {
  has,
  requirePermission,
  type Context,
} from '../../security/identity.js';
import { HttpError } from '../../utils/errors.js';
import { event } from '../auth/core.js';

// Immutable, optimized blobs live in the same durable MongoDB backup boundary as invoices.
export const ClothingPhoto = mongoose.model(
  'ClothingPhoto',
  new Schema(
    {
      _id: { type: String, required: true },
      branchId: { type: String, required: true, immutable: true },
      data: { type: Buffer, required: true },
      purpose: {
        type: String,
        enum: ['catalog', 'alteration'],
        default: 'catalog',
      },
      createdBy: { type: String, required: true },
    },
    { timestamps: true, autoCreate: false, autoIndex: false },
  ),
  'clothingPhotos',
);

export function photoRoutes(router: Router) {
  router.post('/clothing-photos', async (req, res) => {
    const ctx = res.locals.context as Context;
    const alterationUpload = req.query.purpose === 'alteration';
    if (alterationUpload) {
      if (
        !has(ctx.actor, 'alterations.create') &&
        !has(ctx.actor, 'alterations.update')
      )
        throw new HttpError(403, 'forbidden');
      requirePermission(ctx.actor, 'alterations.read');
    }
    if (
      !alterationUpload &&
      !has(ctx.actor, 'products.create') &&
      !has(ctx.actor, 'products.update')
    )
      throw new HttpError(403, 'forbidden');
    const { data } = z
      .object({
        data: z
          .string()
          .max(6990508)
          .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      })
      .strict()
      .parse(req.body);
    const input = Buffer.from(data, 'base64');
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
        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
    } catch {
      throw new HttpError(422, 'invalid_photo');
    }
    const id = randomUUID();
    await ClothingPhoto.create({
      _id: id,
      branchId: ctx.branchId,
      data: output,
      purpose: alterationUpload ? 'alteration' : 'catalog',
      createdBy: ctx.actor.subject,
    });
    await event(
      req,
      'clothing.photo.upload',
      ctx.actor.subject,
      id,
      ctx.branchId,
    );
    res.status(201).json({ data: { photoId: id } });
  });
  router.get('/clothing-photos/:id', async (req, res) => {
    const ctx = res.locals.context as Context;
    const photo = await ClothingPhoto.findOne({
      _id: uuid.parse(req.params.id),
      branchId: ctx.branchId,
    });
    if (!photo) throw new HttpError(404, 'not_found');
    if (photo.purpose === 'alteration') {
      requirePermission(ctx.actor, 'alterations.read');
      const scope = {
        branchId: ctx.branchId,
        ...(!has(ctx.actor, 'alterations.read.all')
          ? { createdBy: ctx.actor.subject }
          : {}),
      };
      if (
        photo.createdBy !== ctx.actor.subject &&
        !(await Alteration.exists({ ...scope, photoId: photo._id }))
      )
        throw new HttpError(404, 'not_found');
    } else requirePermission(ctx.actor, 'catalog.read');
    res
      .set({
        'Cache-Control': 'private, no-store',
        'Content-Type': 'image/webp',
        'Content-Disposition': `inline; filename="${photo._id}.webp"`,
      })
      .send(photo.data);
  });
}
