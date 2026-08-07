import User from "../models/user.model.js";

export const authGuard = async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error in auth middleware", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
