// FAULTLINE — X Poster (server/xPoster.ts)
//
// Twitter API v2 client for posting tweets and threads.
// Credentials are injected from environment variables.
// ============================================================

import { TwitterApi } from "twitter-api-v2";
import { log } from "./logger";

// ── Client singleton ─────────────────────────────────────────

let _client: TwitterApi | null = null;

function getClient(): TwitterApi {
  if (_client) return _client;

  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    throw new Error("X API credentials not configured. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.");
  }

  _client = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken,
    accessSecret: accessTokenSecret,
  });

  return _client;
}

// ── Post a single tweet ──────────────────────────────────────

export async function postTweet(text: string): Promise<{ id: string; text: string }> {
  const client = getClient();
  const rwClient = client.readWrite;
  const result = await rwClient.v2.tweet(text);
  log.info(`[XPoster] Posted tweet: ${result.data.id}`);
  return { id: result.data.id, text: result.data.text };
}

// ── Post a thread (array of tweet texts) ────────────────────

export async function postThread(tweets: string[]): Promise<{ ids: string[] }> {
  if (tweets.length === 0) throw new Error("Thread must have at least one tweet");

  const client = getClient();
  const rwClient = client.readWrite;

  const ids: string[] = [];
  let replyToId: string | undefined;

  for (const text of tweets) {
    const payload: Parameters<typeof rwClient.v2.tweet>[0] = replyToId
      ? { text, reply: { in_reply_to_tweet_id: replyToId } }
      : { text };

    const result = await rwClient.v2.tweet(payload);
    ids.push(result.data.id);
    replyToId = result.data.id;

    // Small delay between tweets to avoid rate limiting
    if (tweets.indexOf(text) < tweets.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  log.info(`[XPoster] Posted thread: ${ids.length} tweets, first ID: ${ids[0]}`);
  return { ids };
}

// ── Parse thread text into individual tweets ─────────────────
// Splits on "1/N", "2/N" etc. pattern

export function parseThread(threadText: string): string[] {
  // Split on tweet markers like "1/5", "2/5" etc.
  const parts = threadText.split(/(?=\d+\/\d+\s)/);
  const tweets = parts
    .map(t => t.trim())
    .filter(t => t.length > 0);

  // If no markers found, try splitting on double newlines
  if (tweets.length <= 1) {
    return threadText.split(/\n\n+/).map(t => t.trim()).filter(t => t.length > 0);
  }

  return tweets;
}

// ── Validate credentials (lightweight check) ─────────────────

export async function validateXCredentials(): Promise<boolean> {
  try {
    const client = getClient();
    const me = await client.readWrite.v2.me();
    log.info(`[XPoster] Credentials valid. Account: @${me.data.username}`);
    return true;
  } catch (err) {
    log.warn(`[XPoster] Credential validation failed: ${err}`);
    return false;
  }
}
