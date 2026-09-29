import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

if (!config.apiKey || !config.projectId || !config.appId) {
  console.error(
    'Faltan variables VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID y/o VITE_FIREBASE_APP_ID. Revisá el archivo .env (local) o las variables de entorno en Vercel.'
  )
}

const app = initializeApp(config)

// Cache local: la lista queda guardada en el celular, así la búsqueda es instantánea
// y si se corta el wifi las marcas se guardan y se sincronizan solas al volver.
let db
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
} catch {
  db = getFirestore(app)
}

export { db }
