// Seeds demo users + listings for local testing.
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

dotenv.config({ path: new URL('./.env', import.meta.url) });
const secret = process.env.AUTH_SESSION_SECRET || process.env.AZURE_SECRET;
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

await db.collection('users').deleteMany({});
await db.collection('companies').deleteMany({});
await db.collection('listings').deleteMany({});
await db.collection('new_companies').deleteMany({});

await db.collection('users').insertMany([
  { name: 'Aarav Admin', email: 'admin@iitg.ac.in', role: 'admin' },
  { name: 'Divya DPR', email: 'divya.dpr@iitg.ac.in', role: 'dpr' },
  { name: 'Rahul SC', email: 'rahul.sc@iitg.ac.in', role: 'sc' },
  { name: 'Sneha SC', email: 'sneha.sc@iitg.ac.in', role: 'sc' },
]);
const users = {};
for (const u of await db.collection('users').find({}).toArray()) users[u.email] = u._id;

async function company(name) {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase();
  const existing = await db.collection('companies').findOne({ nameNormalized: normalized });
  if (existing) return existing._id;
  const res = await db.collection('companies').insertOne({ name, nameNormalized: normalized, createdAt: new Date(), updatedAt: new Date() });
  return res.insertedId;
}

const ev = (type, by, byRole, byName, payload = {}, offsetMin = 0) => ({
  type, by, byRole, byName, payload,
  createdAt: new Date(Date.now() - offsetMin * 60000),
});

const demo = [
  {
    companyName: 'TechNova Solutions',
    profiles: ['Frontend Developer', 'Backend Developer'],
    listedBy: 'divya.dpr@iitg.ac.in', proposedBy: 'divya.dpr@iitg.ac.in', assignedSC: 'rahul.sc@iitg.ac.in',
    pocs: [
      { name: 'Amit Sharma', email: 'amit@technova.com', phone: '9876543210', status: 'ongoing' },
      { name: 'Nina Verma', email: 'nina@technova.com', phone: '9876543211', status: 'yet to contact' },
    ],
    events: [
      ['listed', 'divya.dpr@iitg.ac.in', 'dpr'],
      ['sc-assigned', 'admin@iitg.ac.in', 'admin', { scEmail: 'rahul.sc@iitg.ac.in' }],
      ['remark-added', 'divya.dpr@iitg.ac.in', 'dpr', { text: 'Initial call done, very receptive. Shared the brochure.' }],
      ['status-changed', 'rahul.sc@iitg.ac.in', 'sc', { to: 'ongoing' }],
      ['remark-added', 'rahul.sc@iitg.ac.in', 'sc', { text: 'Followed up on WhatsApp, they want a follow-up meeting next week.' }],
    ],
  },
  {
    companyName: 'Quantum Analytics',
    profiles: ['Data Analyst', 'Data Scientist'],
    listedBy: 'divya.dpr@iitg.ac.in', proposedBy: 'divya.dpr@iitg.ac.in', assignedSC: null,
    pocs: [{ name: 'Priya Nair', email: 'priya@quantum.io', phone: '9000000001', status: 'onboarded' }],
    events: [
      ['listed', 'divya.dpr@iitg.ac.in', 'dpr'],
      ['remark-added', 'divya.dpr@iitg.ac.in', 'dpr', { text: 'Onboarded for data roles, JD received.' }],
      ['status-changed', 'sneha.sc@iitg.ac.in', 'sc', { to: 'onboarded' }],
    ],
  },
  {
    companyName: 'Helios Robotics',
    profiles: ['Embedded Engineer'],
    listedBy: 'admin@iitg.ac.in', proposedBy: 'admin@iitg.ac.in', assignedSC: 'sneha.sc@iitg.ac.in',
    pocs: [{ name: 'Karan Mehta', email: 'karan@helios.tech', phone: '9111111111', status: 'rejected' }],
    events: [
      ['listed', 'admin@iitg.ac.in', 'admin'],
      ['sc-assigned', 'admin@iitg.ac.in', 'admin', { scEmail: 'sneha.sc@iitg.ac.in' }],
      ['remark-added', 'sneha.sc@iitg.ac.in', 'sc', { text: 'Not hiring this season, declined politely.' }],
      ['status-changed', 'sneha.sc@iitg.ac.in', 'sc', { to: 'rejected' }],
    ],
  },
];

let n = 60;
for (const d of demo) {
  const listingPocs = d.pocs.map((p) => ({ _id: new mongoose.Types.ObjectId(), ...p }));
  const firstPocId = listingPocs[0]._id;
  const listingEvents = [];
  let offset = 60;
  for (const [type, byEmail, byRole, payload = {}] of d.events) {
    const author = await db.collection('users').findOne({ _id: users[byEmail] });
    // Link events to the first POC so they surface per-contact in the UI
    if (type === 'remark-added' && !payload.poc) payload.poc = firstPocId;
    if (type === 'status-changed' && !payload.poc) {
      payload.poc = firstPocId;
      payload.pocName = listingPocs[0].name;
      payload.from = 'yet to contact';
    }
    listingEvents.push({
      type,
      by: users[byEmail],
      byRole,
      byName: author ? author.name : 'System',
      payload,
      createdAt: new Date(Date.now() - (offset -= 10) * 60000),
    });
  }
  await db.collection('listings').insertOne({
    company: await company(d.companyName),
    profiles: d.profiles,
    listedBy: users[d.listedBy],
    proposedBy: users[d.proposedBy],
    assignedSC: d.assignedSC ? users[d.assignedSC] : null,
    pocs: listingPocs,
    events: listingEvents,
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(),
  });
}

console.log(`Seeded ${demo.length} listings.`);
console.log('\n=== LOGIN COOKIES (valid 8h) ===');
for (const [email, id] of Object.entries(users)) {
  const role = (await db.collection('users').findOne({ _id: id })).role;
  const token = jwt.sign({ sub: String(id), email }, secret, { expiresIn: '8h' });
  console.log(`\n[${role.toUpperCase()}] ${email}\ndpr_session=${encodeURIComponent(token)}`);
}
await mongoose.disconnect();
