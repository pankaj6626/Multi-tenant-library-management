const crypto = require("crypto");
const base64url = (value) => Buffer.from(value).toString("base64url");
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
};
const verifyPassword = (password, savedHash) => {
  const [salt, savedKey] = savedHash.split(":");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(key, "hex"),
    Buffer.from(savedKey, "hex"),
  );
};
const signToken = (payload) => {
  const body = base64url(
    JSON.stringify({ ...payload, exp: Date.now() + 86400000 }),
  );
  return `${body}.${crypto.createHmac("sha256", process.env.JWT_SECRET).update(body).digest("base64url")}`;
};
const verifyToken = (token) => {
  const [body, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(body)
    .digest("base64url");
  if (
    !body ||
    !signature ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    throw new Error("Invalid token");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  if (payload.exp < Date.now()) throw new Error("Token expired");
  return payload;
};
module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
