import dotenv from "dotenv";
dotenv.config();

import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import * as AdminJSMongoose from "@adminjs/mongoose";
import Company from "../models/company.model.js";
import Listing from "../models/listing.model.js";
import User from "../models/user.model.js";

const MASTER_ADMIN = {
  email: process.env.MASTER_ADMIN_EMAIL,
  password: process.env.MASTER_ADMIN_PASSWORD,
};

const BASE_PATH = `/${(process.env.BASE_PATH || "/dpr").replace(/^\/+|\/+$/g, "")}`;

AdminJS.registerAdapter({
  Database: AdminJSMongoose.Database,
  Resource: AdminJSMongoose.Resource,
});

export const admin = new AdminJS({
  rootPath: `${BASE_PATH}/admin`,
  loginPath: `${BASE_PATH}/admin/login`,
  logoutPath: `${BASE_PATH}/admin/logout`,
  resources: [Company, Listing, User],
});

export const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  admin,
  {
    authenticate: async (email, password) => {
      if (email === MASTER_ADMIN.email && password === MASTER_ADMIN.password) {
        return MASTER_ADMIN;
      }
      return null;
    },
    cookiePassword: process.env.ADMINJS_COOKIE_PASSWORD,
    cookieName: process.env.ADMINJS_COOKIE_NAME,
  },
  null,
  {
    resave: false,
    saveUninitialized: true,
    secret: process.env.ADMINJS_COOKIE_SECRET,
  }
);
