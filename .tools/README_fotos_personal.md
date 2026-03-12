# Flujo masivo de fotos (Excel -> Supabase Storage -> foto_url)

Este flujo sirve para cuando tienes mas de 400 filas con imagen embebida en Excel.

## Archivos incluidos

- `.tools/extract_personal_photos_from_excel.py`
- `.tools/upload_personal_photos_to_supabase.ps1`
- `supabase/sql/setup_personal_fotos_storage.sql`

## 1) Preparar SQL en Supabase

Ejecuta primero:

- `supabase/sql/setup_personal_fotos_storage.sql`

Esto crea:

- Columna `foto_url` en `public.personal`
- Bucket `personal-fotos`
- RPC `sync_personal_foto_url_from_storage(...)`

## 2) Extraer y renombrar fotos desde Excel

Requisitos:

- Python 3.10+
- Paquete `openpyxl`

Instalacion:

```bash
pip install openpyxl
```

Ejecucion (segun tu layout de captura: fotos en H, cod en I):

```bash
python .tools/extract_personal_photos_from_excel.py --xlsx "C:/ruta/personal.xlsx" --sheet "Hoja1" --photo-col H --code-col I --out-dir "C:/ruta/personal_fotos_output"
```

Salida:

- Carpeta con archivos renombrados: `AUX_001.jpg`, `LEC_002.png`, etc.
- Manifest: `manifest_personal_fotos.csv`

## 3) Subir todo el folder a Storage

En PowerShell:

```powershell
$PROJECT_URL = "https://txeuzsypnwesscganktp.supabase.co"
$SERVICE_ROLE = "<TU_SERVICE_ROLE_KEY>"
$FOLDER = "C:/ruta/personal_fotos_output"

powershell -ExecutionPolicy Bypass -File .tools/upload_personal_photos_to_supabase.ps1 `
  -ProjectUrl $PROJECT_URL `
  -ServiceRoleKey $SERVICE_ROLE `
  -FolderPath $FOLDER `
  -Bucket "cold" `
  -Prefix "fotos_personal"
```

## 4) Sincronizar foto_url por id_codigo

Opcion A (desde tablero):

- Ir a vista Personal
- Click en `Sincronizar Fotos`

Opcion B (SQL):

```sql
select *
from public.sync_personal_foto_url_from_storage(
  'https://txeuzsypnwesscganktp.supabase.co',
  'cold',
  'fotos_personal'
);
```

## 5) Verificacion

```sql
select id_codigo, foto_url
from public.personal
order by id_codigo;
```

## Notas

- Si hay varias fotos para el mismo codigo, se toma la mas reciente.
- Si algun codigo no existe en `personal`, esa foto no se relaciona.
- No compartas `service_role` en frontend ni repositorio.
