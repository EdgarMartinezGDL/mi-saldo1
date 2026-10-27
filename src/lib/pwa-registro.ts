export function permiteWorker(prod: boolean, hostname: string, enMarco: boolean, apagar: boolean) {
  return prod && !enMarco && !apagar && !hostname.startsWith("id-preview--") && !hostname.startsWith("preview--") &&
    !/(^|\.)lovable(project)?\.(app|com)$/.test(hostname) && !/(^|\.)lovableproject-dev\.com$/.test(hostname) &&
    !/(^|\.)(lovableproject-dev\.com|beta\.lovable\.dev)$/.test(hostname);
}

/** Register only the worker maintained by the application's server; never generate a cache here. */
export function registrarWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!permiteWorker(import.meta.env.PROD, location.hostname, window.self !== window.top, new URLSearchParams(location.search).get("sw") === "off")) {
    void navigator.serviceWorker.getRegistrations().then((rs) => Promise.allSettled(rs.filter((r) =>
      [r.active, r.waiting, r.installing].some((w) => w && new URL(w.scriptURL).pathname === "/sw.js")
    ).map((r) => r.unregister()))).catch(() => undefined);
    return;
  }
  const registrar = () => { void navigator.serviceWorker.register("/sw.js").catch(() => undefined); };
  if (document.readyState === "complete") registrar();
  else window.addEventListener("load", registrar, { once: true });
  return () => window.removeEventListener("load", registrar);
}