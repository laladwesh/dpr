import User from "../models/user.model.js";
import { getSessionToken, verifySessionToken } from "../auth/session.js";

export const authGuard = async (req, res, next) => {
  try {
    const token = getSessionToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const claims = verifySessionToken(token);
    const user = await User.findOne({
      $or: [{ _id: claims.sub }, { email: String(claims.email || "").toLowerCase() }],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not Authorized, please contact team CCD",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    console.error("Error in auth middleware", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
