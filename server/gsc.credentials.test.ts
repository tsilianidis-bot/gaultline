import { describe, it, expect } from "vitest";
import { google } from "googleapis";

describe("Google OAuth credentials", () => {
  it("should instantiate OAuth2 client with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    expect(clientId, "GOOGLE_CLIENT_ID must be set").toBeTruthy();
    expect(clientSecret, "GOOGLE_CLIENT_SECRET must be set").toBeTruthy();
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, "https://getfaultline.live/app/seo-optimizer");
    expect(oauth2).toBeDefined();
    // Verify the client has the correct client_id
    const creds = oauth2._clientId;
    expect(creds).toBe(clientId);
  });
});
