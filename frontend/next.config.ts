import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // pdfjs-dist uses a dynamic worker that can't survive webpack chunking;
  // keep it as a real node_modules import at runtime.
  serverExternalPackages: ['pdfjs-dist', 'firebase-admin', '@google-cloud/firestore', '@google-cloud/storage'],
};

export default nextConfig;
