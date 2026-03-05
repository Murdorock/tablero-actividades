# 📊 Sistema de Gestión - Tablero Supabase

Dashboard HTML completo para gestionar las 19 tablas de tu base de datos Supabase. Sistema modular con cada tabla en su propio archivo HTML para fácil mantenimiento.

## 🚀 Características

- ✅ **19 Tablas Completas**: Cada tabla con su interfaz dedicada
- ✅ **Navegación Intuitiva**: Menú lateral con todas las tablas
- ✅ **CRUD Completo**: Crear, Leer, Actualizar y Eliminar registros
- ✅ **Diseño Responsive**: Funciona en desktop, tablet y móvil
- ✅ **Carga Dinámica**: Los formularios se adaptan automáticamente a cada tabla
- ✅ **Arquitectura Modular**: Lógica compartida para fácil mantenimiento
- ✅ **Configuración Lista**: Credenciales de Supabase ya configuradas

## 📁 Estructura del Proyecto

```
tablero_supabase/
├── index.html              # Página principal con menú de navegación
├── welcome.html            # Página de bienvenida
├── config.js               # Configuración de Supabase (credenciales configuradas)
├── styles.css              # Estilos globales
├── table-logic.js          # Lógica JavaScript compartida
│
├── aproximados.html        # Tabla: aproximados
├── base.html               # Tabla: base
├── cmlec.html              # Tabla: cmlec
├── control_descargas.html  # Tabla: control_descargas
├── controles_reparto.html  # Tabla: controles_reparto
├── coordenadas.html        # Tabla: coordenadas
├── hist_lectura.html       # Tabla: hist_lectura
├── historicos.html         # Tabla: históricos
├── inconsistencias.html    # Tabla: inconsistencias
├── llegadas_tarde.html     # Tabla: llegadas_tarde
├── perfiles.html           # Tabla: perfiles
├── personal.html           # Tabla: personal
├── programacion_lectura.html    # Tabla: programacion_lectura
├── rangos.html             # Tabla: rangos
├── rangos_reparto.html     # Tabla: rangos_reparto
├── refutar_errores.html    # Tabla: refutar_errores
├── resumen_descargas.html  # Tabla: resumen_descargas
├── secuencia_lectura.html  # Tabla: secuencia_lectura
└── secuencia_sin_lectura.html   # Tabla: secuencia_sin_lectura
```

## 🎯 Tablas Incluidas

1. **📍 Aproximados** - `aproximados.html`
2. **🗄️ Base** - `base.html`
3. **📊 CMLEC** - `cmlec.html`
4. **⬇️ Control Descargas** - `control_descargas.html`
5. **🚚 Controles Reparto** - `controles_reparto.html`
6. **🗺️ Coordenadas** - `coordenadas.html`
7. **📖 Historial Lectura** - `hist_lectura.html`
8. **📜 Históricos** - `historicos.html`
9. **⚠️ Inconsistencias** - `inconsistencias.html`
10. **⏰ Llegadas Tarde** - `llegadas_tarde.html`
11. **👤 Perfiles** - `perfiles.html`
12. **👥 Personal** - `personal.html`
13. **📅 Programación Lectura** - `programacion_lectura.html`
14. **📏 Rangos** - `rangos.html`
15. **📦 Rangos Reparto** - `rangos_reparto.html`
16. **🔄 Refutar Errores** - `refutar_errores.html`
17. **📋 Resumen Descargas** - `resumen_descargas.html`
18. **🔢 Secuencia Lectura** - `secuencia_lectura.html`
19. **❌ Secuencia Sin Lectura** - `secuencia_sin_lectura.html`

## 🖥️ Uso

### Abrir el Sistema

1. Abre el archivo `index.html` en tu navegador
2. El menú lateral mostrará las 19 tablas disponibles
3. Haz clic en cualquier tabla para ver sus datos

### Operaciones Disponibles

Cada tabla permite:
- **➕ Crear** nuevos registros
- **✏️ Editar** registros existentes
- **🗑️ Eliminar** registros
- **🔄 Actualizar** la vista de datos

## ⚙️ Configuración (Ya Lista)

Tu configuración de Supabase ya está lista en `config.js`:

```javascript
const SUPABASE_CONFIG = {
    url: 'https://txeuzsypnwesscganktp.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

## 🔒 Configuración de Seguridad en Supabase

Para que el sistema funcione correctamente, asegúrate de que las políticas de Row Level Security (RLS) estén configuradas:

### Opción 1: Desarrollo (Acceso Total)

```sql
-- Para cada tabla, ejecuta:
ALTER TABLE nombre_tabla ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for anon" ON nombre_tabla
    FOR ALL USING (true) WITH CHECK (true);
