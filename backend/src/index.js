import dotenv from 'dotenv';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import connectDB from './db/index.js';
import { admin, adminRouter } from './adminjs/index.js';
import { authGuard } from './middleware/auth.middleware.js';
import path from 'path';
import fs from 'fs';
import Company from './models/company.model.js';
import Listing from './models/listing.model.js';
import User from './models/user.model.js';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import fUpload from 'express-fileupload';
import { fileURLToPath } from 'url';
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
} from './auth/session.js';

// Load environment variables
dotenv.config();

// Define constants
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, '../temp');
const allowedFiles = [".csv", ".xlsx", ".xls"];
const BASE_PATH = `/${(process.env.BASE_PATH || "/dpr").replace(/^\/+|\/+$/g, "")}`;
const clientDistPath = path.join(__dirname, '../public');
const hasClientBuild = fs.existsSync(path.join(clientDistPath, 'index.html'));

const normalizeCompanyName = (name) =>
  String(name || "").trim().replace(/\s+/g, " ").toLowerCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const VALID_STATUSES = [
  "onboarded",
  "ongoing",
  "yet to contact",
  "first email sent",
  "follow up sent",
  "rejected",
];

const LISTING_POPULATE = [
  { path: "company", select: "name nameNormalized" },
  { path: "listedBy", select: "name email" },
  { path: "proposedBy", select: "name email" },
  { path: "assignedSC", select: "name email" },
];

const appendEvent = (listing, type, user, payload = {}) => {
  listing.events.push({
    type,
    by: user?._id ?? null,
    byRole: ["admin", "dpr", "sc"].includes(user?.role) ? user.role : "system",
    byName: user?.name || user?.email || "System",
    payload,
  });
};

