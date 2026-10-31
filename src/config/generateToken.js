const jwt = require("jsonwebtoken");
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
function generateToken(userId, email, res) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in .env");
  }
  const token = jwt.sign({ userId, email }, process.env.JWT_SECRET, {
    expiresIn:"7d",
  });
  res.cookie("token", token, {
    httpOnly: true, // JavaScript in the browser can't read it
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict",
    maxAge: SEVEN_DAYS, // matches the 7d expiry
  });
  return token;
}
module.exports = generateToken;