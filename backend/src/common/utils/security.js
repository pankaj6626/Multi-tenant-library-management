import crypto from 'crypto';
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
const signToken = (payload, expiresInMs, type) => {
  const body = base64url(
    JSON.stringify({ ...payload, type, exp: Date.now() + expiresInMs }),
  );
  return `${body}.${crypto.createHmac("sha256", process.env.JWT_SECRET).update(body).digest("base64url")}`;
};
const verifyToken = (token, expectedType) => {
  const [body, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(body)
    .digest("base64url");
  if (
    !body ||
    !signature ||
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    throw new Error("Invalid token");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  if (payload.exp < Date.now()) throw new Error("Token expired");
  if (expectedType && payload.type !== expectedType) throw new Error("Invalid token type");
  return payload;
};
export { hashPassword, verifyPassword, signToken, verifyToken };
