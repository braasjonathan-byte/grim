import { Suspense, type ComponentProps } from "react";
import { lazyRetry } from "@/lib/lazyRetry";

// Kartbiblioteket (Leaflet) laddas först när en karta faktiskt visas.
const RouteMapImpl = lazyRetry(() => import("./RouteMapImpl"));

type Props = ComponentProps<typeof RouteMapImpl>;

const RouteMap = (props: Props) => (
  <Suspense fallback={<div className="w-full rounded-lg bg-muted animate-pulse" style={{ height: props.height ?? 200 }} aria-label="Laddar karta" />}>
    <RouteMapImpl {...props} />
  </Suspense>
);

export default RouteMap;
