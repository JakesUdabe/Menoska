import { AdminClient } from "../AdminClient";

export function generateStaticParams() {
  return [
    { slug: [] as string[] },
    { slug: ["crm"] },
    { slug: ["finanzas"] },
    { slug: ["calendario"] },
    { slug: ["documentos"] },
    { slug: ["empleados"] },
    { slug: ["contenido"] },
  ];
}

export default function AdminCatchAllPage() {
  return <AdminClient />;
}
