import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
// Keep the native Google authentication bridge bundled locally. Firebase Web Auth,
// Firestore and Functions compat SDKs are loaded using the 2.1.317 proven startup path.
window.AKFirebaseAuthentication = FirebaseAuthentication;
