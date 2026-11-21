import mongoose, { Schema } from 'mongoose';
import { branches } from '@myt/shared';
const options = {
  timestamps: true,
  versionKey: false,
  autoIndex: false,
  autoCreate: false,
} as const;
export const UserSession = mongoose.model(
  'UserSession',
  new Schema(
    {
      _id: String,
      userId: { type: String, required: true },
      accessHash: { type: String, required: true, select: false },
      refreshHash: { type: String, required: true, select: false },
      previousRefreshHash: { type: String, select: false },
      accessExpiresAt: { type: Date, required: true },
      expiresAt: { type: Date, required: true },
      revokedAt: Date,
      ip: String,
      device: String,
      lastSeenAt: Date,
    },
    options,
  ),
  'userSessions',
);
UserSession.schema.index({ accessHash: 1 }, { unique: true });
UserSession.schema.index({ refreshHash: 1 }, { unique: true });
UserSession.schema.index({ userId: 1, revokedAt: 1 });
UserSession.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const CaptchaChallenge = mongoose.model(
  'CaptchaChallenge',
  new Schema(
    {
      _id: String,
      answerHash: { type: String, required: true, select: false },
      expiresAt: { type: Date, required: true },
    },
    options,
  ),
  'captchaChallenges',
);
CaptchaChallenge.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const LoginAttempt = mongoose.model(
  'LoginAttempt',
  new Schema(
    {
      _id: String,
      failures: Number,
      windowStart: Date,
      lockedUntil: Date,
      expiresAt: Date,
    },
    options,
  ),
  'loginAttempts',
);
LoginAttempt.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const SecurityAuditLog = mongoose.model(
  'SecurityAuditLog',
  new Schema(
    {
      userId: String,
      action: String,
      targetId: String,
      branchId: String,
      ip: String,
      device: String,
    },
    options,
  ),
  'securityAuditLogs',
);
SecurityAuditLog.schema.index({ createdAt: -1 });
export const RefreshToken = mongoose.model(
  'RefreshToken',
  new Schema({ _id: String, sessionId: String, expiresAt: Date }, options),
  'refreshTokens',
);
RefreshToken.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const BranchMessage = mongoose.model(
  'BranchMessage',
  new Schema(
    {
      _id: String,
      branchId: {
        type: String,
        required: true,
        enum: branches
          .filter((branch) => branch.active)
          .map((branch) => branch.id),
      },
      title: { type: String, maxlength: 160 },
      body: { type: String, maxlength: 2000 },
      authorId: String,
      readBy: [String],
    },
    options,
  ),
  'branchMessages',
);
BranchMessage.schema.index({ branchId: 1, createdAt: -1 });
export const authModels = [
  BranchMessage,
  UserSession,
  RefreshToken,
  CaptchaChallenge,
  LoginAttempt,
  SecurityAuditLog,
];
