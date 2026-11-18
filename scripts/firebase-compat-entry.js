import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/functions";

// Bundle Firebase into the APK so login does not depend on loading gstatic CDN scripts.
window.firebase = firebase;
