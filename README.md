# Control de asistencia

App para marcar la asistencia de los invitados a un evento, buscando por nombre, apellido o DNI desde cualquier celular. Todos los dispositivos ven los cambios en el momento. Usa Firebase (Firestore, plan gratuito Spark).

## 1. Base de datos (Firebase)

1. En console.firebase.google.com: **Crear un proyecto** (sin Google Analytics), y dentro **Compilación → Firestore Database → Crear base de datos** (ubicación `southamerica-east1`, modo de producción).
2. Pestaña **Reglas**: pegá lo siguiente y **Publicar**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /asistentes/{doc} {
      allow read, write: if true;
    }
  }
}
```

3. **Configuración del proyecto (engranaje) → Tus apps → `</>` Web**: registrá la app y copiá `apiKey`, `projectId` y `appId`.

## 2. Variables de entorno

Copiá `.env.example` a `.env` (local) o cargalas en Vercel → Settings → Environment Variables:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

## 3. Cargar el listado (una sola vez)

1. Entrá a la app agregando `#cargar` a la dirección (`https://tu-app.vercel.app/#cargar`).
2. Elegí `listado/asistentes.json` y tocá **Cargar**. Se puede repetir sin duplicar gente ni perder las asistencias marcadas.

Si cambia el Excel: `python3 listado/generar_listado.py listado.xlsx > listado/asistentes.json` y volvés a cargarlo.

## 4. Publicar (GitHub + Vercel)

Igual que siempre: subís a GitHub, importás en Vercel, cargás las 3 variables y Deploy.

## Notas

- Las reglas dejan la base abierta (sin login): quien tenga la URL puede leer y escribir. Para un evento puntual está bien; después del evento borrá el proyecto en Firebase.
- Con la cuenta gratuita alcanza de sobra: 50.000 lecturas y 20.000 escrituras por día.
