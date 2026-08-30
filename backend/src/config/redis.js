const { Redis } = require('@upstash/redis');

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  : null;

const checkConnection = async () => {
  if (!redis) {
    console.warn('[Redis] Not configured; using MongoDB without cache.');
    return false;
  }

  try {
    await redis.ping();
    console.log('[Redis] Connected to Upstash Redis.');
    return true;
  } catch (error) {
    console.error('[Redis] Connection failed:', error.message);
    return false;
  }
};

const get = async (key) => {
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    return value;
  } catch (error) {
    console.error('[Redis] GET failed:', key, error.message);
    return null;
  }
};

const set = async (key, value, ttlSeconds) => {
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    console.error('[Redis] SET failed:', key, error.message);
  }
};

const del = async (...keys) => {
  if (!redis || !keys.length) return;
  try {
    await redis.del(...keys);
  } catch (error) {
    console.error('[Redis] DEL failed:', keys.join(', '), error.message);
  }
};

module.exports = { get, set, del, checkConnection, enabled: Boolean(redis) };
