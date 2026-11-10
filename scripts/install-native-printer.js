'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const packageName = config.appId;
if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName)) {
  throw new Error('Invalid Capacitor appId: ' + packageName);
}
const packagePath = packageName.split('.').join(path.sep);
const javaDir = path.join(root, 'android', 'app', 'src', 'main', 'java', packagePath);
fs.mkdirSync(javaDir, { recursive: true });
fs.copyFileSync(path.join(root, 'native', 'android', 'AkPrinterPlugin.java'), path.join(javaDir, 'AkPrinterPlugin.java'));

const javaMain = path.join(javaDir, 'MainActivity.java');
const kotlinMain = path.join(javaDir, 'MainActivity.kt');
if (fs.existsSync(javaMain)) {
  let source = fs.readFileSync(javaMain, 'utf8');
  if (!source.includes('AkPrinterPlugin.class')) {
    if (!source.includes('import com.getcapacitor.BridgeActivity;')) {
      source = source.replace(/(package [^;]+;)/, '$1\n\nimport com.getcapacitor.BridgeActivity;');
    }
    source = source.replace('import com.getcapacitor.BridgeActivity;', 'import com.getcapacitor.BridgeActivity;\nimport ' + packageName + '.AkPrinterPlugin;');
    const classStart = /public class MainActivity extends BridgeActivity\s*\{/;
    if (!classStart.test(source)) throw new Error('Unexpected MainActivity.java template; plugin was not registered.');
    source = source.replace(classStart, '$&\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(AkPrinterPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n');
    fs.writeFileSync(javaMain, source);
  }
} else if (fs.existsSync(kotlinMain)) {
  let source = fs.readFileSync(kotlinMain, 'utf8');
  if (!source.includes('AkPrinterPlugin::class.java')) {
    source = source.replace(/import com.getcapacitor.BridgeActivity/, 'import com.getcapacitor.BridgeActivity\nimport ' + packageName + '.AkPrinterPlugin');
    const classStart = /class MainActivity : BridgeActivity\(\)\s*\{/;
    if (!classStart.test(source)) throw new Error('Unexpected MainActivity.kt template; plugin was not registered.');
    source = source.replace(classStart, '$&\n    override fun onCreate(savedInstanceState: android.os.Bundle?) {\n        registerPlugin(AkPrinterPlugin::class.java)\n        super.onCreate(savedInstanceState)\n    }\n');
    fs.writeFileSync(kotlinMain, source);
  }
} else {
  throw new Error('Capacitor MainActivity.java/kt was not generated at ' + javaDir);
}

const manifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
const permissions = [
  '    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />',
  '    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />',
  '    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />',
  '    <uses-permission android:name="android.permission.CAMERA" />',
  '    <uses-feature android:name="android.hardware.camera.any" android:required="false" />',
  '    <uses-feature android:name="android.hardware.bluetooth" android:required="false" />'
];
for (const item of permissions) {
  const key = item.match(/android:name="([^"]+)"/)[1];
  if (!manifest.includes('android:name="' + key + '"')) {
    manifest = manifest.replace(/<application\b/, item + '\n    <application');
  }
}
const xmlDir = path.join(root, 'android', 'app', 'src', 'main', 'res', 'xml');
fs.mkdirSync(xmlDir, { recursive: true });
fs.writeFileSync(path.join(xmlDir, 'ak_file_paths.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<paths xmlns:android="http://schemas.android.com/apk/res/android">\n' +
  '    <cache-path name="ak_receipt_share" path="ak-receipt-share/" />\n' +
  '</paths>\n'
);

if (!manifest.includes('androidx.core.content.FileProvider')) {
  const provider = '    <provider\n' +
    '        android:name="androidx.core.content.FileProvider"\n' +
    '        android:authorities="' + packageName + '.fileprovider"\n' +
    '        android:exported="false"\n' +
    '        android:grantUriPermissions="true">\n' +
    '        <meta-data\n' +
    '            android:name="android.support.FILE_PROVIDER_PATHS"\n' +
    '            android:resource="@xml/ak_file_paths" />\n' +
    '    </provider>\n';
  if (!manifest.includes('</application>')) throw new Error('Android application closing tag not found');
  manifest = manifest.replace('</application>', provider + '</application>');
}

fs.writeFileSync(manifestPath, manifest);
console.log('AK Printer bridge installed: Bluetooth Classic SPP + Wi-Fi RAW TCP 9100 + receipt image sharing.');
