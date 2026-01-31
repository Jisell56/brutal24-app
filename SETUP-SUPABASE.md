# Guía Completa: Configurar Supabase para Brutal24

## Paso 1: Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Inicia sesión o crea una cuenta
3. Haz clic en **"New Project"**
4. Completa:
   - **Name**: `brutal24` (o el nombre que prefieras)
   - **Database Password**: Genera una contraseña segura (guárdala)
   - **Region**: Selecciona la más cercana a tus usuarios
5. Haz clic en **"Create new project"**
6. Espera 2-3 minutos mientras se configura

---

## Paso 2: Ejecutar el Script SQL

1. En tu proyecto de Supabase, ve al menú lateral
2. Haz clic en **"SQL Editor"**
3. Haz clic en **"New query"**
4. Copia TODO el contenido del archivo `/scripts/setup-database.sql`
5. Pégalo en el editor SQL
6. Haz clic en **"Run"** (o presiona Ctrl+Enter)
7. Deberías ver: `Success. No rows returned`

---

## Paso 3: Obtener las Credenciales

1. En el menú lateral, ve a **"Project Settings"** (icono de engranaje)
2. Haz clic en **"API"** en el submenú
3. Copia estos valores:

### Project URL
```
https://tu-proyecto.supabase.co
```
(Está en la sección "Project URL")

### Anon Public Key
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
(Está en la sección "Project API keys" → `anon` `public`)

---

## Paso 4: Configurar Variables de Entorno

### Opción A: En v0 (Recomendado)

1. En la barra lateral izquierda de v0, haz clic en **"Vars"**
2. Agrega estas dos variables:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Tu Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tu Anon Public Key |

### Opción B: Archivo .env.local (Para desarrollo local)

Crea un archivo `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Paso 5: Verificar la Configuración

### Verificar tablas creadas:
1. En Supabase, ve a **"Table Editor"**
2. Deberías ver estas tablas:
   - `posts`
   - `comments`
   - `anonymous_users`
   - `user_likes`
   - `notifications`

### Verificar RLS:
1. Ve a **"Authentication"** → **"Policies"**
2. Deberías ver políticas para cada tabla

### Verificar Realtime:
1. Ve a **"Database"** → **"Replication"**
2. En `supabase_realtime`, verifica que `posts` y `comments` estén habilitadas

---

## Paso 6: Probar la Aplicación

1. Recarga la aplicación en v0
2. Intenta crear un post
3. Verifica en Supabase → Table Editor → posts que se creó

---

## Estructura de las Tablas

### posts
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | ID único del post |
| user_id | TEXT | ID del usuario anónimo |
| username | TEXT | Nombre de usuario |
| content | TEXT | Contenido del post |
| image_url | TEXT | URL de imagen (opcional) |
| likes_count | INTEGER | Contador de likes |
| comments_count | INTEGER | Contador de comentarios |
| created_at | TIMESTAMP | Fecha de creación |
| expires_at | TIMESTAMP | Fecha de expiración (24h después) |

### comments
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | ID único |
| post_id | UUID | ID del post relacionado |
| user_id | TEXT | ID del usuario |
| username | TEXT | Nombre de usuario |
| content | TEXT | Contenido del comentario |
| parent_id | UUID | ID del comentario padre (para respuestas) |
| created_at | TIMESTAMP | Fecha de creación |

### anonymous_users
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | TEXT | ID único del usuario |
| username | TEXT | Nombre generado automáticamente |
| created_at | TIMESTAMP | Fecha de creación |

### user_likes
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | ID único |
| user_id | TEXT | ID del usuario |
| post_ids | TEXT[] | Array de IDs de posts con like |
| updated_at | TIMESTAMP | Última actualización |

---

## Solución de Problemas

### Error: "relation does not exist"
- El script SQL no se ejecutó correctamente
- Vuelve a ejecutar el script en SQL Editor

### Error: "permission denied"
- Las políticas RLS no están configuradas
- Verifica que las políticas existan en Authentication → Policies

### Los posts no aparecen en tiempo real
- Verifica que Realtime esté habilitado para la tabla `posts`
- Ve a Database → Replication y habilítalo

### Error de conexión
- Verifica que las variables de entorno estén correctas
- Asegúrate de usar `NEXT_PUBLIC_` como prefijo

---

## Comandos Útiles SQL

### Ver todos los posts:
```sql
SELECT * FROM posts ORDER BY created_at DESC;
```

### Eliminar posts expirados manualmente:
```sql
DELETE FROM posts WHERE expires_at < NOW();
```

### Ver usuarios registrados:
```sql
SELECT * FROM anonymous_users ORDER BY created_at DESC;
```

### Limpiar toda la base de datos (CUIDADO):
```sql
TRUNCATE posts, comments, anonymous_users, user_likes, notifications CASCADE;
```
