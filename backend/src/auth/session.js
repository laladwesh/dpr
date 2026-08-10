import jwt from "jsonwebtoken";

const SESSION_COOKIE_NAME = "dpr_session";

const getSessionSecret = () => {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.AZURE_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET or AZURE_SECRET must be configured");
  }
  return secret;
};

export const createSessionToken = (user) =>
  jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
    },
    getSessionSecret(),
    { expiresIn: "8h" }
  );

export const verifySessionToken = (token) => jwt.verify(token, getSessionSecret());

export const getSessionToken = (req) => {
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  const cookieHeader = req.headers.cookie || "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));

  return sessionCookie ? decodeURIComponent(sessionCookie.slice(SESSION_COOKIE_NAME.length + 1)) : null;
};

export const setSessionCookie = (res, token) => {
  const secure = process.env.NODE_ENV === "production";
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Max-Age=28800",
    secure ? "SameSite=None" : "SameSite=Lax",
  ];

  if (secure) attributes.push("Secure");
  res.setHeader("Set-Cookie", attributes.join("; "));
};

export const clearSessionCookie = (res) => {
  const secure = process.env.NODE_ENV === "production";
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Max-Age=0",
    secure ? "SameSite=None" : "SameSite=Lax",
  ];

  if (secure) attributes.push("Secure");
  res.setHeader("Set-Cookie", attributes.join("; "));
};

export const SESSION_COOKIE_NAME_VALUE = SESSION_COOKIE_NAME;
