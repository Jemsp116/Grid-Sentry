import crypto from 'node:crypto';
import { InvitationModel, type IInvitationDoc } from '../config/mongoSchemas.js';
import type { Role } from '../auth/permissions.js';
import type { Types } from 'mongoose';

/** How long invitation tokens are valid (72 hours). */
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export interface InvitationRow {
  id: string;
  orgId: string;
  email: string;
  role: Role;
  invitedBy: number;
  token?: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}

function docToRow(doc: IInvitationDoc): InvitationRow {
  return {
    id: (doc._id as Types.ObjectId).toString(),
    orgId: doc.orgId.toString(),
    email: doc.email,
    role: doc.role as Role,
    invitedBy: doc.invitedBy,
    token: doc.token,
    status: doc.status,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
  };
}

/**
 * Generate a cryptographically random invite token (48 bytes → 96-char hex).
 * The same raw value is returned to the caller (for the link) and stored in the
 * DB, so lookups are O(1) by token index.
 */
function generateInviteToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export interface CreateInvitationInput {
  orgId: string;
  email: string;
  role: Role;
  invitedBy: number;
}

/**
 * Create a new pending invitation.
 * Raises if a pending invite for the same (orgId + email) already exists —
 * callers should check and surface this as a 409.
 */
export async function createInvitation(input: CreateInvitationInput): Promise<{ invitation: InvitationRow; token: string }> {
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const doc = await InvitationModel.create({
    orgId: input.orgId,
    email: input.email.toLowerCase().trim(),
    role: input.role,
    invitedBy: input.invitedBy,
    token,
    status: 'pending',
    expiresAt,
  });

  return { invitation: docToRow(doc), token };
}

/** Look up an invitation by its raw token. Returns null if not found. */
export async function findInvitationByToken(token: string): Promise<InvitationRow | null> {
  const doc = await InvitationModel.findOne({ token });
  return doc ? docToRow(doc) : null;
}

/**
 * Mark an invitation as accepted. This is called atomically when the invitee
 * completes signup — a second call for the same token will return null.
 */
export async function acceptInvitation(id: string): Promise<InvitationRow | null> {
  const doc = await InvitationModel.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { status: 'accepted' },
    { new: true },
  );
  return doc ? docToRow(doc) : null;
}

/** Mark an invitation as expired. Used by admin revocation. */
export async function expireInvitation(id: string): Promise<boolean> {
  const res = await InvitationModel.updateOne(
    { _id: id, status: 'pending' },
    { status: 'expired' },
  );
  return res.modifiedCount > 0;
}

/** Check if a pending (non-expired) invite exists for this org + email. */
export async function findPendingInvitation(orgId: string, email: string): Promise<InvitationRow | null> {
  const doc = await InvitationModel.findOne({
    orgId,
    email: email.toLowerCase().trim(),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
  return doc ? docToRow(doc) : null;
}

/** List all invitations for an org (for the admin dashboard). */
export async function listInvitations(orgId: string): Promise<InvitationRow[]> {
  const docs = await InvitationModel.find({ orgId }).sort({ createdAt: -1 });
  return docs.map(docToRow);
}

/** Bulk-expire all pending invitations whose expiresAt has passed. */
export async function expireStaleInvitations(): Promise<number> {
  const res = await InvitationModel.updateMany(
    { status: 'pending', expiresAt: { $lte: new Date() } },
    { status: 'expired' },
  );
  return res.modifiedCount;
}