```

### Opción 2: Producción (Recomendado)

Configura políticas más restrictivas basadas en autenticación de usuarios.

## 🎨 Personalización

### Modificar Estilos

Edita `styles.css` para cambiar:
- Colores del tema
- Tamaños de fuente
- Diseño de tablas
- Comportamiento responsive

### Agregar Nueva Tabla

1. Copia cualquier archivo de tabla existente (ej: `base.html`)
2. Renómbralo con el nombre de tu nueva tabla
3. Cambia la constante `TABLE_NAME` al nombre de tu tabla en Supabase
4. Agrega el enlace en el menú de `index.html`

### Modificar Lógica Compartida

El archivo `table-logic.js` contiene toda la lógica CRUD compartida. Cualquier cambio aquí afectará a todas las tablas.

## 🔧 Arquitectura Técnica

### Diseño Modular

- **Separación de responsabilidades**: Cada tabla en su propio archivo HTML
- **Lógica compartida**: `table-logic.js` evita duplicación de código
- **Configuración centralizada**: `config.js` gestiona las credenciales
- **Estilos globales**: `styles.css` mantiene consistencia visual

### Funcionamiento Automático

El sistema:
1. Detecta automáticamente las columnas de cada tabla
2. Genera formularios dinámicos
3. Formatea datos según el tipo de columna
4. Maneja errores de conexión

## 📝 Solución de Problemas

### Error: "Error al cargar datos"

**Causa**: La tabla no existe en Supabase o las políticas RLS bloquean el acceso

**Solución**:
1. Verifica que la tabla existe en Supabase
2. Revisa las políticas RLS
3. Comprueba que el nombre de la tabla coincida exactamente

### No se muestran datos

**Causa**: Políticas de seguridad restrictivas

**Solución**:
```sql
-- Verifica las políticas de la tabla
SELECT * FROM pg_policies WHERE tablename = 'nombre_tabla';
```

### Error en formularios

**Causa**: Tipos de datos incompatibles

**Solución**: La lógica automática maneja la mayoría de tipos. Para casos especiales, modifica `table-logic.js`

## 🌐 Navegadores Compatibles

- ✅ Google Chrome (Recomendado)
- ✅ Microsoft Edge
- ✅ Firefox
- ✅ Safari
- ⚠️ IE11 (No soportado)

## 📊 Límites y Consideraciones

- Cada tabla carga hasta **500 registros** por defecto
- Para más registros, modifica el `.limit(500)` en `table-logic.js`
- Tablas muy anchas pueden requerir scroll horizontal
- Los formularios detectan automáticamente los tipos de datos

## 🚀 Próximos Pasos

1. **Abre `index.html`** en tu navegador
2. **Explora las tablas** haciendo clic en el menú lateral
3. **Prueba las operaciones CRUD** en cada tabla
4. **Personaliza según necesites** los estilos y funcionalidades

## 🔐 Gestión de Usuarios (Authentication) segura

El módulo `gestion_usuarios.html` usa la Edge Function `gestion-usuarios-admin` para **listar** y **crear** usuarios de Authentication sin exponer la `service_role` en frontend.

### 1) Requisitos

- Tener Supabase CLI instalado y autenticado.
- Usuario logueado en el tablero con rol `ADMINISTRADOR` en la tabla `perfiles`.

### 2) Variables de entorno

En Supabase Cloud, las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` ya vienen administradas por la plataforma para Edge Functions.

No necesitas crearlas manualmente con `supabase secrets set`.

### 3) Desplegar función

```bash
supabase functions deploy gestion-usuarios-admin
```

Archivo de función:

- `supabase/functions/gestion-usuarios-admin/index.ts`

### 4) Qué valida la función

- JWT del usuario que invoca
- Rol `ADMINISTRADOR` en `perfiles`
- Acción solicitada (`list_users` / `create_user`)

Si no pasa validación, responde `401/403`.

## ⚡ Sincronización rápida de fecha_ejecucion

La vista `ordenes_generadas.html` ahora intenta usar la Edge Function `sync-fecha-ejecucion-ordenes` para recalcular `fecha_ejecucion` en servidor (mucho más rapido que fila por fila en navegador).

### Desplegar función

```bash
supabase functions deploy sync-fecha-ejecucion-ordenes
```

Archivo de función:

- `supabase/functions/sync-fecha-ejecucion-ordenes/index.ts`

### Seguridad

- Valida JWT del usuario que invoca.
- Exige rol `ADMINISTRADOR` en `perfiles`.
- Restringe tablas permitidas:
    - Ordenes: `ordenes_generadas`, `ordenes_lectura`
    - Calendario: `calendario_ciclo_unpivoted`, `calendario_ciclos_unpivoted`

Si la función no está desplegada o falla por conectividad, el frontend cae automaticamente al flujo local anterior.

## 📚 Recursos

- [Documentación de Supabase](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## 💡 Consejos

- Usa Chrome DevTools (F12) para debuggear
- Revisa la consola si hay errores
- Las credenciales están en `config.js` si necesitas cambiarlas
- Cada tabla es independiente - puedes modificarlas sin afectar otras

---

**✨ ¡Sistema listo para usar!**

Simplemente abre `index.html` y comienza a gestionar tus 19 tablas de Supabase.
