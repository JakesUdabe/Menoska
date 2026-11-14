import Link from "next/link";
import { es } from "@/i18n/es";

export default function NotFound() {
  return (
    <section className="page-hero">
      <div className="wrap narrow">
        <h1>{es.notFound.title}</h1>
        <p className="lead">{es.notFound.lead}</p>
        <Link className="btn" href="/">
          {es.notFound.back}
        </Link>
      </div>
    </section>
  );
}
