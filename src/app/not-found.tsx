"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale";

export default function NotFound() {
  const { copy } = useLocale();
  return (
    <section className="page-hero">
      <div className="wrap narrow">
        <h1>{copy.notFound.title}</h1>
        <p className="lead">{copy.notFound.lead}</p>
        <Link className="btn" href="/">
          {copy.notFound.back}
        </Link>
      </div>
    </section>
  );
}
