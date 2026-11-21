import mongoose, { Schema } from 'mongoose';

// Admin advertisements are company-wide; manager advertisements are owned by
// their assigned branch and all active banners can appear on the public page.
export interface AdvertisementRecord {
  _id: string;
  branchId: string | null;
  title: string;
  body: string;
  linkUrl: string;
  linkLabel: string;
  photoId: string | null;
  active: boolean;
  order: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const advertisementSchema = new Schema<AdvertisementRecord>(
  {
    _id: { type: String, required: true },
    branchId: { type: String, default: null },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, default: '', maxlength: 2000 },
    linkUrl: { type: String, default: '', maxlength: 500 },
    linkLabel: { type: String, default: '', maxlength: 60 },
    photoId: { type: String, default: null },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0, min: 0, max: 100000 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: true,
    strict: 'throw',
    versionKey: false,
    autoCreate: false,
    autoIndex: false,
  },
);
// Public listings sort by order; manager listings are isolated by branch.
advertisementSchema.index({ active: 1, order: 1, createdAt: -1 });
advertisementSchema.index({ branchId: 1, order: 1, createdAt: -1 });
export const Advertisement = mongoose.model<AdvertisementRecord>(
  'Advertisement',
  advertisementSchema,
  'advertisements',
);

// Immutable, optimized blobs for advertisement banners. Kept separate from
// ClothingPhoto so authenticated photo access stays untouched; the public
// image route only serves images referenced by an advertisement.
export interface AdvertisementImageRecord {
  _id: string;
  branchId: string | null;
  data: Buffer;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const advertisementImageSchema = new Schema<AdvertisementImageRecord>(
  {
    _id: { type: String, required: true },
    branchId: { type: String, default: null },
    data: { type: Buffer, required: true },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: true,
    strict: 'throw',
    versionKey: false,
    autoCreate: false,
    autoIndex: false,
  },
);
export const AdvertisementImage = mongoose.model<AdvertisementImageRecord>(
  'AdvertisementImage',
  advertisementImageSchema,
  'advertisementImages',
);
