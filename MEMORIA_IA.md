# MEMORIA Y REGLAS ESTRICTAS DE LA IA — SUBASTANDOLO

> ⚠️ **INSTRUCCIÓN OBLIGATORIA PARA LA IA:**
> Antes de tocar cualquier archivo del proyecto, LEE ESTE DOCUMENTO COMPLETO.
> Si rompes algo listado aquí, estás dañando código ya reparado con esfuerzo real.
> Estas reglas son el resultado directo de horas de debugging y quejas de usuarios reales.

---

## 🚀 SECCIÓN 0: INFRAESTRUCTURA Y FLUJO DE DEPLOY — LEE ESTO PRIMERO

### ¿Dónde vive el código?
- **Repositorio:** `https://github.com/MAUROMAICAN/Subastandolo-Plataforma.git`
- **Rama principal:** `main`
- **Directorio local:** `c:\Users\unifo\Desktop\Subastandolo-Plataforma\`

### ¿Cómo llegan los cambios a la web?
```
Editar archivos locales
        ↓
git add <archivos>
        ↓
git commit -m "descripción"
        ↓
git push
        ↓
Vercel detecta el push y hace build automático (~1-2 min)
        ↓
subastandolo.com actualizada ✅
```

### 🚨 REGLA CRÍTICA DE DEPLOY:
- ❌ **NUNCA** editar archivos locales y asumir que la web se actualiza sola.
- ❌ **NUNCA** terminar una sesión de trabajo sin hacer `git push` de los cambios realizados.
- ✅ **SIEMPRE** hacer `git add` + `git commit` + `git push` después de cada fix.
- ✅ En PowerShell (Windows), usar comandos **separados** — el operador `&&` NO funciona en PowerShell.
- ✅ Después del push, esperar ~2 minutos y pedir al usuario que recargue la web.

### Comandos correctos en PowerShell:
```powershell
# 1. Agregar cambios
git add src/pages/Admin.tsx src/components/admin/AdminWonAuctionsTab.tsx

# 2. Commit
git commit -m "fix: descripción del cambio"

# 3. Push → activa el deploy en Vercel
git push
```

### ¿Qué hace Vercel automáticamente?
- Detecta el push a `main`
- Corre `npm run build` (Vite)
- Despliega los archivos estáticos a `subastandolo.com`
- Las Edge Functions de Supabase se despliegan aparte con `supabase functions deploy`

### Edge Functions de Supabase (deploy separado):
```powershell
# Deploy de una función específica:
supabase functions deploy notify-auction-won

