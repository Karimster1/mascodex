package cl.mascodex.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.*;
import android.widget.Toast;
import java.io.*;
import java.util.ArrayList;

/** Contenedor de la web de MascoDex: agrega cámara, galería y respaldo. */
public class MainActivity extends Activity {
    static final String HOME = "https://karimster1.github.io/mascodex/";
    static final int PICK = 1, SAVE = 2;
    private WebView web;
    private ValueCallback<Uri[]> pending;
    private Uri photo;
    private File backup;

    // La web usa navigator.share y descargas de blobs, que WebView no trae
    private static final String SHIM = "(()=>{if(window.__masco)return;window.__masco=1;"
        + "const send=async(f,n,share)=>{MascoAndroid.begin();const S=786432;"
        + "for(let i=0;i<f.size;i+=S){const u=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f.slice(i,i+S));});"
        + "MascoAndroid.chunk(u.slice(u.indexOf(',')+1));}MascoAndroid.end(n,share);};"
        + "navigator.canShare=d=>!!(d&&d.files&&d.files.length===1);"
        + "navigator.share=d=>send(d.files[0],d.files[0].name,true);"
        + "const click=HTMLAnchorElement.prototype.click;"
        + "HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){const n=this.download;fetch(this.href).then(r=>r.blob()).then(b=>send(b,n,false));}else click.call(this);};})()";

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) {
            String p = state.getString("photo"), b = state.getString("backup");
            if (p != null) photo = Uri.parse(p);
            if (b != null) backup = new File(b);
        }
        web = new WebView(this);
        web.setBackgroundColor(getColor(R.color.fondo));
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        s.setAllowFileAccess(false);
        web.addJavascriptInterface(new Bridge(), "MascoAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !r.getUrl().toString().startsWith(HOME); // solo MascoDex
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (url.startsWith(HOME)) v.evaluateJavascript(SHIM, null);
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) v.loadData("<meta name='viewport' content='width=device-width'><body style='background:#14161c;color:#fff;font:18px sans-serif;text-align:center;padding:40vh 24px 0'>"
                    + "<p>Para abrir MascoDex por primera vez necesitas internet. Con&#233;ctate y toca el bot&#243;n.</p><a style='color:#8a93ff;font-size:22px' href='" + HOME + "'>Reintentar</a>", "text/html", "utf-8");
            }
            @Override public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) { recreate(); return true; }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsConfirm(WebView v, String u, String m, JsResult r) {
                new AlertDialog.Builder(MainActivity.this).setMessage(m)
                    .setPositiveButton("Aceptar", (d, w) -> r.confirm())
                    .setNegativeButton("Cancelar", (d, w) -> r.cancel())
                    .setOnCancelListener(d -> r.cancel()).show();
                return true;
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pending != null) pending.onReceiveValue(null);
                pending = cb;
                photo = null;
                boolean image = false;
                for (String t : p.getAcceptTypes()) image |= t.startsWith("image");
                Intent i;
                if (image && p.isCaptureEnabled()) {
                    photo = Files.uri("foto-" + System.currentTimeMillis() + ".jpg");
                    i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, photo);
                    i.setClipData(ClipData.newRawUri("", photo));
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                } else {
                    i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType(image ? "image/*" : "*/*");
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                }
                try { startActivityForResult(i, PICK); }
                catch (Exception e) { pending = null; cb.onReceiveValue(null); say("No hay una app para abrir eso"); }
                return true;
            }
        });
        if (state == null || web.restoreState(state) == null) web.loadUrl(HOME);
        if (state == null) clean();
    }

    /** Borra fotos y copias temporales de sesiones anteriores. */
    private void clean() {
        File[] old = Files.dir(this).listFiles();
        if (old != null) for (File f : old) f.delete();
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == PICK && pending != null) {
            ArrayList<Uri> out = new ArrayList<>();
            if (res == RESULT_OK) {
                if (photo != null) out.add(photo);
                else if (data != null && data.getClipData() != null)
                    for (int i = 0; i < data.getClipData().getItemCount(); i++) out.add(data.getClipData().getItemAt(i).getUri());
                else if (data != null && data.getData() != null) out.add(data.getData());
            }
            pending.onReceiveValue(out.isEmpty() ? null : out.toArray(new Uri[0]));
            pending = null;
        }
        if (req == SAVE && res == RESULT_OK && data != null && backup != null) {
            try (OutputStream o = getContentResolver().openOutputStream(data.getData())) { copy(backup, o); say("Copia guardada"); }
            catch (Exception e) { say("No se pudo guardar la copia"); }
        }
    }

    @Override protected void onSaveInstanceState(Bundle b) {
        super.onSaveInstanceState(b);
        web.saveState(b);
        if (photo != null) b.putString("photo", photo.toString());
        if (backup != null) b.putString("backup", backup.getPath());
    }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }

    private void say(String m) { Toast.makeText(this, m, Toast.LENGTH_LONG).show(); }
    private static void copy(File f, OutputStream o) throws IOException {
        try (InputStream in = new FileInputStream(f)) { byte[] b = new byte[65536]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n); }
    }

    private class Bridge {
        private OutputStream out;
        private File tmp;
        @JavascriptInterface public synchronized void begin() throws IOException {
            if (out != null) out.close();
            tmp = new File(Files.dir(MainActivity.this), "parcial.tmp");
            out = new FileOutputStream(tmp);
        }
        @JavascriptInterface public synchronized void chunk(String b64) throws IOException { out.write(Base64.decode(b64, Base64.DEFAULT)); }
        @JavascriptInterface public synchronized void end(String name, boolean share) throws IOException {
            out.close(); out = null;
            File f = new File(Files.dir(MainActivity.this), name.replaceAll("[^\\w.-]", "_"));
            f.delete();
            if (!tmp.renameTo(f)) throw new IOException("copia");
            runOnUiThread(() -> { if (share) share(f); else save(f); });
        }
    }

    private void share(File f) {
        Uri u = Files.uri(f.getName());
        Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_STREAM, u).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        i.setClipData(ClipData.newRawUri("", u));
        startActivity(Intent.createChooser(i, "Enviar copia"));
    }

    private void save(File f) {
        if (Build.VERSION.SDK_INT >= 29) {
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, f.getName());
                v.put(MediaStore.MediaColumns.MIME_TYPE, "text/plain");
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                try (OutputStream o = getContentResolver().openOutputStream(u)) { copy(f, o); }
            } catch (Exception e) { say("No se pudo guardar la copia"); }
        } else {
            backup = f;
            startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("text/plain").putExtra(Intent.EXTRA_TITLE, f.getName()), SAVE);
        }
    }
}
