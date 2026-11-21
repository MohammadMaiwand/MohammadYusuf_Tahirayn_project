import { reconcileAlterations } from '../modules/alterations/scheduler.js';
import { branches } from '@myt/shared';
import { randomUUID } from 'node:crypto';
import { Transaction, Notification } from '../database/models.js';
export function kabulDay(date: Date) {
  return Math.floor((date.getTime() + 270 * 60000) / 86400000);
}
export async function reconcileNotifications(now = new Date()) {
  const tomorrowEnd = new Date((kabulDay(now) + 2) * 86400000 - 270 * 60000);
  for (const branch of branches.filter((item) => item.active)) {
    const cursor = Transaction.find({
      branchId: branch.id,
      status: { $in: ['pending', 'ready'] },
      reservationAt: { $lt: tomorrowEnd },
    }).cursor();
    for await (const transaction of cursor) {
      const days = kabulDay(transaction.reservationAt) - kabulDay(now);
      if (days !== 1 && days >= 0) continue;
      const type = days === 1 ? 'tomorrow' : 'overdue';
      const key = {
        branchId: transaction.branchId,
        transactionId: transaction._id,
        type,
        reservationAt: transaction.reservationAt,
      };
      await Notification.updateOne(
        key,
        {
          $setOnInsert: {
            ...key,
            _id: randomUUID(),
            code: `NOT-${randomUUID()}`,
            version: 1,
            createdBy: 'system:notification',
            customerId: transaction.customerId,
            customerName: transaction.customerName,
            productName: transaction.product.name,
            transactionType: transaction.type,
            ownerId: transaction.createdBy,
            readBy: [],
            resolved: false,
          },
        },
        { upsert: true },
      );
    }
    const pending = Notification.find({
      branchId: branch.id,
      resolved: false,
      type: { $in: ['tomorrow', 'overdue'] },
    }).cursor();
    for await (const notification of pending) {
      const current = await Transaction.exists({
        _id: notification.transactionId,
        branchId: notification.branchId,
        status: { $in: ['pending', 'ready'] },
        reservationAt: notification.reservationAt,
      });
      if (
        !current ||
        (notification.type === 'tomorrow' &&
          kabulDay(notification.reservationAt) <= kabulDay(now))
      )
        await Notification.updateOne(
          {
            _id: notification._id,
            branchId: notification.branchId,
            resolved: false,
          },
          { $set: { resolved: true }, $inc: { version: 1 } },
        );
    }
  }
}
export function startNotificationJob(onError: () => void) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const results = await Promise.allSettled([
        reconcileNotifications(),
        reconcileAlterations(),
      ]);
      if (results.some((result) => result.status === 'rejected')) onError();
    } catch {
      onError();
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => {
    void run();
  }, 60000);
  timer.unref();
  return () => clearInterval(timer);
}
