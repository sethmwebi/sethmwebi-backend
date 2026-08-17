import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleIdToken(idToken: string) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new Error("Invalid Google ID token");
  }

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name ?? null,
    image: payload.picture ?? null,
    emailVerified: payload.email_verified ?? false,
  };
}
