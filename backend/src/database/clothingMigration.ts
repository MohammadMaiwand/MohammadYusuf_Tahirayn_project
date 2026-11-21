import { catalogModels, Transaction } from './models.js';
import { ClothingPhoto } from '../modules/catalog/photos.js';

export async function migrateClothing() {
  // Existing records without a manual ID are excluded, preserving every legacy item.
  await catalogModels.products.collection.createIndex(
    { branchId: 1, clothingId: 1 },
    {
      name: 'branch_clothing_id_unique',
      unique: true,
      partialFilterExpression: { clothingId: { $type: 'string' } },
    },
  );
  await ClothingPhoto.createCollection();
  await ClothingPhoto.collection.createIndex({ branchId: 1, createdAt: -1 });
  await Transaction.collection.createIndex({
    branchId: 1,
    'product.id': 1,
    status: 1,
    reservationAt: 1,
  });
}