// Serialize a populated listing into the shape the frontend consumes.
const serializeListing = (listing, { maskPocContacts = false } = {}) => {
  const raw = listing.toObject ? listing.toObject() : listing;
  const remarkEvents = (raw.events || []).filter(
    (event) => event.type === "remark-added" && event.payload?.poc
  );

  return {
    _id: raw._id,
    companyId: raw.company?._id ?? null,
    name: raw.company?.name || "Unknown company",
    profiles: raw.profiles || [],
    pocs: (raw.pocs || []).map((poc) => ({
      _id: poc._id,
      name: poc.name,
      ...(maskPocContacts ? {} : { email: poc.email, phone: poc.phone }),
      status: poc.status,
      remarks: remarkEvents
        .filter((event) => String(event.payload.poc) === String(poc._id))
        .map((event) => ({
          role: event.byRole,
          author: event.byName || "Unknown user",
          authorEmail: "",
          text: event.payload.text,
          createdAt: event.createdAt,
        })),
    })),
    events: raw.events || [],
    listedBy: raw.listedBy
      ? { id: raw.listedBy._id, name: raw.listedBy.name, email: raw.listedBy.email }
      : null,
    proposedBy: raw.proposedBy
      ? { id: raw.proposedBy._id, name: raw.proposedBy.name, email: raw.proposedBy.email }
      : null,
    dprEmail: raw.listedBy?.email || null,
    dprUserName: raw.listedBy?.name || raw.listedBy?.email || "Unknown",
    scEmail: raw.assignedSC?.email || null,
    scUserName: raw.assignedSC?.email ? raw.assignedSC.name : null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

const findOrCreateCompany = async (name) => {
  const trimmed = String(name || "").trim();
  const normalized = normalizeCompanyName(trimmed);
  let company = await Company.findOne({ nameNormalized: normalized });
  if (!company) {
    company = await Company.create({ name: trimmed });
  }
  return company;
};

// Create a listing (with its `listed` event) for a parsed company entry.
const createListingForEntry = async ({ entry, user }) => {
  const company = await findOrCreateCompany(entry.name);

  const existingListing = await Listing.findOne({ company: company._id });
  if (existingListing) {
    return { conflict: company };
  }

  const cleanedPocs = [];
  const importedRemarkTexts = [];
  for (const poc of entry.pocs || []) {
    const name = String(poc?.name || "").trim();
    const email = String(poc?.email || "").trim().toLowerCase();
    if (!name && !email) continue;
    cleanedPocs.push({
      name: name || "Unnamed contact",
      email: email || undefined,
      phone: String(poc?.phone || "").trim() || undefined,
      status: VALID_STATUSES.includes(poc?.status) ? poc.status : "yet to contact",
    });
    importedRemarkTexts.push(String(poc?.remarks || "").trim());
  }

  const listing = new Listing({
    company: company._id,
    profiles: [
      ...new Set(
        (entry.profiles || []).map((profile) => String(profile || "").trim()).filter(Boolean)
      ),
    ],
    listedBy: user._id,
    proposedBy: user._id,
    pocs: cleanedPocs,
  });

  appendEvent(listing, "listed", user);
  listing.pocs.forEach((poc, index) => {
    if (importedRemarkTexts[index]) {
      appendEvent(listing, "remark-added", user, {
        poc: poc._id,
        text: importedRemarkTexts[index],
      });
    }
  });

  await listing.save();
  await listing.populate(LISTING_POPULATE);
  return { listing };
};

// Create temporary directory if not exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Helper function to handle file validation
const validateFile = (file) => {
  const fileExtension = path.extname(file.name).toLowerCase();
  if (!allowedFiles.includes(fileExtension)) {
    return {
      isValid: false,
      message: `Invalid file type. Allowed types: ${allowedFiles.join(', ')}`
    };
  }
  return { isValid: true };
};

// Helper function to parse CSV
async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const companiesMap = new Map();

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        const companyName = data.companyName?.trim();
        if (!companyName) return;

        const profile = data.profiles?.trim();
        const poc = {
          name: data.pocName?.trim(),
          email: data.pocEmail?.trim(),
          phone: data.pocPhone?.trim(),
          status: (data.pocStatus || 'yet to contact').trim().toLowerCase(),
          remarks: data.pocRemarks?.trim() || '',
        };

        if (!companiesMap.has(companyName)) {
          companiesMap.set(companyName, { name: companyName, profiles: [], pocs: [] });
        }

        const company = companiesMap.get(companyName);

        // Add profile if not empty or duplicate
        if (profile && !company.profiles.includes(profile)) {
          company.profiles.push(profile);
        }

        // Add POC if email is provided and not already added
        if (poc.email && !company.pocs.find(p => p.email === poc.email)) {
          company.pocs.push(poc);
        }
      })
      .on('end', () => resolve(Array.from(companiesMap.values())))
      .on('error', reject);
  });
}


// Helper function to parse Excel
async function parseExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);

  return data.map(row => {
    const company = {
      name: row.name || row.companyName || row['company name'] || '',
      profiles: [],
      pocs: [],
    };

    if (row.profiles) {
      const separator = row.profiles.includes(';') ? ';' : ',';
      company.profiles = row.profiles.split(separator).map(p => p.trim());
    }

    if (row.pocName || row['poc name']) {
      company.pocs.push({
        name: row.pocName || row['poc name'],
        email: row.pocEmail || '',
        phone: row.pocPhone || '',
        status: row.pocStatus || 'yet to contact',
        remarks: String(row.pocRemarks || row['poc remarks'] || '').trim(),
      });
    }

    return company.name ? company : null;
  }).filter(Boolean);
}

const app = express();
const apiRouter = express.Router();

// Connect to the database
connectDB();

