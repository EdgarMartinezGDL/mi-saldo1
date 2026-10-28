<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## MiSaldo structure
- Customer home and /mi-negocio share the business-scoped cliente-ficha-negocio Query key; opening status comes from the server through formato helpers. Why: context switches cannot show another business and the device never authorizes opening hours.
- Owner archived-client filters follow server flags; Clientes keeps active/include/archive-only selection in validated URL search and replaces history on changes, and report inclusion is sent only for birthdays. Why: reloads preserve selection, inactivity and reactivation stay server-authoritative, and inactive exports reject that option.
- AppShell owns role-based navigation from useAuth; MiSaldoProvider owns visual preferences and branding, persisting only theme/color. Why: roles and business data must follow the real session.
- Mobile navigation is bottom-bar only, with sign-out in Ajustes; desktop keeps sidebar sign-out. Why: duplicated menus waste space.
- api() uses relative /api/*, credentials include, memory-only access tokens and shared refresh on 401; module API files and Spanish error mapping remain centralized. Why: consistent auth/retries.
- AuthProvider syncs session role/business to MiSaldoProvider; RequiereSesion gates roles and client-side reads. Why: SSR cannot use the memory-only access token.
- useConTotp centrally handles recent-TOTP challenges and retries once. Why: one shared confirmation for critical actions.
- Value operations reuse data-derived idempotency keys until success. Why: network retries cannot charge twice.
- Public WhatsApp entries use useTokenFragmento once and strip secrets; RespuestaLogin continues through ContinuarSesion; /restablecer-pin never auto-logs in. Why: recovery links must not leak or open unintended sessions.
- CampoDigitos separates visible slots from input limit. Why: legacy PIN lengths must not alter keypad layout.
- Design-session bypass is entirely import.meta.env.DEV guarded. Why: no production authentication bypass.
- Shared neumorphic surfaces/controls use paired highlights and shadows; customization alters only primary color. Why: visual depth remains consistent.
- Caja owns the step machine with components/caja steps and useCaja().ejecutar for POS PIN interruptions and same-body retries; backend schedule flags are authoritative and polled through the shared interval. Why: one safe interruption path, never local-time authorization.
- Caja keyboard handling shares dialog-aware hooks and a common operation submit path on all devices; optional shared control props default off, and mouse detection gates only hints, compact layout and scroll-free automatic focus. Auto-focused mouse fields opt out of TecladoVisible centering, and confirmations always focus their action. Why: Bluetooth keyboards work without changing touch/SSR behavior or hiding step titles.
- /negocio sections are child routes sharing negocio-configuracion and SeccionNegocio; /ajustes is person-only with cuenta-api. Why: business and personal settings stay separate and deep-linkable.
- Mis negocios uses the contextos query; successful switches clear the entire query cache and navigate to role home. Why: previous-business data must not leak.
- Owner operation screens share operacion API and operacion-ui; downloads use apiArchivo. Why: one error/confirmation/TOTP path.
- Revealed sections use useDesplazarAlAbrir; saved forms use SeccionEditable/useModoEdicion; TecladoVisible is mounted once at root. Why: consistent mobile forms.
- Visible counts use plural(), never parenthesized suffixes; Staff date filters share fechas-staff. Why: consistent plurals and date boundaries.
- Dedicated offline storage/session modules allowlist client snapshot fields; each emitted client session verifies identity and generation-guards asynchronous writes. Why: never save another person's or a terminated session's data.
- Auth distinguishes refresh network failures from anonymous sessions; the root connection boundary owns offline views/notices. Why: disconnected reloads must not redirect to login.
- Only pwa-registro registers the server-maintained worker with dev/preview/iframe/kill-switch guards; no local worker generation. Why: server owns asset caching and previews must not retain stale shells.
- Privacy consent shares one Query cache and useConsentimiento across entry forms; AppShell mounts AvisoPendiente once and caches accepted profile state before invalidation. Why: displayed versions and acceptance cannot diverge or lose form inputs.
- Membership status uses the membresia query; online orders use pagos-membresia and pago-membresia/id, with separate simulator routes and API module. Why: approval invalidates status consistently while payment creation keys survive retries in memory.
- Staff membership pricing uses the precio-membresia query and a separately mounted dialog with one explicit confirmation factor, not useConTotp. Why: each change requires fresh proof and closing unmounts all secret state.
- Staff price submission validates FormData values and focuses the first invalid field; input/change handlers only mirror the display state. Why: autofill can change visible values without updating React state.

- Owner setup uses the shared asistente query and existing step routes with validated asistente search; every successful step mutation invalidates that query, and closure caches the server response before navigating. Why: progress can regress and must remain server-authoritative without duplicate forms.
