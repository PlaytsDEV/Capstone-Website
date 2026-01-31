import { auth } from "../config/firebase.js";

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const verifyAdmin = async (req, res, next) => {
  try {
    const user = await auth.getUser(req.user.uid);

    if (!user.customClaims?.admin) {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    next();
  } catch (error) {
    console.error("Admin verification error:", error);
    res.status(403).json({ error: "Access denied" });
  }
};

export const verifySuperAdmin = async (req, res, next) => {
  try {
    const user = await auth.getUser(req.user.uid);

    if (!user.customClaims?.superAdmin) {
      return res
        .status(403)
        .json({ error: "Access denied. Super Admin only." });
    }

    next();
  } catch (error) {
    console.error("Super Admin verification error:", error);
    res.status(403).json({ error: "Access denied" });
  }
};
