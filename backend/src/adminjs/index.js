import dotenv from "dotenv";
dotenv.config();

import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import * as AdminJSMongoose from "@adminjs/mongoose";
import Company from "../models/company.model.js";
import User from "../models/user.model.js";

const MASTER_ADMIN = {
  email: process.env.MASTER_ADMIN_EMAIL,
  password: process.env.MASTER_ADMIN_PASSWORD,
};

AdminJS.registerAdapter({
  Database: AdminJSMongoose.Database,
  Resource: AdminJSMongoose.Resource,
});

export const admin = new AdminJS({
  rootPath: "/dpr/admin",
  loginPath: "/dpr/admin/login",
  logoutPath: "/dpr/admin/logout",
  resources: [Company, User],
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
