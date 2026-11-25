import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';
// Bundled locally into the APK to avoid runtime CDN dependency.
window.firebase = firebase;