// Middleware setup
app.use(`${BASE_PATH}/admin`, adminRouter);
app.use(fUpload({ useTempFiles: true, tempFileDir: '/tmp/' }));
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "https://ccd-industry.vercel.app",
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route (only relevant when this process isn't also serving the built frontend)
if (!hasClientBuild) {
  app.get(`${BASE_PATH}/`, (req, res) => res.send('API is running...'));
}

// Path-only (no host) so this resolves relative to whatever origin the
// browser is actually on - the frontend and backend are served from the
// same origin (see hasClientBuild above), so this can't drift out of sync
// with a separately-configured FRONTEND_URL the way an absolute URL could.
const getFrontendPath = () => process.env.FRONTEND_BASE_PATH || BASE_PATH;
const getAzureRedirectUri = () =>
  process.env.AZURE_REDIRECT_URI ||
  `${process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 8081}`}${BASE_PATH}/api/auth/azure/callback`;

const getCookie = (req, name) => {
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
};

const appendCookie = (res, value) => {
  const existing = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", existing ? [existing, value] : value);
};

const azureErrorRedirect = (res, error) =>
  res.redirect(`${getFrontendPath()}/login?error=${encodeURIComponent(error)}`);

apiRouter.get('/api/auth/azure', (req, res) => {
  const { AZURE_CLIENT_ID, AZURE_TENANT, AZURE_SECRET } = process.env;
  if (!AZURE_CLIENT_ID || !AZURE_TENANT || !AZURE_SECRET) {
    return azureErrorRedirect(res, 'azure_config');
  }

  const state = crypto.randomBytes(32).toString('hex');
  appendCookie(
    res,
    `dpr_oauth_state=${state}; Path=/; HttpOnly; Max-Age=600; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );

  const params = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: getAzureRedirectUri(),
    response_mode: 'query',
    scope: 'openid profile email',
    prompt: 'select_account',
    state,
  });

  return res.redirect(`https://login.microsoftonline.com/${AZURE_TENANT}/oauth2/v2.0/authorize?${params}`);
});

