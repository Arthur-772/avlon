import com.android.apksig.ApkSigner;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

// Minimal CLI wrapper around the apksig library to produce v2/v3 signed APKs.
// Usage: java -cp apksig.jar;SignApk.jar SignApk <keystore> <storepass> <alias> <keypass> <input.apk> <output.apk>
public class SignApk {
    public static void main(String[] args) throws Exception {
        if (args.length < 6) {
            System.err.println("Usage: SignApk <keystore> <storepass> <alias> <keypass> <input> <output>");
            System.exit(1);
        }
        String ksPath   = args[0];
        String storePass = args[1];
        String alias    = args[2];
        String keyPass  = args[3];
        String inputApk = args[4];
        String outputApk = args[5];

        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream fis = new FileInputStream(ksPath)) {
            ks.load(fis, storePass.toCharArray());
        }

        PrivateKey privateKey = (PrivateKey) ks.getKey(alias, keyPass.toCharArray());
        X509Certificate cert = (X509Certificate) ks.getCertificate(alias);
        if (privateKey == null || cert == null) {
            System.err.println("Key or certificate not found for alias: " + alias);
            System.exit(1);
        }

        ApkSigner.SignerConfig signerConfig = new ApkSigner.SignerConfig.Builder(
            alias, privateKey, Collections.singletonList(cert)).build();

        ApkSigner apkSigner = new ApkSigner.Builder(Collections.singletonList(signerConfig))
            .setInputApk(new File(inputApk))
            .setOutputApk(new File(outputApk))
            .setOtherSignersSignaturesPreserved(false)
            .build();

        apkSigner.sign();
        System.out.println("Signed: " + outputApk);
    }
}
