import { has, type Actor } from './identity.js';
export function notificationAudience(actor: Actor) {
  return {
    $or: [
      {
        managementOnly: { $ne: true },
        ...(!has(actor, 'transactions.read.all')
          ? { ownerId: actor.subject }
          : {}),
      },
      ...(['admin', 'manager'].includes(actor.role) &&
      has(actor, 'alterations.read') &&
      has(actor, 'alterations.read.all')
        ? [{ managementOnly: true }]
        : []),
    ],
  };
}
