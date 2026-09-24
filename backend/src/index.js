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

// Canonical header for company bulk-upload files (CSV first row / Excel
// first row). Uploads whose headers don't match are rejected so users can't
// accidentally import the wrong file. Compare against Frontend/public/sample.csv.
const UPLOAD_HEADERS = [
  "companyName",
  "profiles",
  "pocName",
  "pocEmail",
  "pocPhone",
  "otherRemarks",
];

const normalizeHeader = (value) =>
  String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();

class UploadValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UploadValidationError";
    this.statusCode = 400;
  }
}

const assertUploadHeaders = (actualHeaders) => {
  const expected = new Set(UPLOAD_HEADERS.map(normalizeHeader));
  const actual = new Set((actualHeaders || []).map(normalizeHeader));

  const missing = [...expected].filter((header) => !actual.has(header));
  const unexpected = [...actual].filter((header) => header && !expected.has(header));

  if (missing.length > 0 || unexpected.length > 0) {
    const details = [
      missing.length > 0 ? `missing columns: ${missing.join(", ")}` : null,
      unexpected.length > 0 ? `unexpected columns: ${unexpected.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("; ");
    throw new UploadValidationError(
      `Invalid file format (${details}). Please use the sample CSV template: expected header "${UPLOAD_HEADERS.join(",")}".`
    );
  }
};

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Annotate parsed upload entries with per-row / per-contact issues so the
// user can fix them in the browser before accepting. Blocking ("error")
// issues must be resolved or the row removed before import.
const buildUploadPreview = async (entries, user) => {
  const preview = [];
  const statusLockedForUploader = user?.role === 'dpr';

  for (const entry of entries || []) {
    const name = String(entry?.name || '').trim();
    const issues = [];
    if (!name) {
      issues.push({ level: 'error', message: 'Missing company name — type it in to import this row.' });
    }

    const profiles = [
      ...new Set(
        (entry?.profiles || []).map((profile) => String(profile || '').trim()).filter(Boolean)
      ),
    ];
    if (!profiles.length) {
      issues.push({ level: 'error', message: 'Add at least one profile offered by this company.' });
    }

    const pocs = (entry?.pocs || []).map((poc) => {
      const cleaned = {
        name: String(poc?.name || '').trim(),
        email: String(poc?.email || '').trim(),
        phone: String(poc?.phone || '').trim(),
        remarks: String(poc?.remarks || '').trim(),
        rowNumber: poc?.rowNumber ?? null,
        issues: [],
      };

      const rawStatus = String(poc?.status || '').trim().toLowerCase();
      cleaned.status = resolveAddedPocStatus(user, rawStatus);
      if (statusLockedForUploader && rawStatus && rawStatus !== 'yet to contact') {
        cleaned.issues.push({
          level: 'warning',
          message: 'Status is managed by coordinators — will be saved as "yet to contact".',
        });
      } else if (rawStatus && cleaned.status !== rawStatus) {
        cleaned.issues.push({
          level: 'warning',
          message: `Unknown status "${poc.status}" — will be saved as "yet to contact".`,
        });
      }
      if (!cleaned.name) {
        cleaned.issues.push({
          level: 'error',
          message: 'Contact name is required — fill it in.',
        });
      } else if (!cleaned.email) {
        cleaned.issues.push({
          level: 'warning',
          message: 'No email — duplicates cannot be detected when merging.',
        });
      } else if (!EMAIL_RE.test(cleaned.email)) {
        cleaned.issues.push({
          level: 'warning',
          message: `"${cleaned.email}" doesn't look like a valid email address.`,
        });
      }
      return cleaned;
    });

    if (!pocs.length) {
      issues.push({ level: 'warning', message: 'No contacts for this company.' });
    }

    let alreadyListed = false;
    if (name) {
      // eslint-disable-next-line no-await-in-loop
      const companyDoc = await Company.findOne({ nameNormalized: normalizeCompanyName(name) }).select('_id');
      if (companyDoc) {
        // eslint-disable-next-line no-await-in-loop
        alreadyListed = Boolean(await Listing.exists({ company: companyDoc._id }));
      }
    }

    const canImport =
      !issues.some((issue) => issue.level === 'error') &&
      !pocs.some((poc) => poc.issues.some((issue) => issue.level === 'error'));

    preview.push({
      name,
      profiles,
      pocs,
      rowNumbers: entry?.rowNumbers || [],
      issues,
      alreadyListed,
      canImport,
    });
  }

  return preview;
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

// Multi-value cell separators for bulk-upload files:
//   profiles   -> separated by ";"  (e.g. "SDE; Data Analyst")
//   otherRemarks -> separated by "|"  (e.g. "First call done | Follow up next week")
// A comma cannot be used since it is the CSV column separator.
const splitProfilesCell = (value) =>
  String(value || "")
    .split(";")
    .map((profile) => profile.trim())
    .filter(Boolean);

const splitRemarksCell = (value) =>
  String(value || "")
    .split("|")
    .map((remark) => remark.trim())
    .filter(Boolean);

