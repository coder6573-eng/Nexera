package ai.nexera.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Encrypts provider credentials with an AES key that never leaves Android Keystore. */
class SecureKeyStore(context: Context) {
    private val preferences = context.getSharedPreferences("nexera_encrypted_credentials", Context.MODE_PRIVATE)
    private val keyAlias = "nexera_provider_key_v1"

    private fun encryptionKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(keyAlias, null) as? SecretKey)?.let { return it }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                keyAlias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    fun put(provider: String, value: String) {
        require(provider.matches(Regex("[A-Za-z0-9_-]{1,40}"))) { "Invalid provider identifier." }
        require(value.isNotBlank() && value.length <= 4096) { "API key is empty or too long." }

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, encryptionKey())
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        val packed = cipher.iv + encrypted
        preferences.edit().putString(provider, Base64.encodeToString(packed, Base64.NO_WRAP)).apply()
    }

    fun get(provider: String): String? {
        val packedText = preferences.getString(provider, null) ?: return null
        val packed = Base64.decode(packedText, Base64.NO_WRAP)
        require(packed.size > 12) { "Stored credential is invalid." }
        val iv = packed.copyOfRange(0, 12)
        val ciphertext = packed.copyOfRange(12, packed.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), GCMParameterSpec(128, iv))
        return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
    }

    fun delete(provider: String) {
        preferences.edit().remove(provider).apply()
    }
}