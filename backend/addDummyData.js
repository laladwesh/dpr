// seed/insertCompanies.js
import dotenv from 'dotenv';

import mongoose from "mongoose";
import Company from "./src/models/company.model.js"; // update path as needed

const MONGODB_URI = dotenv.config().parsed?.MONGODB_URI;
  //"mongodb+srv://ramdhankumar1425:rk8ceqhdh800@cluster0.hgvo9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const companies = [
  {
    dprEmail: "dpr1@example.com",
    name: "TechNova Solutions",
    profiles: ["Frontend Developer", "Backend Developer"],
    pocs: [
      {
        name: "Amit Sharma",
        email: "amit@technova.com",
        phone: "9876543210",
        status: "ongoing",
        remarks: "Followed up on 12th April.",
      },
      {
        name: "Nina Rao",
        email: "nina@technova.com",
        phone: "9123456780",
        status: "onboarded",
        remarks: "Final round completed.",
      },
    ],
  },
  {
    dprEmail: "dpr2@example.com",
    name: "InnoCore Pvt Ltd",
    profiles: ["Data Analyst", "ML Engineer"],
    pocs: [
      {
        name: "Karan Mehta",
        email: "karan@innocore.com",
        phone: "9812345678",
        status: "yet to contact",
        remarks: "Initial email drafted.",
      },
      {
        name: "Pooja Singh",
        email: "pooja@innocore.com",
        phone: "9934567890",
        status: "rejected",
        remarks: "Company not hiring this cycle.",
      },
    ],
  },
  {
    dprEmail: "dpr3@example.com",
    name: "BrightByte Inc.",
    profiles: ["UI/UX Designer", "Fullstack Developer"],
    pocs: [
      {
        name: "Manoj Batra",
        email: "manoj@brightbyte.io",
        phone: "9786543210",
        status: "onboarded",
        remarks: "Sent final selections.",
      },
      {
        name: "Sara Thomas",
        email: "sara@brightbyte.io",
        phone: "9887766554",
        status: "ongoing",
        remarks: "Awaiting feedback.",
      },
    ],
  },
  {
    dprEmail: "dpr4@example.com",
    name: "Cloudverse Tech",
    profiles: ["DevOps Engineer", "Cloud Architect"],
    pocs: [
      {
        name: "Rohan Gupta",
        email: "rohan@cloudverse.com",
        phone: "9870011223",
        status: "yet to contact",
        remarks: "Waiting for response from HR.",
      },
      {
        name: "Divya Kapoor",
        email: "divya@cloudverse.com",
        phone: "9001122334",
        status: "ongoing",
        remarks: "Scheduled meeting for next week.",
      },
      {
        name: "Siddharth Jain",
        email: "sid@cloudverse.com",
        phone: "9787654321",
        status: "rejected",
        remarks: "Company shifted plans to Q4.",
      },
    ],
  },
  {
    dprEmail: "dpr5@example.com",
    name: "QuantumLoop",
    profiles: ["AI Researcher", "System Architect"],
    pocs: [
      {
        name: "Neha Desai",
        email: "neha@quantumloop.io",
        phone: "9345678901",
        status: "onboarded",
        remarks: "All interviews wrapped up.",
      },
      {
        name: "Arjun Patel",
        email: "arjun@quantumloop.io",
        phone: "9123450987",
        status: "ongoing",
        remarks: "Waiting for internal approvals.",
      },
    ],
  },
  {
    dprEmail: "dpr6@example.com",
    name: "PixelForge",
    profiles: ["Graphics Programmer", "Game Developer"],
    pocs: [
      {
        name: "Isha Narang",
        email: "isha@pixelforge.games",
        phone: "9090909090",
        status: "yet to contact",
        remarks: "Email to be sent on Monday.",
      },
      {
        name: "Mohit Sinha",
        email: "mohit@pixelforge.games",
        phone: "9080706050",
        status: "onboarded",
        remarks: "Shared offer letters with students.",
      },
    ],
  },
];

async function insertCompanies() {
  try {
    await mongoose.connect(MONGODB_URI);

    console.log("Connected to MongoDB");

    await Company.insertMany(companies);
    console.log("✅ Dummy companies inserted");

    mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error inserting companies:", err);
  }
}

insertCompanies();
