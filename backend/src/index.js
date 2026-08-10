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
          remarks: data.pocRemarks?.trim(),
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
        remarks: row.pocRemarks || '',
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
app.use('/dpr/admin', adminRouter);
app.use(fUpload({ useTempFiles: true, tempFileDir: '/tmp/' }));
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "https://ccd-industry.vercel.app",
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/dpr/', (req, res) => res.send('API is running...'));

const getFrontendUrl = () =>
  `${process.env.FRONTEND_URL || "http://localhost:5173"}${process.env.FRONTEND_BASE_PATH || "/dpr"}`;
const getAzureRedirectUri = () =>
  process.env.AZURE_REDIRECT_URI ||
  `${process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 8081}`}/dpr/api/auth/azure/callback`;

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
  res.redirect(`${getFrontendUrl()}/login?error=${encodeURIComponent(error)}`);

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
    return res.redirect(`${getFrontendUrl()}/dashboard`);
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

// Add companies from request body
apiRouter.post('/api/add-companies', authGuard, async (req, res) => {
  try {
    const { companies } = req.body;
    const user = req.user;
    const dprEmail = user.email;

    if (user.role === 'sc') {
      return res.status(403).json({ success: false, message: 'SC users cannot add companies' });
    }

    if (!dprEmail || !companies || companies.length === 0) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    await Company.insertMany(companies.map(company => ({ ...company, dprEmail })));

    res.status(201).json({ success: true, message: 'Companies added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add companies with file
apiRouter.post('/api/add-company-with-file', authGuard, async (req, res) => {
  try {
    const user = req.user;
    const dprEmail = user.email;

    if (user.role === 'sc') {
      return res.status(403).json({ success: false, message: 'SC users cannot upload companies' });
    }

    if (!user || !user.email) {
      return res.status(400).json({ message: 'User is not authenticated or email is missing' });
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

const savedCompanies = [];

for (const company of companies) {
  const existing = await Company.findOne({ name: company.name });

  if (existing) {
    const updatedProfiles = Array.from(new Set([
      ...existing.profiles,
      ...(company.profiles || [])
    ]));

    const existingEmails = new Set(existing.pocs.map(p => p.email));
    const newPocs = (company.pocs || []).filter(p => !existingEmails.has(p.email));
    const updatedPocs = [...existing.pocs, ...newPocs];

    existing.profiles = updatedProfiles;
    existing.pocs = updatedPocs;
    existing.dprEmail = dprEmail;

    await existing.save();
    savedCompanies.push(existing);
  } else {
    const newCompany = await Company.create({
      ...company,
      dprEmail,
    });
    savedCompanies.push(newCompany);
  }
}


    res.status(201).json({ message: `Successfully added ${savedCompanies.length} companies`, companies: savedCompanies });
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

// Delete company
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

    const deleted = await Company.findByIdAndDelete(companyId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.status(200).json({ success: true, message: 'Company deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get all companies
apiRouter.post('/api/get-all-companies', authGuard, async (req, res) => {
  try {
    const { filter = "all" } = req.body || {};
    const user = req.user;
    const normalizedUserEmail = String(user.email || "").toLowerCase();
    let query = Company.find({});

    if (user.role === "dpr") {
      query = query.select("-pocs.phone -pocs.email");
      if (filter === "listed-by-me") {
        query = query.where({ dprEmail: normalizedUserEmail });
      }
    } else if (user.role === "sc") {
      if (filter === "assigned-to-me") {
        query = query.where({ scEmail: normalizedUserEmail });
      }
    } else if (user.role === "admin") {
      if (filter === "unassigned") {
        query = query.where({ scEmail: { $exists: false } }).or([{ scEmail: null }, { scEmail: "" }]);
      } else if (filter === "assigned") {
        query = query.where({ scEmail: { $ne: "" } }).ne(null);
      }
    }

    const allCompanies = await query.lean();
    const emailsToLookup = [
      ...new Set(
        allCompanies.flatMap((company) => {
          const emails = [];
          if (company.dprEmail) emails.push(String(company.dprEmail).toLowerCase());
          if (company.scEmail) emails.push(String(company.scEmail).toLowerCase());
          return emails;
        })
      ),
    ];

    const users = await User.find({ email: { $in: emailsToLookup } })
      .select("name email")
      .lean();

    const userMap = new Map(users.map((entry) => [String(entry.email).toLowerCase(), entry]));

    const companiesWithNames = allCompanies.map((company) => ({
      ...company,
      dprUserName: userMap.get(String(company.dprEmail || "").toLowerCase())?.name || company.dprEmail || "Unknown",
      scUserName: company.scEmail
        ? userMap.get(String(company.scEmail || "").toLowerCase())?.name || null
        : null,
    }));

    res.status(200).json({
      success: true,
      message: "Companies fetched successfully",
      companies: companiesWithNames,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Assign SC to company
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

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const updatedCompany = await Company.findByIdAndUpdate(
      companyId,
      { scEmail: normalizedScEmail },
      { new: true }
    );

    res.status(200).json({ success: true, message: "SC assigned successfully", company: updatedCompany });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update company profiles
apiRouter.post('/api/update-company-profiles', authGuard, async (req, res) => {
  try {
    const { companyId, profiles } = req.body;
    const user = req.user;
    const normalizedUserEmail = String(user.email || "").toLowerCase();

    if (user.role !== "admin" && user.role !== "sc") {
      return res.status(403).json({ success: false, message: "Only admins and SCs can update profiles" });
    }

    if (!companyId || !Array.isArray(profiles)) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    if (user.role === "sc") {
      const currentScEmail = String(company.scEmail || "").toLowerCase();
      if (currentScEmail && currentScEmail !== normalizedUserEmail) {
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

    company.profiles = cleanedProfiles;
    await company.save();

    res.status(200).json({ success: true, message: "Profiles updated successfully", company });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update POC status
apiRouter.post('/api/update-poc-status', authGuard, async (req, res) => {
  try {
    const { companyId, pocId, status } = req.body;
    const user = req.user;

    if (user.role !== 'admin' && user.role !== 'sc') {
      return res.status(403).json({ success: false, message: 'Only admins and SCs can update status' });
    }

    if (!companyId || !pocId || !status) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const company = await Company.findOneAndUpdate(
      { _id: companyId, 'pocs._id': pocId },
      { $set: { 'pocs.$.status': status } },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({ message: 'Company or POC not found' });
    }

    res.status(200).json({ success: true, message: 'POC status updated', company });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update POC remarks
apiRouter.post('/api/update-poc-remarks', authGuard, async (req, res) => {
  try {
    const { companyId, pocId, remarks } = req.body;
    const user = req.user;

    if (user.role !== 'admin' && user.role !== 'sc') {
      return res.status(403).json({ success: false, message: 'Only admins and SCs can update remarks' });
    }

    if (!companyId || !pocId || !remarks) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const company = await Company.findOneAndUpdate(
      { _id: companyId, 'pocs._id': pocId },
      { $set: { 'pocs.$.remarks': remarks } },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({ message: 'Company or POC not found' });
    }

    res.status(200).json({ success: true, message: 'POC remarks updated', company });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.use('/dpr', apiRouter);

const PORT = process.env.PORT || 8081;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
