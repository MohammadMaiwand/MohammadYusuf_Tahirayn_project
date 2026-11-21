import { Router } from 'express';
import { z } from 'zod';
import { advertisementInput, uuid } from '@myt/shared';
import { requirePermission, type Actor } from '../../security/identity.js';
import { HttpError } from '../../utils/errors.js';
import { event } from '../auth/core.js';
import {
  advertisementImage,
  createAdvertisement,
  deleteAdvertisement,
  listAdvertisements,
  publicAdvertisements,
  updateAdvertisement,
  uploadAdvertisementImage,
} from './service.js';

function advertisementManager(actor: Actor) {
  requirePermission(actor, 'advertisements.manage');
  if (actor.role !== 'admin' && actor.role !== 'manager')
    throw new HttpError(403, 'forbidden');
}

// Admins manage company-wide ads; managers manage ads for their own branch.
export function advertisementRoutes(router: Router) {
  router.get('/advertisements', async (_req, res) => {
    const actor = res.locals.actor as Actor;
    advertisementManager(actor);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: await listAdvertisements(actor) });
  });
  router.post('/advertisements', async (req, res) => {
    const actor = res.locals.actor as Actor;
    advertisementManager(actor);
    const data = advertisementInput.parse(req.body);
    const record = await createAdvertisement(actor, data);
    await event(req, 'advertisement.create', actor.subject, record._id);
    res.status(201).json({ data: record });
  });
  router.patch('/advertisements/:id', async (req, res) => {
    const actor = res.locals.actor as Actor;
    advertisementManager(actor);
    const data = advertisementInput.parse(req.body);
    const record = await updateAdvertisement(
      uuid.parse(req.params.id),
      actor,
      data,
    );
    await event(req, 'advertisement.update', actor.subject, record._id);
    res.json({ data: record });
  });
  router.delete('/advertisements/:id', async (req, res) => {
    const actor = res.locals.actor as Actor;
    advertisementManager(actor);
    const record = await deleteAdvertisement(uuid.parse(req.params.id), actor);
    await event(req, 'advertisement.delete', actor.subject, record._id);
    res.json({ data: { _id: record._id } });
  });
  router.post('/advertisements/photos', async (req, res) => {
    const actor = res.locals.actor as Actor;
    advertisementManager(actor);
    const { data } = z
      .object({
        data: z
          .string()
          .max(6990508)
          .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      })
      .strict()
      .parse(req.body);
    const photoId = await uploadAdvertisementImage(actor, data);
    await event(req, 'advertisement.photo.upload', actor.subject, photoId);
    res.status(201).json({ data: { photoId } });
  });
}

// Public, pre-authentication endpoints that feed the landing page.
export function publicAdvertisementRoutes() {
  const router = Router();
  router.get('/advertisements', async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ data: await publicAdvertisements() });
  });
  router.get('/advertisements/:id/image', async (req, res) => {
    const data = await advertisementImage(uuid.parse(req.params.id));
    res
      .set({
        'Cache-Control': 'public, max-age=86400, immutable',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Content-Type': 'image/webp',
        'Content-Disposition': `inline; filename="${req.params.id}.webp"`,
      })
      .send(data);
  });
  return router;
}
