import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
// Bundle the complete Firebase Web compat SDK locally into the APK; avoid CDN-dependent startup.
window.firebase = firebase;
window.AKFirebaseAuthentication = FirebaseAuthentication;
