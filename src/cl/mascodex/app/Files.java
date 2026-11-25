package cl.mascodex.app;

import android.content.*;
import android.database.*;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.*;

/** Entrega archivos temporales (foto de la cámara, copia) solo a quien reciba permiso. */
public class Files extends ContentProvider {
    static File dir(Context c) { File d = new File(c.getCacheDir(), "compartir"); d.mkdirs(); return d; }
    static Uri uri(String name) { return Uri.parse("content://cl.mascodex.app.files/" + Uri.encode(name)); }
    private File file(Uri u) throws FileNotFoundException {
        String n = u.getLastPathSegment();
        if (n == null || !n.matches("[\w-][\w.-]*")) throw new FileNotFoundException();
        return new File(dir(getContext()), n);
    }
    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri u) { return String.valueOf(u.getLastPathSegment()).endsWith(".jpg") ? "image/jpeg" : "text/plain"; }
    @Override public ParcelFileDescriptor openFile(Uri u, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(file(u), ParcelFileDescriptor.parseMode(mode));
    }
    @Override public Cursor query(Uri u, String[] p, String s, String[] a, String o) {
        MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        try { c.addRow(new Object[]{u.getLastPathSegment(), file(u).length()}); } catch (FileNotFoundException e) { /* vacío */ }
        return c;
    }
    @Override public Uri insert(Uri u, ContentValues v) { return null; }
    @Override public int delete(Uri u, String s, String[] a) { return 0; }
    @Override public int update(Uri u, ContentValues v, String s, String[] a) { return 0; }
}
