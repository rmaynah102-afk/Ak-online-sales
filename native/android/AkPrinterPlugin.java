package com.ak.hardware.sales;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.InetAddress;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "AkPrinter",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class AkPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int MAX_PRINT_BYTES = 1024 * 1024;

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "onBluetoothPermissionForList");
            return;
        }
        listPairedDevicesNow(call);
    }

    @PermissionCallback
    private void onBluetoothPermissionForList(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Bluetooth ခွင့်ပြုချက် မရရှိပါ။");
            return;
        }
        listPairedDevicesNow(call);
    }

    private void listPairedDevicesNow(PluginCall call) {
        try {
            BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
            BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
            if (adapter == null) {
                call.reject("ဤဖုန်းတွင် Bluetooth မရှိပါ။");
                return;
            }
            if (!adapter.isEnabled()) {
                call.reject("ဖုန်း Bluetooth ကို အရင်ဖွင့်ပါ။");
                return;
            }
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            JSArray devices = new JSArray();
            if (bonded != null) {
                for (BluetoothDevice device : bonded) {
                    JSObject item = new JSObject();
                    item.put("name", device.getName() == null ? "Bluetooth Printer" : device.getName());
                    item.put("address", device.getAddress());
                    devices.put(item);
                }
            }
            JSObject result = new JSObject();
            result.put("devices", devices);
            call.resolve(result);
        } catch (SecurityException e) {
            call.reject("Bluetooth ခွင့်ပြုချက် မရရှိပါ။");
        } catch (Exception e) {
            call.reject("Bluetooth စက်စာရင်း ဖတ်မရပါ: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printBluetooth(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "onBluetoothPermissionForPrint");
            return;
        }
        printBluetoothNow(call);
    }

    @PermissionCallback
    private void onBluetoothPermissionForPrint(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Bluetooth ခွင့်ပြုချက် မရရှိပါ။");
            return;
        }
        printBluetoothNow(call);
    }

    private void printBluetoothNow(final PluginCall call) {
        final String address = call.getString("address", "").trim();
        final byte[] bytes = decodePayload(call);
        if (address.isEmpty() || bytes == null) return;
        new Thread(() -> {
            BluetoothSocket socket = null;
            try {
                BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
                BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
                if (adapter == null || !adapter.isEnabled()) throw new IOException("Bluetooth ပိတ်ထားသည်။");
                BluetoothDevice device = adapter.getRemoteDevice(address);
                try {
                    socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                } catch (IOException secureError) {
                    if (socket != null) try { socket.close(); } catch (IOException ignored) {}
                    socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                }
                OutputStream output = socket.getOutputStream();
                output.write(bytes);
                output.flush();
                try { Thread.sleep(180); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                JSObject result = new JSObject();
                result.put("ok", true);
                result.put("bytesSent", bytes.length);
                call.resolve(result);
            } catch (SecurityException e) {
                call.reject("Bluetooth ခွင့်ပြုချက် မရရှိပါ။");
            } catch (Exception e) {
                call.reject("Bluetooth Printer သို့ ပို့မရပါ: " + e.getMessage());
            } finally {
                if (socket != null) try { socket.close(); } catch (IOException ignored) {}
            }
        }).start();
    }

    @PluginMethod
    public void printWifi(PluginCall call) {
        final String host = call.getString("host", "").trim();
        final Integer requestedPort = call.getInt("port");
        final int port = requestedPort == null ? 9100 : requestedPort;
        final byte[] bytes = decodePayload(call);
        if (bytes == null) return;
        if (host.isEmpty() || port < 1 || port > 65535) {
            call.reject("Wi-Fi Printer IP နှင့် Port မမှန်ပါ။");
            return;
        }
        new Thread(() -> {
            try {
                InetAddress address = InetAddress.getByName(host);
                if (!(address.isSiteLocalAddress() || address.isLinkLocalAddress()) ||
                    address.isLoopbackAddress() || address.isMulticastAddress()) {
                    throw new IOException("Printer ကို Local Network IP ဖြင့်သာ ချိတ်နိုင်သည်။");
                }
                try (Socket socket = new Socket()) {
                    socket.connect(new InetSocketAddress(address, port), 5000);
                    socket.setSoTimeout(5000);
                    OutputStream output = socket.getOutputStream();
                    output.write(bytes);
                    output.flush();
                }
                JSObject result = new JSObject();
                result.put("ok", true);
                result.put("bytesSent", bytes.length);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Wi-Fi Printer သို့ ပို့မရပါ: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void shareReceiptImage(PluginCall call) {
        String encoded = call.getString("data", "");
        String requestedName = call.getString("fileName", "AK-Receipt.png");
        String shareText = call.getString("text", "");
        if (encoded.isEmpty()) {
            call.reject("ဘောင်ချာပုံ Data မရှိပါ။");
            return;
        }
        final byte[] image;
        try {
            image = Base64.decode(encoded, Base64.DEFAULT);
            if (image.length == 0 || image.length > 5 * 1024 * 1024) {
                call.reject("ဘောင်ချာပုံ အရွယ်အစား မမှန်ပါ။ 5MB အောက်ထားပါ။");
                return;
            }
        } catch (IllegalArgumentException e) {
            call.reject("ဘောင်ချာပုံ Base64 မမှန်ပါ။");
            return;
        }

        String safeName = requestedName.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!safeName.toLowerCase().endsWith(".png")) safeName += ".png";
        final String finalName = safeName;
        try {
            File directory = new File(getContext().getCacheDir(), "ak-receipt-share");
            if (!directory.exists() && !directory.mkdirs()) {
                throw new IOException("ယာယီပုံသိမ်းရန် Folder မဖန်တီးနိုင်ပါ။");
            }
            File imageFile = new File(directory, finalName);
            try (FileOutputStream output = new FileOutputStream(imageFile)) {
                output.write(image);
                output.flush();
            }
            Uri imageUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                imageFile
            );
            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType("image/png");
            String shareText = call.getString("text", "");
            String shareTitle = call.getString("title", "AK Sale");
            sendIntent.putExtra(Intent.EXTRA_STREAM, imageUri);
            if (shareText != null && !shareText.trim().isEmpty()) {
                sendIntent.putExtra(Intent.EXTRA_TEXT, shareText);
                sendIntent.putExtra(Intent.EXTRA_SUBJECT, shareTitle == null ? "AK Sale" : shareTitle);
            }
            if (shareText != null && !shareText.trim().isEmpty()) sendIntent.putExtra(Intent.EXTRA_TEXT, shareText);
            sendIntent.setClipData(ClipData.newUri(
                getContext().getContentResolver(),
                "AK Sale receipt image",
                imageUri
            ));
            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().runOnUiThread(() -> {
                try {
                    Intent chooser = Intent.createChooser(sendIntent, "ပုံနှင့်စာသားကို Viber / အခြား App သို့ မျှဝေရန်");
                    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    getActivity().startActivity(chooser);
                    JSObject result = new JSObject();
                    result.put("ok", true);
                    result.put("fileName", finalName);
                    call.resolve(result);
                } catch (Exception e) {
                    call.reject("Share Menu ဖွင့်မရပါ: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            call.reject("ဘောင်ချာပုံ ပြင်ဆင်မရပါ: " + e.getMessage());
        }
    }

    private byte[] decodePayload(PluginCall call) {
        String encoded = call.getString("data", "");
        if (encoded.isEmpty()) {
            call.reject("Print data မရှိပါ။");
            return null;
        }
        try {
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            if (bytes.length == 0 || bytes.length > MAX_PRINT_BYTES) {
                call.reject("Print data အရွယ်အစား မမှန်ပါ။ 1MB အောက်ထားပါ။");
                return null;
            }
            return bytes;
        } catch (IllegalArgumentException e) {
            call.reject("Print data Base64 မမှန်ပါ။");
            return null;
        }
    }
}
