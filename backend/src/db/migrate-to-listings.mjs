// One-time migration: old flat `companies` collection -> Company (identity) + Listing.
//
// Old shape:  { name, nameNormalized, profiles, dprEmail, scEmail,
//               pocs: [{ name, email, phone, status, remarks: [ {role, author, authorEmail, text, createdAt} ] | "string" }] }
// New shape:  companies: { name, nameNormalized }
//             listings:  { company, profiles, listedBy, proposedBy, assignedSC, pocs, events }
//
// Usage: node src/db/migrate-to-listings.mjs
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const VALID_STATUSES = ['onboarded', 'ongoing', 'yet to contact', 'rejected'];
const LISTING_EVENT_TYPES = {
  listed: 'listed',
  scAssigned: 'sc-assigned',
  statusChanged: 'status-changed',
  remarkAdded: 'remark-added',
};

const normalizeLegacyRemarks = (remarksValue) => {
  if (Array.isArray(remarksValue)) {
    return remarksValue
      .filter((remark) => remark && String(remark.text || remark.message || remark.remarks || '').trim())
      .map((remark) => ({
        role: ['sc', 'dpr', 'admin'].includes(remark.role) ? remark.role : 'dpr',
        author: String(remark.author || 'Previous note').trim() || 'Previous note',
        authorEmail: String(remark.authorEmail || '').trim().toLowerCase(),
        text: String(remark.text || remark.message || remark.remarks).trim(),
        createdAt: remark.createdAt ? new Date(remark.createdAt) : new Date(),
      }));
  }
  if (typeof remarksValue === 'string' && remarksValue.trim()) {
    return [{
      role: 'dpr',
      author: 'Previous note',
      authorEmail: '',
      text: remarksValue.trim(),
      createdAt: new Date(),
    }];
  }
  return [];
};

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const usersCollection = db.collection('users');
  const rawCompanies = await db.collection('companies').find({}).toArray();

  let createdCompanies = 0;
  let createdListings = 0;
  let skipped = 0;

  for (const raw of rawCompanies) {
    const normalizedName = String(raw.name || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!normalizedName) {
      skipped += 1;
      continue;
    }

    // 1. Company identity (deduped into a staging collection)
    const insertResult = await db.collection('new_companies').updateOne(
      { nameNormalized: normalizedName },
      {
        $setOnInsert: {
          name: String(raw.name).trim(),
          nameNormalized: normalizedName,
          createdAt: raw.createdAt || new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    let companyId = insertResult.upsertedId;
    if (insertResult.upsertedCount) createdCompanies += 1;
    if (!companyId) {
      // Company already staged by an earlier row; resolve its id
      const staged = await db.collection('new_companies').findOne({ nameNormalized: normalizedName });
      companyId = staged._id;
    }

    // Skip if a listing already exists for this company
    const existingListing = await db.collection('listings').findOne({ company: companyId });
    if (existingListing) {
      skipped += 1;
      continue;
    }

    // 2. Resolve user references
    const listedByEmail = String(raw.dprEmail || '').trim().toLowerCase();
    const scEmail = String(raw.scEmail || '').trim().toLowerCase();
    const listedBy = listedByEmail ? await usersCollection.findOne({ email: listedByEmail }) : null;
    const assignedSC = scEmail ? await usersCollection.findOne({ email: scEmail }) : null;

    // 3. POCs (contacts + denormalized status only)
    const pocs = [];
    const remarkTexts = [];
    for (const poc of raw.pocs || []) {
      pocs.push({
        _id: poc._id || new mongoose.Types.ObjectId(),
        name: String(poc.name || 'Unnamed contact').trim(),
        email: poc.email ? String(poc.email).toLowerCase() : undefined,
        phone: poc.phone || undefined,
        status: VALID_STATUSES.includes(poc.status) ? poc.status : 'yet to contact',
      });
      remarkTexts.push(normalizeLegacyRemarks(poc.remarks));
    }

    // 4. Event timeline reconstructed from legacy data
    const listingCreatedAt = raw.createdAt || new Date();
    const events = [];

    events.push({
      type: LISTING_EVENT_TYPES.listed,
      by: listedBy?._id ?? null,
      byRole: 'dpr',
      byName: listedBy?.name || listedByEmail || 'System',
      payload: {},
      createdAt: listingCreatedAt,
    });

    if (assignedSC) {
      events.push({
        type: LISTING_EVENT_TYPES.scAssigned,
        by: listedBy?._id ?? null,
        byRole: 'admin',
        byName: 'Migration',
        payload: { scEmail },
        createdAt: listingCreatedAt,
      });
    }

    pocs.forEach((poc, index) => {
      for (const remark of remarkTexts[index] || []) {
        events.push({
          type: LISTING_EVENT_TYPES.remarkAdded,
          by: null,
          byRole: remark.role,
          byName: remark.author,
          payload: { poc: poc._id, text: remark.text },
          createdAt: remark.createdAt,
        });
      }
      if (poc.status !== 'yet to contact') {
        events.push({
          type: LISTING_EVENT_TYPES.statusChanged,
          by: assignedSC?._id ?? null,
          byRole: assignedSC ? 'sc' : 'system',
          byName: assignedSC?.name || 'Migration',
          payload: { poc: poc._id, pocName: poc.name, from: 'yet to contact', to: poc.status },
          createdAt: raw.updatedAt || listingCreatedAt,
        });
      }
    });

    await db.collection('listings').insertOne({
      company: companyId,
      profiles: Array.from(new Set((raw.profiles || []).map((p) => String(p).trim()).filter(Boolean))),
      listedBy: listedBy?._id ?? null,
      proposedBy: listedBy?._id ?? null,
      assignedSC: assignedSC?._id ?? null,
      pocs,
      events,
      createdAt: listingCreatedAt,
      updatedAt: raw.updatedAt || new Date(),
    });
    createdListings += 1;
  }

  console.log(`Migration complete: ${createdCompanies} companies, ${createdListings} listings created, ${skipped} skipped.`);
  console.log('Review the data, then swap collections manually:');
  console.log('  db.companies.renameCollection("companies_old")');
  console.log('  db.new_companies.renameCollection("companies")');
  await mongoose.disconnect();
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
