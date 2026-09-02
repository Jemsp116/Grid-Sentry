import { OrgModel, type IOrgDoc } from '../config/mongoSchemas.js';
import type { Types } from 'mongoose';

export interface OrgRow {
  id: string;   // Mongo _id as string
  name: string;
  createdBy: number;
  createdAt: Date;
}

function docToOrgRow(doc: IOrgDoc): OrgRow {
  return {
    id: (doc._id as Types.ObjectId).toString(),
    name: doc.name,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
  };
}

/**
 * Create a new organization. Call this before creating the founding admin user
 * so you can pass the orgId into the user document.
 *
 * Note: `createdBy` is set after user creation via `setOrgCreator` because the
 * org and its first user are created in the same transaction-like sequence.
 */
export async function createOrg(name: string, createdBy: number = 0): Promise<OrgRow> {
  const doc = await OrgModel.create({ name, createdBy });
  return docToOrgRow(doc);
}

/** Update the createdBy field once the founding user's numeric id is known. */
export async function setOrgCreator(orgId: string, userId: number): Promise<void> {
  await OrgModel.updateOne({ _id: orgId }, { createdBy: userId });
}

export async function findOrgById(orgId: string): Promise<OrgRow | null> {
  const doc = await OrgModel.findById(orgId);
  return doc ? docToOrgRow(doc) : null;
}
