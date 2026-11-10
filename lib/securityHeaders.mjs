/**
 * Security headers for every CMS response.
 *
 * The CMS has no third-party scripts at all, so its policy is far tighter than
 * the storefront's: it talks to the Zewa API and to Cloudinary (direct signed
 * uploads), and nothing else.
 *
 * Scripts keep 'unsafe-inline' for Next.js's inline bootstrap scripts; see the
 * storefront's lib/securityHeaders.mjs for why a nonce is not used.
 *
 * The email-preview iframes use `srcDoc` with an empty `sandbox`, so they run
 * in an opaque origin under this same policy. No frame-src entry is needed.
 */
const isDev = process.env.NODE_ENV !== "production";

const csp = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
  "style-src": ["'self'", "'unsafe-inline'"],
  "font-src": ["'self'", "data:"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "media-src": ["'self'", "blob:", "https://res.cloudinary.com"],
  "connect-src": [
    "'self'",
    "https://api.zewafeeds.com",
    "https://*.onrender.com",
    "https://api.cloudinary.com",
    ...(isDev ? ["http://localhost:4000", "ws://localhost:3001"] : []),
  ],
  "frame-src": ["'self'"],
  "form-action": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
};

export const contentSecurityPolicy = Object.entries(csp)
  .map(([k, v]) => [k, ...v].join(" "))
  .join("; ");

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
