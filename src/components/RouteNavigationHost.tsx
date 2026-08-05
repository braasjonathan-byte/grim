import { useEffect, useState } from "react";
import RouteNavigation from "@/components/RouteNavigation";
import { getRouteNav, stopRouteNavigation, subscribeRouteNav, type RouteNavRequest } from "@/lib/routeNavigationBus";

/**
 * Global värd för navigeringsvyn. Monteras högst upp i appen så att den aldrig
 * avmonteras när underliggande vyer/dialoger renderas om vid dataladdning.
 */
const RouteNavigationHost = () => {
  const [req, setReq] = useState<RouteNavRequest | null>(getRouteNav());

  useEffect(() => subscribeRouteNav(setReq), []);

  if (!req) return null;

  return (
    <RouteNavigation
      key="global-route-navigation"
      route={req.route}
      activity={req.activity}
      name={req.name}
      alternatives={req.alternatives}
      onClose={(result) => {
        const cb = req.onClose;
        stopRouteNavigation();
        cb?.(result);
      }}
    />
  );
};

export default RouteNavigationHost;
