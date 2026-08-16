/** @type {import('next').NextConfig} */
export default {
  output: "standalone",

  // In the cluster the ingress matches /api first and this never fires. Under
  // Compose there is no ingress, so Next proxies /api to the backend itself,
  // which keeps the browser calling the same /api path in both environments.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_ORIGIN ?? "http://backend:8000"}/api/:path*`,
      },
    ];
  },
};
