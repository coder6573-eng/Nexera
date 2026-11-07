package ai.nexera.app

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Toast
import android.content.ContentValues
import android.provider.MediaStore
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class MainActivity : Activity() {
    private lateinit var root: FrameLayout
    private lateinit var appWebView: WebView
    private lateinit var secureKeys: SecureKeyStore
    private val networkExecutor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        secureKeys = SecureKeyStore(this)

        window.statusBarColor = Color.rgb(251, 252, 249)
        window.navigationBarColor = Color.rgb(251, 252, 249)
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR

        root = FrameLayout(this)
        appWebView = buildWebView(exposeNativeBridge = true)
        root.addView(appWebView, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
        appWebView.loadUrl("file:///android_asset/www/index.html")
    }

    @Suppress("SetJavaScriptEnabled")
    private fun buildWebView(exposeNativeBridge: Boolean): WebView {
        return WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = exposeNativeBridge
            settings.allowContentAccess = false
            settings.allowFileAccessFromFileURLs = false
            settings.allowUniversalAccessFromFileURLs = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val scheme = request?.url?.scheme ?: return true
                    return if (exposeNativeBridge) scheme != "file" && scheme != "https" else true
                }
            }
            if (exposeNativeBridge) {
                addJavascriptInterface(NexeraBridge(), "NexeraNative")
            }
        }
    }

    private inner class NexeraBridge {
        @JavascriptInterface
        fun hasApiKey(provider: String): Boolean = try {
            secureKeys.get(provider) != null
        } catch (_: Exception) {
            false
        }

        @JavascriptInterface
        fun saveApiKey(provider: String, value: String): Boolean = try {
            secureKeys.put(provider, value)
            true
        } catch (_: Exception) {
            false
        }

        @JavascriptInterface
        fun deleteApiKey(provider: String): Boolean = try {
            secureKeys.delete(provider)
            true
        } catch (_: Exception) {
            false
        }

        @JavascriptInterface
        fun chat(provider: String, endpoint: String, model: String, messagesJson: String, requestId: String) {
            networkExecutor.execute {
                try {
                    require(endpoint.startsWith("https://", ignoreCase = true)) {
                        "Only HTTPS model endpoints are allowed."
                    }
                    require(model.isNotBlank() && model.length <= 160) { "Enter a valid model ID." }
                    val apiKey = secureKeys.get(provider)
                        ?: error("No API key saved for this provider. Open Settings to add one.")

                    val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = 20000
                        readTimeout = 90000
                        doOutput = true
                        setRequestProperty("Authorization", "Bearer $apiKey")
                        setRequestProperty("Content-Type", "application/json")
                        setRequestProperty("Accept", "application/json")
                    }

                    val payload = JSONObject()
                        .put("model", model)
                        .put("messages", JSONArray(messagesJson))
                        .put("temperature", 0.3)

                    connection.outputStream.use {
                        it.write(payload.toString().toByteArray(Charsets.UTF_8))
                    }

                    val status = connection.responseCode
                    val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                    val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                    connection.disconnect()

                    if (status !in 200..299) {
                        val detail = try {
                            JSONObject(body).optJSONObject("error")?.optString("message")
                                ?.takeIf { it.isNotBlank() }
                        } catch (_: Exception) { null }
                        error(detail ?: "The provider returned HTTP $status.")
                    }

                    val content = JSONObject(body)
                        .optJSONArray("choices")
                        ?.optJSONObject(0)
                        ?.optJSONObject("message")
                        ?.optString("content")
                        ?.takeIf { it.isNotBlank() }
                        ?: error("The model returned an empty response.")

                    sendResult(requestId, JSONObject().put("content", content))
                } catch (e: Exception) {
                    sendResult(requestId, JSONObject().put("error", e.message ?: "Model request failed."))
                }
            }
        }

        @JavascriptInterface
        fun showPreview(html: String) {
            runOnUiThread { displayIsolatedPreview(html) }
        }

        @JavascriptInterface
        fun exportZip(projectName: String, filesJson: String) {
            networkExecutor.execute {
                try {
                    val files = JSONObject(filesJson)
                    val bytes = ByteArrayOutputStream()
                    ZipOutputStream(bytes).use { zip ->
                        listOf("index.html", "style.css", "script.js").forEach { name ->
                            zip.putNextEntry(ZipEntry(name))
                            zip.write(files.optString(name, "").toByteArray(Charsets.UTF_8))
                            zip.closeEntry()
                        }
                    }

                    val safeName = projectName.replace(Regex("[^A-Za-z0-9_-]"), "-")
                        .ifBlank { "Nexera-project" }
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, "$safeName.zip")
                        put(MediaStore.Downloads.MIME_TYPE, "application/zip")
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        ?: error("Could not create the ZIP file in Downloads.")
                    contentResolver.openOutputStream(uri)?.use { it.write(bytes.toByteArray()) }
                        ?: error("Could not write the ZIP file.")
                    values.clear()
                    values.put(MediaStore.Downloads.IS_PENDING, 0)
                    contentResolver.update(uri, values, null, null)
                    runOnUiThread { Toast.makeText(this@MainActivity, "ZIP saved to Downloads", Toast.LENGTH_LONG).show() }
                } catch (e: Exception) {
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, e.message ?: "ZIP export failed", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun displayIsolatedPreview(html: String) {
        val preview = buildWebView(exposeNativeBridge = false).apply {
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = true
            }
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
        }
        val toolbar = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(12, 4, 12, 4)
            setBackgroundColor(Color.rgb(248, 250, 246))
        }
        val close = Button(this).apply {
            text = "Close preview"
            setOnClickListener {
                root.removeView(container)
                preview.destroy()
            }
        }
        toolbar.addView(close)
        container.addView(toolbar, LinearLayout.LayoutParams(-1, 54))
        container.addView(preview, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(container, FrameLayout.LayoutParams(-1, -1))
        preview.loadDataWithBaseURL("https://preview.invalid/", html, "text/html", "UTF-8", null)
    }

    private fun sendResult(requestId: String, result: JSONObject) {
        val encodedResult = JSONObject.quote(result.toString())
        val encodedId = JSONObject.quote(requestId)
        runOnUiThread {
            appWebView.evaluateJavascript(
                "window.onNexeraNativeResult && window.onNexeraNativeResult($encodedId, $encodedResult)",
                null
            )
        }
    }

    override fun onDestroy() {
        networkExecutor.shutdownNow()
        appWebView.destroy()
        super.onDestroy()
    }
}