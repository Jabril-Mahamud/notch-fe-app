import Link from "next/link";

export default function Landing() {
  return (
    <>
      <h1>Notch</h1>
      <p>
        A public feature request board. Anyone can read what has been asked for;
        signed-in users post requests and vote on them. Highest voted first.
      </p>
      <p>
        Notch is also the first real tenant of a platform, and exists to prove that
        platform works end to end.
      </p>

      <h2>How the platform works</h2>
      <ul>
        <li>
          <strong>eksctl</strong> creates the EKS cluster and the IAM roles bound to
          service accounts via OIDC. No long-lived AWS keys anywhere.
        </li>
        <li>
          <strong>ArgoCD</strong> owns everything after that. One root Application
          points at the GitOps repo; sync waves order the addons so Crossplane and its
          providers are healthy before anything asks them for infrastructure.
        </li>
        <li>
          <strong>Crossplane</strong> reconciles cloud and database resources from
          manifests: the ECR repositories the images live in, and the Postgres
          database, role and grants this app uses.
        </li>
        <li>
          <strong>CloudNativePG</strong> runs Postgres in-cluster on EBS volumes.
          Notch is handed its own database and an owning role, so it runs its own
          Alembic migrations on startup.
        </li>
        <li>
          <strong>External Secrets</strong> pulls application config from AWS Secrets
          Manager under <code>notch/&lt;env&gt;/apps/&lt;service&gt;/</code>. Stakater
          Reloader restarts pods when a secret rotates.
        </li>
        <li>
          <strong>ingress-nginx</strong> fronts both containers: <code>/api</code>
          reaches the FastAPI backend, everything else reaches this Next.js frontend.
        </li>
      </ul>

      <h2>Adding a service</h2>
      <p>
        A service is a values file, not a chart. Drop{" "}
        <code>services/&lt;name&gt;/service.yaml</code> into the GitOps repo and an
        ApplicationSet layers it over the shared <code>notch-app</code> chart with the
        environment defaults. Same chart, same probes, same secret wiring.
      </p>

      <p>
        <Link href="/features">See what people have asked for</Link>
      </p>
    </>
  );
}
