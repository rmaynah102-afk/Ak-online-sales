import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
// Bundled locally into the APK to avoid runtime CDN dependency.
window.firebase = firebase;
// Explicitly register the native Google authentication plugin in the WebView bundle.
window.AKFirebaseAuthentication = FirebaseAuthentication;
