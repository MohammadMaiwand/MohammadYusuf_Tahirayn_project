import type { FilterQuery } from 'mongoose';
import { calendarDay } from '@myt/shared';
import type { TransactionRecord } from '../../database/models.js';

const dayMs = 86400000;
const kabulOffset = 16200000;

export function occupancyFilter(
  branchId: string,
  productId: string,
  start: Date,
  end: Date | null,
  purchase = false,
): FilterQuery<TransactionRecord> {
  const dayStart = new Date(calendarDay(start) * dayMs - kabulOffset);
  const nextDay = new Date(dayStart.getTime() + dayMs);
  // An omitted return reserves the selected Kabul day, not every future day.
  // Same-day returns must also occupy a non-empty interval.
  const rentalEnd = end && end > nextDay ? end : nextDay;
  const existingNextDay = {
    $add: [
      {
        $multiply: [
          {
            $add: [
              {
                $floor: {
                  $divide: [
                    { $add: [{ $toLong: '$reservationAt' }, kabulOffset] },
                    dayMs,
                  ],
                },
              },
              1,
            ],
          },
          dayMs,
        ],
      },
      -kabulOffset,
    ],
  };
  return {
    branchId,
    'product.id': productId,
    status: { $nin: ['returned', 'cancelled'] },
    $or: [
      // An unreturned physical delivery cannot be promised again after its due day.
      {
        status: 'delivered',
        type: 'rental',
        $or: [{ returnDueAt: null }, { returnDueAt: { $lte: new Date() } }],
      },
      { type: 'purchase' },
      {
        type: 'rental',
        ...(purchase ? {} : { reservationAt: { $lt: rentalEnd } }),
        $expr: {
          $gt: [
            {
              $max: [
                { $ifNull: [{ $toLong: '$returnDueAt' }, existingNextDay] },
                existingNextDay,
              ],
            },
            start.getTime(),
          ],
        },
      },
    ],
  };
}