// DPR users may not set contact status on add; coordinators manage it.
// Everyone else's explicit status is honored.
const resolveAddedPocStatus = (user, rawStatus) => {
  if (user?.role === 'dpr') return 'yet to contact';
  const normalized = String(rawStatus || '').trim().toLowerCase();
  return VALID_STATUSES.includes(normalized) ? normalized : 'yet to contact';
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
    // Nameless contacts are never saved; confirm validation rejects them.
    if (!name) continue;
    const email = String(poc?.email || "").trim().toLowerCase();
    cleanedPocs.push({
      name,
      email: email || undefined,
      phone: String(poc?.phone || "").trim() || undefined,
      status: resolveAddedPocStatus(user, poc?.status),
    });
    importedRemarkTexts.push(splitRemarksCell(poc?.remarks));
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
    for (const text of importedRemarkTexts[index] || []) {
      appendEvent(listing, "remark-added", user, {
        poc: poc._id,
        text,
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
    const ungrouped = [];
    let headerRow = null;
    let rowNumber = 1; // header is row 1

    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => String(header).replace(/^\uFEFF/, '').trim() }))
      .on('headers', (headers) => {
        headerRow = headers;
      })
      .on('data', (data) => {
        rowNumber += 1;
        const companyName = data.companyName?.trim() || '';
        const poc = {
          name: data.pocName?.trim() || '',
          email: data.pocEmail?.trim() || '',
          phone: data.pocPhone?.trim() || '',
          status: 'yet to contact',
          remarks: data.otherRemarks?.trim() || '',
          rowNumber,
        };
        const pocHasContent = poc.name || poc.email || poc.phone || poc.remarks;
        const profiles = splitProfilesCell(data.profiles);

        // Rows without a company name can't be grouped; keep them so the
        // user can fix them in the review step instead of dropping silently.
        if (!companyName) {
          ungrouped.push({
            name: '',
            profiles,
            pocs: pocHasContent ? [poc] : [],
            rowNumbers: [rowNumber],
          });
          return;
        }

        if (!companiesMap.has(companyName)) {
          companiesMap.set(companyName, { name: companyName, profiles: [], pocs: [], rowNumbers: [] });
        }

        const company = companiesMap.get(companyName);
        company.rowNumbers.push(rowNumber);

        // Add profiles (a cell may hold several, separated by ";")
        for (const profile of profiles) {
          if (!company.profiles.includes(profile)) {
            company.profiles.push(profile);
          }
        }

        // Keep any POC with content; validity is flagged at preview time.
        if (pocHasContent && !company.pocs.find(p => p.email && poc.email && p.email === poc.email)) {
          company.pocs.push(poc);
        }
      })
      .on('end', () => {
        try {
          assertUploadHeaders(headerRow);
        } catch (headerError) {
          reject(headerError);
          return;
        }
        resolve([...companiesMap.values(), ...ungrouped]);
      })
      .on('error', reject);
  });
}


// Helper function to parse Excel
async function parseExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  const headerRow = (rawRows[0] || []).map((cell) => String(cell));
  assertUploadHeaders(headerRow);

  const data = xlsx.utils.sheet_to_json(worksheet);

  return data
    .map((row, index) => {
      const rowNumber = index + 2; // header is row 1
      const poc = {
        name: String(row.pocName || row['poc name'] || '').trim(),
        email: String(row.pocEmail || row['poc email'] || '').trim(),
        phone: String(row.pocPhone || row['poc phone'] || '').trim(),
        status: 'yet to contact',
        remarks: String(row.otherRemarks || row['other remarks'] || '').trim(),
        rowNumber,
      };
      const pocHasContent = poc.name || poc.email || poc.phone || poc.remarks;

      return {
        name: String(row.name || row.companyName || row['company name'] || '').trim(),
        profiles: row.profiles
          ? String(row.profiles).split(String(row.profiles).includes(';') ? ';' : ',').map(p => p.trim()).filter(Boolean)
          : [],
        pocs: pocHasContent ? [poc] : [],
        rowNumbers: [rowNumber],
      };
    })
    .filter((company) => company.name || company.pocs.length > 0 || company.profiles.length > 0);
}

const app = express();
const apiRouter = express.Router();

// Connect to the database
connectDB();

// Middleware setup
app.use(`${BASE_PATH}/admin`, adminRouter);
app.use(fUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 25 * 1024 * 1024 },
  abortOnLimit: true,
  responseOnLimit: 'File too large. Maximum upload size is 25MB.',
}));
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

