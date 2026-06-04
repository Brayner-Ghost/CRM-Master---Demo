import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'firebase/app': path.resolve(__dirname, 'src/mockFirebase/app.js'),
      'firebase/firestore': path.resolve(__dirname, 'src/mockFirebase/firestore.js'),
      'firebase/auth': path.resolve(__dirname, 'src/mockFirebase/auth.js'),
      'firebase/storage': path.resolve(__dirname, 'src/mockFirebase/storage.js'),
      'firebase/functions': path.resolve(__dirname, 'src/mockFirebase/functions.js'),
    }
  }
})
