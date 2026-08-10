import mongoose from "mongoose";
import User from "../models/user.model.js";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// load ../../.env from src/db/addUsers.js
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const dummyUsers = [
  {
    name: "Srayash Singh",
    email: "s.srayash@iitg.ac.in",
    role: "admin",
    companies: [],
  },
  {
    name: "Utkarsh Narayan Pandey",
    email: "u.pandey@iitg.ac.in",
    role: "admin",
    companies: [],
  },
  {
    name: "SC User One",
    email: "sc1@iitg.ac.in",
    role: "sc",
    companies: [],
  },
  {
    name: "DPR User One",
    email: "dpr1@iitg.ac.in",
    role: "dpr",
    companies: [],
  }
];

async function insertUsers() {
  try {
    await mongoose.connect(MONGODB_URI);

    console.log("Connected to MongoDB");

    for (const user of dummyUsers) {
      await User.updateOne(
        { email: user.email },
        { $setOnInsert: user },
        { upsert: true }
      );
    }

    console.log("✅ Dummy users inserted");

    await mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error inserting users:", err);
  }
}

insertUsers();