// Retries only on network-level failures (fetch throwing - DNS blips,
// connection resets, timeouts). Never retries on an actual HTTP response
// from Azure (4xx/5xx), since those are legitimate rejections and the
// authorization code has already been consumed by the first attempt.
const fetchWithRetry = async (url, options, retries = 2, delayMs = 400) => {
  try {
    return await fetch(url, options);
  } catch (networkError) {
    if (retries <= 0) throw networkError;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return fetchWithRetry(url, options, retries - 1, delayMs);
  }
};

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
    const tokenResponse = await fetchWithRetry(
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

// Shared ingestion: merge parsed entries into existing listings or create new
// ones. Used by the file-confirm endpoint (and the legacy direct-upload one).
const ingestCompanyEntries = async ({ entries, user }) => {
  const savedListings = [];

  for (const entry of entries) {
    const companyDoc = await Company.findOne({
      nameNormalized: normalizeCompanyName(entry.name),
    }).select('_id');
    const existingListing = companyDoc
      ? await Listing.findOne({ company: companyDoc._id })
      : null;

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
        const name = String(poc?.name || '').trim();
        if (!name || (email && existingEmails.has(email))) continue;
        existingListing.pocs.push({
          name,
          email: email || undefined,
          phone: String(poc.phone || '').trim() || undefined,
          status: resolveAddedPocStatus(user, poc.status),
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

  return savedListings;
};

const parseUploadedFile = async (file) => {
  const filePath = path.join(tempDir, `${Date.now()}-${file.name}`);
  await file.mv(filePath);

  try {
    const fileExtension = path.extname(file.name).toLowerCase();
    if (fileExtension === '.csv') {
      return await parseCSV(filePath);
    }
    if (['.xlsx', '.xls'].includes(fileExtension)) {
      return await parseExcel(filePath);
    }
    return [];
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

const requireUploadPermission = (user, res) => {
  if (user.role === 'sc') {
    res.status(403).json({ success: false, message: 'SC users cannot upload companies' });
    return false;
  }
  if (!user || !user._id) {
    res.status(400).json({ message: 'User is not authenticated' });
    return false;
  }
  return true;
};

// Step 1 of bulk upload: parse + validate the file and return a preview.
// Nothing is written to the database here.
apiRouter.post('/api/preview-company-file', authGuard, async (req, res) => {
  try {
    const user = req.user;
    if (!requireUploadPermission(user, res)) return;

    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.files.file;
    const validation = validateFile(file);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    const companies = await parseUploadedFile(file);

    if (!companies.length) {
      return res.status(400).json({ message: 'No valid company data found in file' });
    }

    const preview = await buildUploadPreview(companies, user);
    const blocked = preview.filter((entry) => !entry.canImport).length;

    res.status(200).json({
      success: true,
      message:
        blocked > 0
          ? `Found ${preview.length} companies in file — ${blocked} need${blocked === 1 ? 's' : ''} details before they can be added`
          : `Found ${preview.length} companies in file`,
      preview,
    });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Error previewing companies file', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Step 2 of bulk upload: persist the previously previewed entries after the
// user accepts them.
apiRouter.post('/api/confirm-company-upload', authGuard, async (req, res) => {
  try {
    const user = req.user;
    if (!requireUploadPermission(user, res)) return;

    const { companies } = req.body || {};
    if (!Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ success: false, message: 'No companies to import' });
    }

    const sanitized = companies.map((entry) => ({
      name: String(entry?.name || '').trim(),
      profiles: Array.isArray(entry?.profiles) ? entry.profiles : [],
      pocs: Array.isArray(entry?.pocs) ? entry.pocs : [],
    }));

    const problems = [];
    sanitized.forEach((entry, index) => {
      const label = entry.name || `Entry ${index + 1}`;
      if (!entry.name) {
        problems.push(`${label}: missing company name`);
      }
      const profiles = (entry.profiles || []).map((p) => String(p || '').trim()).filter(Boolean);
      if (!profiles.length) {
        problems.push(`${label}: add at least one profile`);
      }
      (entry.pocs || []).forEach((poc, pocIndex) => {
        if (!String(poc?.name || '').trim()) {
          problems.push(`${label}, contact ${pocIndex + 1}: contact name is required`);
        }
      });
    });

    if (problems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in the missing details before accepting.',
        problems,
      });
    }

    if (!sanitized.length) {
      return res.status(400).json({ success: false, message: 'No valid company data to import' });
    }

    const savedListings = await ingestCompanyEntries({ entries: sanitized, user });

    res.status(201).json({
      success: true,
      message: `Successfully added ${savedListings.length} companies`,
      companies: savedListings.map((listing) => serializeListing(listing)),
    });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'One of these companies was added by another user. Please review and try again.',
      });
    }
    console.error('Error confirming companies upload', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Legacy direct upload (parses and saves in one step). Kept for older cached
// frontend bundles; the UI now uses preview + confirm instead.
apiRouter.post('/api/add-company-with-file', authGuard, async (req, res) => {
  try {
    const user = req.user;
    if (!requireUploadPermission(user, res)) return;

    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.files.file;
    const validation = validateFile(file);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    const companies = await parseUploadedFile(file);

    if (!companies.length) {
      return res.status(400).json({ message: 'No valid company data found in file' });
    }

    const savedListings = await ingestCompanyEntries({ entries: companies, user });

    res.status(201).json({ message: `Successfully added ${savedListings.length} companies`, companies: savedListings.map((listing) => serializeListing(listing)) });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Error uploading companies file', error);
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

// Never leak stack traces / internals on malformed input: Express's default
// error handler returns HTML with a stack trace when NODE_ENV is unset.
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ success: false, message: 'Malformed JSON in request body' });
  }
  console.error('Unhandled request error', err);
  return res.status(500).json({ success: false, message: 'Internal server error' });
});

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
