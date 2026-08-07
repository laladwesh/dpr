import dotenv from 'dotenv';

import mongoose from "mongoose";
import User from "./src/models/user.model.js";

const MONGODB_URI = dotenv.config().parsed?.MONGODB_URI;
  //"mongodb+srv://ramdhankumar1425:rk8ceqhdh800@cluster0.hgvo9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const dummyUsers = [
  {
    name: "Ramdhan Kumar",
    email: "k.ramdhan@iitg.ac.in",
    role: "admin",
    companies: [],
  },
  { name: "UNP", email: "u.pandey@iitg.ac.in", role: "admin", companies: [] },
  {
    name: "Avinash Gupta",
    email: "g.avinash@iitg.ac.in",
    role: "admin",
    companies: [],
  },
  {
    name: "Rohit Sharma",
    email: "rohit.sharma@example.com",
    role: "dpr",
    companies: [],
  },
  {
    name: "Meera Nair",
    email: "meera.nair@example.com",
    role: "dpr",
    companies: [],
  },
  {
    name: "Kunal Joshi",
    email: "kunal.joshi@example.com",
    role: "dpr",
    companies: [],
  },
  {
    name: "Tanya Singh",
    email: "tanya.singh@example.com",
    role: "dpr",
    companies: [],
  },
];

async function insertUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    for (const u of dummyUsers) {
      const res = await User.updateOne(
        { email: u.email }, // match by unique email
        { $setOnInsert: u }, // only set if inserting
        { upsert: true } // insert if not found
      );

      if (res.upsertedCount === 1) {
        console.log(`✅ Inserted: ${u.email}`);
      } else {
        console.log(`↩️  Duplicate found, skipping: ${u.email}`);
      }
    }

    console.log("Done.");
  } catch (err) {
    console.error("❌ Error inserting users:", err);
  } finally {
    await mongoose.connection.close();
  }
}

insertUsers();
