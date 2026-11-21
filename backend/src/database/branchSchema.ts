import { Schema } from 'mongoose';
// Template only: no model or business collection is registered in Phase 1.
export function createBranchSchema() {
  const schema = new Schema(
    {
      branchId: {
        type: String,
        required: true,
        immutable: true,
        enum: ['sham-royal', 'sham-aroos', 'sham-aroos-vip'],
      },
    },
    { timestamps: true, strict: 'throw' },
  );
  schema.index({ branchId: 1, _id: 1 });
  schema.index({ branchId: 1, createdAt: -1 });
  return schema;
}
