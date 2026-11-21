import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { branches, calendarDay } from '@myt/shared';
import { Alteration } from './model.js';
import { Notification, AuditLog } from '../../database/models.js';
export async function reconcileAlterations(now = new Date()) {
  const today = calendarDay(now);
  for (const branch of branches.filter((branch) => branch.active)) {
    const ids = await Alteration.find({
      branchId: branch.id,
      status: { $nin: ['delivered', 'cancelled'] },
      expectedAt: { $lt: new Date((today + 2) * 86400000 - 16200000) },
    })
      .select('_id')
      .cursor();
    for await (const candidate of ids)
      await mongoose.connection.transaction(async (session) => {
        const record = await Alteration.findOne({
          _id: candidate._id,
          branchId: branch.id,
        }).session(session);
        if (!record || ['delivered', 'cancelled'].includes(record.status))
          return;
        const days = calendarDay(record.expectedAt) - today;
        if (days < 0 && record.status !== 'overdue') {
          const before = record.status;
          record.overdueFrom = record.status;
          record.status = 'overdue';
          record.version++;
          await record.save({ session });
          await AuditLog.create(
            [
              {
                _id: randomUUID(),
                branchId: branch.id,
                code: `AUD-${randomUUID()}`,
                version: 1,
                createdBy: 'system:alteration-scheduler',
                actorId: 'system:alteration-scheduler',
                deviceId: 'server',
                action: 'alteration.overdue',
                resource: 'alterations',
                recordId: record._id,
                before: { status: before },
                after: { status: 'overdue' },
              },
            ],
            { session },
          );
        }
        const key = {
          branchId: branch.id,
          eventId: `alteration:${record._id}:tomorrow:${calendarDay(record.expectedAt)}`,
        };
        if (
          days === 1 &&
          !['ready', 'delivered', 'cancelled'].includes(record.status) &&
          !(await Notification.exists(key).session(session))
        ) {
          // Serialize with rescheduling/status writes; a concurrent edit retries with its fresh state.
          record.version++;
          await record.save({ session });
          await Notification.updateOne(
            key,
            {
              $setOnInsert: {
                ...key,
                _id: randomUUID(),
                code: `NOT-${randomUUID()}`,
                version: 1,
                createdBy: 'system:alteration-scheduler',
                alterationId: record._id,
                garmentId: record.garmentId,
                transactionId: record.transactionId || '',
                customerId: record.customerId,
                customerName: record.customerName,
                productName: record.garmentName,
                transactionType: 'alteration',
                reservationAt: record.expectedAt,
                type: 'alteration',
                ownerId: record.createdBy,
                managementOnly: true,
                deliveryStatus: 'available',
                readBy: [],
                resolved: false,
              },
            },
            { upsert: true, session },
          );
        }
      });
    const reminders = Notification.find({
      branchId: branch.id,
      type: 'alteration',
      resolved: false,
    }).cursor();
    for await (const reminder of reminders) {
      const current = await Alteration.exists({
        _id: reminder.alterationId,
        branchId: branch.id,
        expectedAt: reminder.reservationAt,
        status: { $nin: ['ready', 'delivered', 'cancelled'] },
      });
      if (!current || calendarDay(reminder.reservationAt) - today !== 1)
        await Notification.updateOne(
          { _id: reminder._id, branchId: branch.id, resolved: false },
          {
            $set: { resolved: true, deliveryStatus: 'resolved' },
            $inc: { version: 1 },
          },
        );
    }
  }
}
