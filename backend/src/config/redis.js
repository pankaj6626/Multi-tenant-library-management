import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

dotenv.config();

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

const getStrict = async (key) => {
  if (!redis) throw new Error('Redis is required for this operation');
  return redis.get(key);
};

const setStrict = async (key, value, ttlSeconds, onlyIfMissing = false) => {
  if (!redis) throw new Error('Redis is required for this operation');
  return redis.set(key, value, {
    ex: ttlSeconds,
    ...(onlyIfMissing ? { nx: true } : {}),
  });
};

const delStrict = async (...keys) => {
  if (!redis) throw new Error('Redis is required for this operation');
  if (keys.length) return redis.del(...keys);
};

const incrementStrict = async (key, ttlSeconds) => {
  if (!redis) throw new Error('Redis is required for this operation');
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, ttlSeconds);
  return count;
};

export default {
  get,
  set,
  del,
  getStrict,
  setStrict,
  delStrict,
  incrementStrict,
  checkConnection,
  enabled: Boolean(redis),
};
