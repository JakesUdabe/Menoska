import { Suspense } from "react";
import { ConfirmClient } from "./confirm-client";

export default function ConfirmPage() {
  return (
    <Suspense fallback={<p className="wrap">Confirmando acceso…</p>}>
      <ConfirmClient />
    </Suspense>
  );
}
