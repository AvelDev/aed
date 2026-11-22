import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Pomijamy API, pliki wewnętrzne Next.js i pliki z kropką (ikony, sw.js, dane).
  matcher: "/((?!api|_next|_vercel|data|fonts|.*\..*).*)",
};
