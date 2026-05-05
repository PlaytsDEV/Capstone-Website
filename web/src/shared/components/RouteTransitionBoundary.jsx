import React from "react";
import { useLocation } from "react-router-dom";

export default function RouteTransitionBoundary({
 children,
 routeKey,
 className = "",
}) {
 const location = useLocation();
 const contentKey = routeKey || `${location.pathname}${location.search}`;

 return (
 <div
 key={contentKey}
 className={className}
 >
 {children}
 </div>
 );
}