apiRouter.get('/api/auth/azure/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code || !state || state !== getCookie(req, 'dpr_oauth_state')) {
    return azureErrorRedirect(res, error ? 'azure_auth' : 'azure_state');
  }

  try {
    const { AZURE_CLIENT_ID, AZURE_TENANT, AZURE_SECRET } = process.env;
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${AZURE_TENANT}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: AZURE_CLIENT_ID,
          client_secret: AZURE_SECRET,
          code,
          redirect_uri: getAzureRedirectUri(),
          grant_type: 'authorization_code',
          scope: 'openid profile email',
        }),
      }
    );
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.id_token) {
      return azureErrorRedirect(res, 'azure_token');
    }

    const keyClient = jwksRsa({
      jwksUri: `https://login.microsoftonline.com/${AZURE_TENANT}/discovery/v2.0/keys`,
    });
    const getSigningKey = (header, callback) => {
      keyClient.getSigningKey(header.kid)
        .then((key) => callback(null, key.getPublicKey()))
        .catch(callback);
    };
    const claims = await new Promise((resolve, reject) => {
      jwt.verify(
        tokenData.id_token,
        getSigningKey,
        {
          algorithms: ['RS256'],
          audience: AZURE_CLIENT_ID,
          issuer: `https://login.microsoftonline.com/${AZURE_TENANT}/v2.0`,
        },
        (verifyError, decoded) => (verifyError ? reject(verifyError) : resolve(decoded))
      );
    });

    const email = String(claims.preferred_username || claims.email || claims.upn || '').trim().toLowerCase();
    const user = email ? await User.findOne({ email }) : null;
    if (!user) {
      return azureErrorRedirect(res, 'unauthorized');
    }

    setSessionCookie(res, createSessionToken(user));
    appendCookie(
      res,
      `dpr_oauth_state=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    );
    return res.redirect(`${getFrontendPath()}/dashboard`);
  } catch (callbackError) {
    console.error('Azure authentication failed', callbackError);
    return azureErrorRedirect(res, 'azure_auth');
  }
});

apiRouter.get('/api/auth/session', authGuard, (req, res) => {
  const { _id, name, email, role } = req.user;
  res.json({ success: true, user: { id: _id, name, email, role } });
});

apiRouter.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

// Get user role
apiRouter.post('/api/get-user-role', authGuard, (req, res) => {
  try {
    const user = req.user;
    res.status(200).json({
      success: true,
      message: 'User role fetched successfully',
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Search existing listings by company name without loading the complete list.
apiRouter.get('/api/company-suggestions', authGuard, async (req, res) => {
  try {
    const query = normalizeCompanyName(req.query.q);
    if (query.length < 2) {
      return res.json({ success: true, companies: [] });
    }

    const matchingCompanies = await Company.find({
      $or: [
        { nameNormalized: { $regex: `^${escapeRegex(query)}` } },
        { name: { $regex: `^${escapeRegex(query)}`, $options: 'i' } },
      ],
    })
      .select('name')
      .sort({ name: 1 })
      .limit(8)
      .lean();

    const listings = await Listing.find({ company: { $in: matchingCompanies.map((c) => c._id) } })
      .populate(LISTING_POPULATE)
      .lean();

    const nameById = new Map(matchingCompanies.map((company) => [String(company._id), company.name]));

    return res.json({
      success: true,
      companies: listings.map((listing) =>
        serializeListing(listing, { maskPocContacts: true })
      ).map((listing) => ({
        id: listing._id,
        name: nameById.get(String(listing.companyId)) || listing.name,
        profiles: listing.profiles,
        pocs: listing.pocs.map(({ name, status }) => ({ name, status })),
        listedBy: listing.dprUserName,
      })),
    });
  } catch (error) {
    console.error('Error searching company suggestions', error);
    return res.status(500).json({ success: false, message: 'Unable to search companies' });
  }
});

// Add companies from request body (creates a Company identity + a Listing)
apiRouter.post('/api/add-companies', authGuard, async (req, res) => {
  try {
    const { companies } = req.body;
    const user = req.user;

    if (user.role === 'sc') {
      return res.status(403).json({ success: false, message: 'SC users cannot add companies' });
    }

    if (!companies || companies.length === 0) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const preparedEntries = companies.map((company) => ({
      ...company,
      name: String(company.name || '').trim(),
    }));

    const namesInRequest = new Set();
    const duplicateInRequest = preparedEntries.find((company) => {
      const normalized = normalizeCompanyName(company.name);
      if (!normalized || namesInRequest.has(normalized)) return true;
      namesInRequest.add(normalized);
      return false;
    });

    if (duplicateInRequest) {
      return res.status(409).json({ success: false, message: `Duplicate company: ${duplicateInRequest.name}` });
    }

    const createdListings = [];
    for (const entry of preparedEntries) {
      // eslint-disable-next-line no-await-in-loop
      const result = await createListingForEntry({ entry, user });
      if (result.conflict) {
        return res.status(409).json({
          success: false,
          message: `${result.conflict.name} is already listed. Please use the existing company instead.`,
        });
      }
      createdListings.push(result.listing);
    }

    res.status(201).json({
      success: true,
      message: 'Companies added successfully',
      listings: createdListings.map((listing) => serializeListing(listing)),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'One of these companies was added by another user. Please search again.',
      });
    }
    console.error('Error adding companies', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add companies with file
apiRouter.post('/api/add-company-with-file', authGuard, async (req, res) => {
  try {
    const user = req.user;

    if (user.role === 'sc') {
      return res.status(403).json({ success: false, message: 'SC users cannot upload companies' });
    }

    if (!user || !user._id) {
      return res.status(400).json({ message: 'User is not authenticated' });
    }

    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.files.file;
    const validation = validateFile(file);

    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    const filePath = path.join(tempDir, file.name);
    await file.mv(filePath);

    let companies = [];
    const fileExtension = path.extname(file.name).toLowerCase();

    if (fileExtension === '.csv') {
      companies = await parseCSV(filePath);
    } else if (['.xlsx', '.xls'].includes(fileExtension)) {
      companies = await parseExcel(filePath);
    }

    fs.unlinkSync(filePath);

    if (!companies.length) {
      return res.status(400).json({ message: 'No valid company data found in file' });
    }

    const savedListings = [];

    for (const entry of companies) {
      const existingListing = await Listing.findOne({
        company: await Company.findOne({ nameNormalized: normalizeCompanyName(entry.name) }).select('_id'),
      });

      if (existingListing) {
        // Merge into the existing listing: union profiles, add unseen POCs.
        const mergedProfiles = [
          ...new Set([...(existingListing.profiles || []), ...(entry.profiles || [])]),
        ];
        const profilesChanged =
          mergedProfiles.length !== (existingListing.profiles || []).length;
        if (profilesChanged) {
          existingListing.profiles = mergedProfiles;
          appendEvent(existingListing, 'profiles-updated', user, { profiles: mergedProfiles });
        }

        const existingEmails = new Set(
          existingListing.pocs.map((poc) => String(poc.email || '').toLowerCase()).filter(Boolean)
        );
        for (const poc of entry.pocs || []) {
          const email = String(poc?.email || '').trim().toLowerCase();
          if (!email || existingEmails.has(email)) continue;
          existingListing.pocs.push({
            name: String(poc.name || 'Unnamed contact').trim(),
            email,
            phone: String(poc.phone || '').trim() || undefined,
            status: VALID_STATUSES.includes(poc.status) ? poc.status : 'yet to contact',
          });
          appendEvent(existingListing, 'poc-added', user, {
            poc: existingListing.pocs[existingListing.pocs.length - 1]._id,
            pocName: poc.name,
          });
        }

        await existingListing.save();
        await existingListing.populate(LISTING_POPULATE);
        savedListings.push(existingListing);
      } else {
        // eslint-disable-next-line no-await-in-loop
        const result = await createListingForEntry({ entry, user });
        if (result.listing) {
          savedListings.push(result.listing);
        }
      }
    }

    res.status(201).json({ message: `Successfully added ${savedListings.length} companies`, companies: savedListings.map((listing) => serializeListing(listing)) });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Get SC users for admin assignment dropdown
apiRouter.post('/api/get-sc-users', authGuard, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'admin' && user.role !== 'sc') {
      return res.status(403).json({ success: false, message: 'Only admins and SCs can fetch SC users' });
    }

    const users = await User.find({ role: 'sc' }).select('name email role').lean();
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Delete listing (and its company identity if no other listing references it)
apiRouter.delete('/api/delete-company', authGuard, async (req, res) => {
  try {
    const { companyId } = req.body;
    const user = req.user;

    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can delete companies' });
    }

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Missing companyId' });
    }

    const deletedListing = await Listing.findByIdAndDelete(companyId);
    if (!deletedListing) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const remainingListings = await Listing.countDocuments({ company: deletedListing.company });
    if (remainingListings === 0) {
      await Company.findByIdAndDelete(deletedListing.company);
    }

    res.status(200).json({ success: true, message: 'Company deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get all listings
apiRouter.post('/api/get-all-companies', authGuard, async (req, res) => {
  try {
    const { filter = "all" } = req.body || {};
    const user = req.user;
    let query = Listing.find({});

    if (user.role === "dpr") {
      if (filter === "listed-by-me") {
        query = query.where({ listedBy: user._id });
      }
    } else if (user.role === "sc") {
      if (filter === "assigned-to-me") {
        query = query.where({ assignedSC: user._id });
      }
    } else if (user.role === "admin") {
      if (filter === "unassigned") {
        query = query.where({
          $or: [{ assignedSC: null }, { assignedSC: { $exists: false } }],
        });
      } else if (filter === "assigned") {
        query = query.where({ assignedSC: { $ne: null } });
      }
    }

    const listings = await query.populate(LISTING_POPULATE).lean();
    const maskPocContacts = user.role === "dpr";

    res.status(200).json({
      success: true,
      message: "Companies fetched successfully",
      companies: listings.map((listing) => serializeListing(listing, { maskPocContacts })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Assign SC to a listing
apiRouter.post('/api/assign-sc', authGuard, async (req, res) => {
  try {
    const { companyId, scEmail } = req.body;
    const user = req.user;
    const normalizedScEmail = String(scEmail || "").trim().toLowerCase();

    if (user.role !== "admin" && user.role !== "sc") {
      return res.status(403).json({ success: false, message: "Only admins and SCs can assign SCs" });
    }

    if (!companyId || !normalizedScEmail) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const targetUser = await User.findOne({ email: normalizedScEmail, role: "sc" });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "SC user not found" });
    }

    const listing = await Listing.findById(companyId);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const previousSC = listing.assignedSC;
    listing.assignedSC = targetUser._id;
    appendEvent(listing, "sc-assigned", user, {
      scEmail: normalizedScEmail,
      from: previousSC ? String(previousSC) : null,
    });
    await listing.save();
    await listing.populate(LISTING_POPULATE);

    res.status(200).json({ success: true, message: "SC assigned successfully", company: serializeListing(listing) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update listing profiles
apiRouter.post('/api/update-company-profiles', authGuard, async (req, res) => {
  try {
    const { companyId, profiles } = req.body;
    const user = req.user;

    if (user.role !== "admin" && user.role !== "sc") {
      return res.status(403).json({ success: false, message: "Only admins and SCs can update profiles" });
    }

    if (!companyId || !Array.isArray(profiles)) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const listing = await Listing.findById(companyId);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    if (user.role === "sc") {
      const isAssigned = listing.assignedSC && String(listing.assignedSC) === String(user._id);
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: "SC can only update profiles for companies assigned to them" });
      }
    }

    const cleanedProfiles = Array.from(
      new Set(
        profiles
          .map((profile) => String(profile || "").trim())
          .filter((profile) => profile.length > 0)
      )
    );

    listing.profiles = cleanedProfiles;
    appendEvent(listing, "profiles-updated", user, { profiles: cleanedProfiles });
    await listing.save();
    await listing.populate(LISTING_POPULATE);

    res.status(200).json({ success: true, message: "Profiles updated successfully", company: serializeListing(listing) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update POC status (records a status-changed event)
apiRouter.post('/api/update-poc-status', authGuard, async (req, res) => {
  try {
    const { companyId, pocId, status } = req.body;
    const user = req.user;

    if (user.role !== 'admin' && user.role !== 'sc') {
      return res.status(403).json({ success: false, message: 'Only admins and SCs can update status' });
    }

    if (!companyId || !pocId || !status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Missing or invalid required fields' });
    }

    const listing = await Listing.findById(companyId);
    if (!listing) {
      return res.status(404).json({ message: 'Company or POC not found' });
    }

    const poc = listing.pocs.id(pocId);
    if (!poc) {
      return res.status(404).json({ message: 'Company or POC not found' });
    }

    const from = poc.status;
    poc.status = status;
    appendEvent(listing, 'status-changed', user, { poc: poc._id, pocName: poc.name, from, to: status });
    await listing.save();
    await listing.populate(LISTING_POPULATE);

    res.status(200).json({ success: true, message: 'POC status updated', company: serializeListing(listing) });
  } catch (error) {
    console.error('Error updating POC status', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update POC remarks (records a remark-added event)
apiRouter.post('/api/update-poc-remarks', authGuard, async (req, res) => {
  try {
    const { companyId, pocId, remarks } = req.body;
    const user = req.user;

    if (!['admin', 'sc', 'dpr'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins, SCs, and DPR users can update remarks' });
    }

    const trimmedRemark = String(remarks || '').trim();
    if (!companyId || !pocId || !trimmedRemark) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const listing = await Listing.findById(companyId);
    if (!listing) {
      return res.status(404).json({ message: 'Company or POC not found' });
    }

    const poc = listing.pocs.id(pocId);
    if (!poc) {
      return res.status(404).json({ message: 'POC not found' });
    }

    appendEvent(listing, 'remark-added', user, { poc: poc._id, text: trimmedRemark });
    await listing.save();
    await listing.populate(LISTING_POPULATE);

    res.status(200).json({ success: true, message: 'POC remarks updated', company: serializeListing(listing) });
  } catch (error) {
    console.error('Error updating POC remarks', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.use(BASE_PATH, apiRouter);

// Serve the built frontend (single-container deploy: copied into ./public at build time)
if (hasClientBuild) {
  app.get('/', (req, res) => res.redirect(`${BASE_PATH}/`));
  app.use(BASE_PATH, express.static(clientDistPath));
  app.get(`${BASE_PATH}/*splat`, (req, res) => {
    if (req.path.startsWith(`${BASE_PATH}/api/`) || req.path.startsWith(`${BASE_PATH}/admin`)) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 8081;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
