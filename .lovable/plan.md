
# Formulario de Verificacion KYV para Dealers

## Resumen

Transformar el formulario simple de solicitud de dealer en un formulario completo de verificacion (Know Your Vendor) con multiples secciones: datos personales, documentos de identidad, comprobante de domicilio, redes sociales y aceptacion de terminos.

## Cambios en Base de Datos

Se necesitan nuevas columnas en la tabla `dealer_applications` para almacenar las URLs de los archivos subidos y los nuevos campos:

- `full_name` (text) - Nombre completo del dealer
- `birth_date` (date) - Fecha de nacimiento
- `cedula_number` (text) - Numero de cedula
- `selfie_url` (text) - URL de la selfie con cedula
- `cedula_front_url` (text) - URL foto frontal de cedula
- `cedula_back_url` (text) - URL foto reverso de cedula
- `address_proof_url` (text) - URL comprobante de domicilio
- `instagram_url` (text) - Perfil de Instagram
- `terms_accepted` (boolean, default false) - Aceptacion de terminos

Se necesita un nuevo bucket de storage `dealer-documents` (privado) para almacenar los documentos sensibles, con RLS para que solo el usuario propietario y admins puedan acceder.

## Cambios en el Frontend

### Formulario Multi-Seccion (`DealerApply.tsx`)

El formulario se rediseñara con secciones claramente separadas:

1. **Datos Personales**: Nombre completo, fecha de nacimiento, numero de cedula, telefono, nombre del negocio, descripcion del negocio.

2. **Selfie de Verificacion**: Upload de foto sosteniendo la cedula, con instrucciones sobre buena iluminacion y legibilidad del documento.

3. **Cedula de Identidad**: Upload de foto frontal y reverso de la cedula, con indicaciones de que las fotos sean nitidas.

4. **Comprobante de Domicilio**: Upload de recibo de servicios publicos (luz, agua, internet, estado de cuenta bancaria) con antiguedad no mayor a 3 meses.

5. **Redes Sociales**: Campo para URL de Instagram con indicacion de que ayuda a verificar la trayectoria.

6. **Aceptacion de Terminos**: Checkbox obligatorio donde el dealer acepta las politicas de disputa y devoluciones.

Cada seccion de upload mostrara preview de la imagen seleccionada, indicadores de progreso de carga, y validaciones de formato/tamano de archivo.

### Panel Admin (seccion Dealers)

Actualizar la vista de solicitudes en `Admin.tsx` para mostrar todos los documentos subidos: links para ver/descargar la selfie, cedula (anverso/reverso) y comprobante de domicilio, ademas de los nuevos campos de datos personales, Instagram, etc.

## Detalles Tecnicos

### Migracion SQL

```sql
-- Nuevas columnas en dealer_applications
ALTER TABLE dealer_applications
  ADD COLUMN full_name text,
  ADD COLUMN birth_date date,
  ADD COLUMN cedula_number text,
  ADD COLUMN selfie_url text,
  ADD COLUMN cedula_front_url text,
  ADD COLUMN cedula_back_url text,
  ADD COLUMN address_proof_url text,
  ADD COLUMN instagram_url text,
  ADD COLUMN terms_accepted boolean NOT NULL DEFAULT false;

-- Bucket privado para documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('dealer-documents', 'dealer-documents', false);

-- RLS: usuarios suben sus propios documentos
CREATE POLICY "Users upload own docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'dealer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: usuarios ven sus propios documentos, admins ven todos
CREATE POLICY "Users and admins view docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dealer-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin')
  ));
```

### Flujo de Upload

Cada archivo se sube a `dealer-documents/{user_id}/{tipo}_{timestamp}.{ext}`. Se genera una URL firmada (signed URL) para que los admins puedan visualizar los documentos.

### Archivos a modificar

- **Nueva migracion SQL**: Agregar columnas y bucket
- **`src/pages/DealerApply.tsx`**: Rediseñar completamente con formulario multi-seccion, uploads de imagenes, previews, y validaciones
- **`src/pages/Admin.tsx`**: Actualizar la seccion "Dealers" para mostrar documentos KYV y datos adicionales del aplicante

### Validaciones

- Archivos: solo imagenes (JPG, PNG, WEBP), maximo 5MB por archivo
- Campos requeridos: nombre, cedula, telefono, negocio, selfie, cedula front/back, comprobante domicilio, aceptacion de terminos
- Instagram: validacion basica de formato URL
