/**
 * HTTP Basic Authentication middleware to secure admin dashboards like Bull-Board.
 * Configured via ADMIN_USER and ADMIN_PASS environment variables.
 */
module.exports = function adminAuth(req, res, next) {
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPass = process.env.ADMIN_PASS || "admin123";

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
    return res.status(401).json({ error: "Authentication required for admin dashboard." });
  }

  const credentials = Buffer.from(authHeader.split(" ")[1], "base64").toString("ascii");
  const [username, password] = credentials.split(":");

  if (username === adminUser && password === adminPass) {
    return next();
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
  return res.status(401).json({ error: "Invalid admin credentials." });
};
