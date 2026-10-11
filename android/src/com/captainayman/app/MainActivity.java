package com.captainayman.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Captain Ayman: the website inside a WebView, with screenshots and screen recording blocked
 * (FLAG_SECURE). Every site update shows up here automatically — only changes to this shell
 * (icon, name, reminders, screenshot blocking) need a new APK; bump android/VERSION for those.
 */
public class MainActivity extends Activity {
    static final String HOST = "captain-ayman.vercel.app";
    static final String HOME = "https://" + HOST + "/";
    /** Must match android/VERSION (first number) — the site offers an update to older apps. */
    static final int VERSION = 1;
    static final String EXTRA_PATH = "path";

    private static final int FILE_REQUEST = 41;
    private static final int NOTIFY_REQUEST = 42;

    private WebView web;
    private View offline;
    private ValueCallback<Uri[]> filePick;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        // No screenshots, no screen recording, blank preview in the app switcher.
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        setContentView(R.layout.main);

        web = findViewById(R.id.web);
        offline = findViewById(R.id.offline);
        findViewById(R.id.retry).setOnClickListener(v -> {
            offline.setVisibility(View.GONE);
            web.reload();
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " CaptainAymanApp/" + VERSION);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, false);

        web.addJavascriptInterface(new Bridge(), "CaptainAymanApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        String url = state != null ? state.getString("url") : null;
        web.loadUrl(url != null ? url : startUrl(getIntent()));
    }

    /** The page to open: a site link the app was launched with, a reminder's page, or the home page. */
    private String startUrl(Intent intent) {
        if (intent != null) {
            Uri data = intent.getData();
            if (data != null && isOurs(data)) return data.toString();
            String path = intent.getStringExtra(EXTRA_PATH);
            if (path != null && path.startsWith("/")) return HOME + path.substring(1);
        }
        return HOME;
    }

    static boolean isOurs(Uri u) {
        return "https".equals(u.getScheme()) && HOST.equals(u.getHost());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent.getData() != null || intent.hasExtra(EXTRA_PATH)) web.loadUrl(startUrl(intent));
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web.getUrl() != null) out.putString("url", web.getUrl());
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush(); // keep the client signed in
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private void openOutside(Uri uri) {
        try {
            Intent i = "intent".equals(uri.getScheme())
                    ? Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
                    : new Intent(Intent.ACTION_VIEW, uri);
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(i);
        } catch (Exception ignored) {
            // nothing on the phone can open it
        }
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            // Our pages stay in the app; the APK (an update) and every other site open outside.
            if (isOurs(u) && (u.getPath() == null || !u.getPath().endsWith(".apk"))) return false;
            openOutside(u);
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            CookieManager.getInstance().flush();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) offline.setVisibility(View.VISIBLE);
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (filePick != null) filePick.onReceiveValue(null);
            filePick = callback;
            Intent picker = params.createIntent();
            if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(picker, FILE_REQUEST);
                return true;
            } catch (ActivityNotFoundException e) {
                filePick = null;
                return false;
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_REQUEST || filePick == null) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        Uri[] picked = null;
        if (resultCode == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) {
                picked = new Uri[clip.getItemCount()];
                for (int i = 0; i < picked.length; i++) picked[i] = clip.getItemAt(i).getUri();
            } else if (data.getData() != null) {
                picked = new Uri[] {data.getData()};
            }
        }
        filePick.onReceiveValue(picked);
        filePick = null;
    }

    /** Asks once (Android 13+) for permission to show meal reminders. */
    private void askForNotifications() {
        if (Build.VERSION.SDK_INT < 33) return;
        if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED) return;
        SharedPreferences p = getSharedPreferences(MealReminders.PREFS, MODE_PRIVATE);
        if (p.getBoolean("asked", false)) return;
        p.edit().putBoolean("asked", true).apply();
        requestPermissions(new String[] {"android.permission.POST_NOTIFICATIONS"}, NOTIFY_REQUEST);
    }

    /** window.CaptainAymanApp in the page (see src/components/client/app-bridge.tsx). */
    private class Bridge {
        @JavascriptInterface
        public void setMealReminders(String json) {
            boolean any = MealReminders.update(getApplicationContext(), json);
            if (any) runOnUiThread(MainActivity.this::askForNotifications);
        }

        @JavascriptInterface
        public String version() {
            return String.valueOf(VERSION);
        }
    }
}
