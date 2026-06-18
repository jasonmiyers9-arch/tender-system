import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Allow the upload route to parse slightly oversized multipart requests so
    // it can return the app's explicit 10 MB validation error instead of a 500.
    proxyClientMaxBodySize: '25mb',
  },
  // pdfjs-dist uses a dynamic worker that can't survive webpack chunking;
  // keep it as a real node_modules import at runtime.
  serverExternalPackages: ['pdfjs-dist', 'firebase-admin', '@google-cloud/firestore', '@google-cloud/storage'],
};

export default nextConfig;