# Deploy de todas:
supabase functions deploy
```

---

## 🚨 SECCIÓN 1: BUGS CRÍTICOS — NUNCA REINTRODUCIR

### ❌ BUG 1 — Crash al marcar producto "En Abandono" (Panel Admin)

**Síntoma:** Al hacer clic en "Marcar como Abandonada" en el panel de Subastas Ganadas, el sistema expulsaba al administrador del panel o causaba pantalla blanca.

**Causa Raíz:** `AdminWonAuctionsTab.tsx` llamaba a `queryClient.invalidateQueries()` después de la mutación. El componente padre `Admin.tsx` NO usa React Query; maneja su estado con `useState` + `fetchAllData()`. La invalidación global detonaba re-renders imprevistos que destruían el contexto de autenticación cacheada, causando el crash.

**Solución Aplicada:** Se eliminó `queryClient.invalidateQueries()` de `AdminWonAuctionsTab.tsx` y se reemplazó por la prop `fetchAllData()` inyectada desde `Admin.tsx`.

**REGLA DE ORO:**
- ❌ NUNCA uses `queryClient.invalidateQueries()` dentro de `Admin*.tsx` para refrescar listas del panel principal.
- ✅ Siempre inyecta y llama la prop `fetchAllData()` que viene de `Admin.tsx`.
- ✅ Todo componente hijo del panel admin que necesite refrescar datos DEBE pedir `fetchAllData: () => void` como prop.

---

### ❌ BUG 2 — Pagos que no se pueden cargar (Comprobante + Referencia)

**Síntoma:** Los usuarios subían la imagen del comprobante, ingresaban un número de referencia y "nada pasaba", o el sistema daba un error genérico. El archivo se perdía.

**Causa Raíz:** La tabla `payment_proofs` tiene restricciones SQL estrictas (CHECK CONSTRAINTS):
- `length(trim(reference_number)) >= 4 AND length(trim(reference_number)) <= 50`
- `bcv_rate > 0 AND bcv_rate <= 1000`
- `amount_usd > 0`
- `amount_bs > 0`

El frontend mostraba el Número de Referencia como "(Opcional)" y permitía enviar formularios aunque la tasa BCV hubiera fallado (quedaba en `0`). La BD rechazaba el INSERT con error, pero el archivo ya se había subido a Storage, causando archivos huérfanos y confusión en el usuario.

**Solución Aplicada:** Se agregaron validaciones ANTES del upload en `handleSubmit` de `PaymentFlow.tsx`:
1. Si `reference.trim().length < 4` → mostrar error y abortar.
2. Si `bcvRate <= 0` → mostrar error y abortar.
3. Botón de envío desactivado hasta que ambas condiciones se cumplan.
4. Label cambiado de "(Opcional)" a "* Obligatorio (mín. 4 dígitos)".

**REGLA DE ORO:**
- ❌ NUNCA marques el número de referencia de pago como "Opcional".
- ❌ NUNCA permitas que el formulario proceda si `bcvRate` es `0` o `null`.
- ✅ Siempre valida AMBAS condiciones ANTES de hacer el `storage.upload()`, para evitar archivos huérfanos.
- ✅ El error debe mostrarse con `toast()` claro y la acción debe cancelarse con `return`, no continuar silenciosamente.

---

### ❌ BUG 3 — Subastas "Fantasmas" (Aparecen de la Nada en Panel de Ganadas)

**Síntoma:** Aparecen en "Subastas Ganadas" subastas con datos incompletos (ganador "—", precios incorrectos). Se pueden ver incluso "A —" en el campo del buyer.

**Causa Raíz REAL (2 problemas combinados):**

**Problema A** — El filtro `wonAuctions` en `AdminWonAuctionsTab.tsx` incluía subastas con `status=active` pero `end_time` vencido:
```typescript
// ❌ ANTES (INCORRECTO) — causa subastas fantasmas:
auctions.filter(a =>
  !!a.winner_id &&
  (a.status === "finalized" || (a.status === "active" && end_time expirado))
)
```
Estas subastas activas-pero-expiradas tenían datos incompletos porque nunca se finalizaron correctamente.

**Problema B** — El auto-repair en `Admin.tsx` solo cubría subastas ya `finalized`, ignorando las `active` con `end_time` vencido. Esas subastas nunca se cerraban.

**Solución Aplicada (2026-03-22):**
```typescript
// ✅ AHORA (CORRECTO) — solo muestra finalized confirmadas:
auctions.filter(a => !!a.winner_id && a.status === "finalized")
```
Y en `Admin.tsx` se agregó **Auto-repair Phase 2** que detecta y cierra todas las subastas `status=active` con `end_time <= Date.now()`, asignando el ganador correcto y cambiando a `finalized`.

**REGLAS DE ORO:**
- ❌ NUNCA incluyas `status=active && end_time expirado` en el filtro del panel de ganadas. Esas subastas son "fantasmas" con datos incompletos.
- ❌ NUNCA incluyas subastas sin `winner_id` en el panel "Ganadas".
- ✅ `wonAuctions` SIEMPRE debe ser: `!!a.winner_id && a.status === "finalized"`.
- ✅ El auto-repair en `Admin.tsx` debe incluir Phase 2 para cerrar subastas `active` expiradas.
- ✅ El ganador real se obtiene de `bids.user_id` (no `bids.bidder_id`).


---

### ❌ BUG 4 — Tasa BCV que se revierte o se pierde

**Síntoma:** La tasa del BCV se resetea a un valor antiguo o incorrecto en el panel de nómina u otros formularios.

**Causa Raíz:** El BCV (Banco Central de Venezuela) publica la tasa solo en días hábiles. No existía un cron automático, así que la tasa quedaba desactualizada el fin de semana y el lunes.

**Solución Aplicada (2026-03-22):**
- Creado `api/update-bcv-rate.js` → Vercel Cron handler
- Cron en `vercel.json`: `"schedule": "0 13 * * 1-5"` → lunes-viernes 9:00 AM VET (13:00 UTC)
- Cron en `vercel.json`: `"schedule": "0 23 * * 1-5"` → lunes-viernes 7:00 PM VET (23:00 UTC)
- La Edge Function `auto-update-bcv-rate` tiene 5 fuentes de respaldo:
  1. `bcv.org.ve` — scraping directo HTML (fuente primaria, sin lag)
  2. `monitordedivisavenezuela.com`
  3. `pydolarve.org`
  4. `ve.dolarapi.com` (puede tener lag de 1-2 días, ÚLTIMO RECURSO)
  5. `open.er-api.com` (global fallback)

**REGLAS DE ORO:**
- ✅ La tasa BCV tiene una fuente de verdad única: la tabla `site_settings` (`setting_key = "bcv_rate"`).
- ✅ **El BCV publica la tasa TODOS los días hábiles (L-V) a las ~6:00 PM Venezuela.**
- ✅ **El viernes a las ~6PM publica la tasa del LUNES siguiente.** Esta tasa rige desde el viernes tarde, todo el sábado, todo el domingo, y todo el lunes hasta las ~6PM que publican la nueva.
- ✅ El cron corre a las 7PM VET (23:00 UTC) para dar tiempo a que la publicación esté disponible.
- ✅ El admin puede forzar la actualización en cualquier momento con el botón "Actualizar BCV" en Admin → Configuración.
- ❌ NUNCA uses `ve.dolarapi.com` como fuente principal — tiene lag de 1-2 días.
- ❌ NUNCA reescribas la tasa en la BD si no es el admin o el cron oficial.

---

### ❌ BUG 5 — Rate Limit oculto en carga de Comprobantes

**Síntoma:** Un usuario intenta subir un comprobante por 3ra vez en menos de 1 hora y el sistema lo rechaza con un error genérico que no explica por qué.

**Causa Raíz:** La BD tiene un trigger `check_payment_proof_rate_limit()` que bloquea más de 3 inserciones en `payment_proofs` en una hora por el mismo `buyer_id`. El error del trigger se propaga como excepción de PostgreSQL pero el frontend no lo capturaba con mensaje claro.

**REGLA DE ORO:**
- ✅ Siempre captura el error del INSERT con `try/catch` e inspecciona `error.message`. Si contiene "Demasiados comprobantes", mostrar al usuario: *"Has alcanzado el límite de 3 intentos por hora. Por favor espera antes de intentar nuevamente."*
- ❌ NUNCA muestres el error crudo de PostgreSQL al usuario. Tradúcelo siempre a lenguaje humano.

---

## 📐 SECCIÓN 2: ARQUITECTURA Y PATRONES

### 2.1 Estado del Panel Admin
- `Admin.tsx` usa **useState + fetchAllData()**, NO React Query, para su estado principal.
- Los componentes hijos (`AdminWonAuctionsTab`, `AdminPaymentsTab`, etc.) reciben datos como props y deben llamar `fetchAllData()` para refrescar.
- React Query solo se usa en páginas públicas o hooks de usuario (no admin).

### 2.2 Subida de Archivos a Supabase Storage
- Siempre validar en cliente ANTES de llamar `.upload()`.
- Si el upload falla, NO insertar en la BD.
- Si el INSERT en BD falla después del upload, registrar el error pero NO dejar al usuario sin feedback.
- Buckets: `payment-proofs`, `auction-images`, `dispute-evidence`, `dealer-documents`, `ticket-attachments`.

### 2.3 Edge Functions (Notificaciones)
- Las invocaciones a Edge Functions de notificación son **fire-and-forget**: siempre envolverlas sin `await` o con `.catch(() => {})` para que un fallo de notificación nunca bloquee la operación principal.
- ✅ Correcto: `supabase.functions.invoke("notify-xxx", {...}).catch(() => {})`
- ❌ Incorrecto: `await supabase.functions.invoke("notify-xxx", {...})` sin catch que pueda interrumpir el flujo.

### 2.4 Filosofía de Modificación de Código
1. **Si algo funciona, NO lo refactorices** a menos que el usuario lo pida explícitamente.
2. **Si vas a arreglar un componente, toca SOLO ese componente.** No limpies archivos enteros. Eso causa regresiones.
3. **Siempre lee MEMORIA_IA.md antes de empezar** cualquier sesión de trabajo.

---

## 🔄 SECCIÓN 3: PROCEDIMIENTO AL INICIAR SESIÓN

Cada vez que el usuario inicie una nueva sesión de trabajo, la IA DEBE:
1. Leer este archivo `MEMORIA_IA.md` completo.
2. Revisar también el `task.md` de la sesión anterior si existe.
3. No asumir que el código está correcto — verificar primero.
4. Antes de cambiar cualquier archivo relacionado con pagos, estado de subastas o el panel admin, consultar las reglas de esta memoria.

---

## 📋 SECCIÓN 4: HISTORIAL DE FIXES POR FECHA

| Fecha | Bug | Archivos Modificados | Estado |
|-------|-----|----------------------|--------|
| 2026-03-22 | Crash al marcar "En Abandono" (`queryClient` vs `fetchAllData`) | `AdminWonAuctionsTab.tsx`, `Admin.tsx` | ✅ Resuelto |
| 2026-03-22 | Pagos que no cargan (referencia + tasa BCV) | `PaymentFlow.tsx` | ✅ Resuelto |
| 2026-03-22 | Subasta fantasma sin ganador en panel de Ganadas | `AdminWonAuctionsTab.tsx` (filtro `wonAuctions`) | ✅ Resuelto |
| 2026-03-22 | Auto-repair usaba `bidder_id` inexistente en `bids` | `Admin.tsx` (auto-repair `bids.user_id`) | ✅ Resuelto |
| 2026-03-22 | `support_tickets` sin cast en Admin.tsx | `Admin.tsx` | ✅ Resuelto |
| 2026-03-22 | Variable `total` usada antes de declarar en notificación dealer | `CheckoutTienda.tsx` | ✅ Resuelto |
| 2026-03-22 | Referencia de pago sin validación mínima en tienda | `CheckoutTienda.tsx` | ✅ Resuelto |
| 2026-03-22 | `seller_id` inexistente en `marketplace_products` (correcto: `dealer_id`) | `CheckoutTienda.tsx` | ✅ Resuelto |

### ✅ Componentes Auditados y Limpios (sin bugs críticos)
- `MiCompra.tsx` — flujo de compra del ganador
- `AdminPaymentsTab.tsx` — aprobación de comprobantes
- `useBCVRate.ts` — tasa BCV con prioridad de tasa manual correcta
- `LaunchCountdown.tsx` — contador de inauguración
- Componentes live (`LiveBidPanel`, `LiveProductControls`, `DealerLivePanel`) — usan `bidder_id` de `live_bids` (tabla diferente a `bids`, correcto)
- Panel dealer — no usa `queryClient` ni `invalidateQueries`
- Edge Functions de notificaciones — todas con `.catch()` o try/catch

### ⚠️ REGLA CRÍTICA — Auth Guards en Edge Functions
- ❌ NUNCA dejes una Edge Function que modifique datos sin un auth guard.
- ✅ Las funciones que mutan estado crítico (liberar fondos, finalizar subastas, enviar emails masivos) DEBEN tener `if (!await isServiceRoleOrAdmin(req)) return unauthorized(corsHeaders);`
- ✅ Funciones de solo lectura pueden omitir el guard si los datos no son sensibles.

| Fecha | Bug | Archivos | Estado |
|-------|-----|----------|--------|
| 2026-03-22 | `auto-release-funds` sin auth guard | `auto-release-funds/index.ts` | ✅ Resuelto |
| 2026-03-22 | `archive-finalized-auctions` sin auth guard + `bidder_id` incorrecto | `archive-finalized-auctions/index.ts` | ✅ Resuelto |
| 2026-03-22 | `CheckoutTienda.tsx` usaba `dealer_id` cuando BD tiene `seller_id` | `CheckoutTienda.tsx` | ✅ Resuelto (fallback a ambos) |

