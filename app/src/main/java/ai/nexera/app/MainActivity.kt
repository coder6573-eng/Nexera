package ai.nexera.app

import android.app.Activity
import android.app.Dialog
import android.os.Bundle
import android.graphics.Color
import android.net.Uri
import android.text.Html
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
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
import java.net.URLEncoder
import java.util.concurrent.Executors
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class MainActivity : Activity() {
    private lateinit var root: FrameLayout
    private lateinit var appWebView: WebView
    private lateinit var secureKeys: SecureKeyStore
    private lateinit var assetLoader: WebViewAssetLoader
    private val networkExecutor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        secureKeys = SecureKeyStore(this)
        android.webkit.CookieManager.getInstance().setAcceptCookie(true)
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        window.statusBarColor = Color.rgb(251, 252, 249)
        window.navigationBarColor = Color.rgb(251, 252, 249)
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR

        root = FrameLayout(this)
        appWebView = buildWebView(exposeNativeBridge = true)
        root.addView(appWebView, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
        appWebView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    @Suppress("SetJavaScriptEnabled")
    private fun buildWebView(exposeNativeBridge: Boolean): WebView {
        return WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.allowFileAccessFromFileURLs = false
            settings.allowUniversalAccessFromFileURLs = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.javaScriptCanOpenWindowsAutomatically = exposeNativeBridge
            settings.setSupportMultipleWindows(exposeNativeBridge)
            webChromeClient = object : WebChromeClient() {
                override fun onCreateWindow(view: WebView?, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message?): Boolean {
                    if (!exposeNativeBridge || resultMsg == null) return false
                    return openAuthPopup(resultMsg)
                }
            }
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): android.webkit.WebResourceResponse? {
                    return if (exposeNativeBridge && request != null) assetLoader.shouldInterceptRequest(request.url) else null
                }
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    if (!exposeNativeBridge) return true
                    val uri = request?.url ?: return true
                    return uri.scheme != "https" || uri.host != "appassets.androidplatform.net"
                }
            }
            if (exposeNativeBridge) {
                addJavascriptInterface(NexeraBridge(), "NexeraNative")
            }
        }
    }

    private fun openAuthPopup(resultMsg: android.os.Message): Boolean {
        val popup = WebView(this).apply {
            android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.javaScriptCanOpenWindowsAutomatically = true
            settings.setSupportMultipleWindows(false)
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }
        val dialog = Dialog(this)
        dialog.setContentView(popup)
        dialog.setOnDismissListener {
            popup.stopLoading()
            popup.destroy()
        }
        popup.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): android.webkit.WebResourceResponse? {
                return if (request != null) assetLoader.shouldInterceptRequest(request.url) else null
            }
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                return uri.scheme != "https"
            }
        }
        popup.webChromeClient = object : WebChromeClient() {
            override fun onCloseWindow(window: WebView?) {
                dialog.dismiss()
            }
        }
        val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false
        transport.webView = popup
        resultMsg.sendToTarget()
        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        return true
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
                    require(provider.matches(Regex("[A-Za-z0-9_-]{1,40}"))) {
                        "Invalid provider identifier."
                    }
                    val apiKey = secureKeys.get(provider)
                    val kiloFreeModel = provider == "kilo" &&
                        (model == "kilo-auto/free" || model.endsWith(":free"))
                    val llmFaucetFree = provider == "llmfaucet"
                    val ovhAnonymousFree = provider == "ovh"
                    require(apiKey != null || kiloFreeModel || llmFaucetFree || ovhAnonymousFree) {
                        "No API key saved for this provider. Open Settings to add one, or choose a free route."
                    }

                    val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = 20000
                        readTimeout = 45000
                        doOutput = true
                        if (apiKey != null) setRequestProperty("Authorization", "Bearer $apiKey")
                        else if (llmFaucetFree) setRequestProperty("Authorization", "Bearer free")
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
        fun searchWeb(query: String, requestId: String) {
            networkExecutor.execute {
                try {
                    require(query.isNotBlank() && query.length <= 300) { "Enter a shorter search query." }
                    val encoded = URLEncoder.encode(query, "UTF-8")
                    val connection = (URL("https://html.duckduckgo.com/html/?q=$encoded")
                        .openConnection() as HttpURLConnection).apply {
                        requestMethod = "GET"
                        connectTimeout = 15000
                        readTimeout = 20000
                        setRequestProperty("User-Agent", "Mozilla/5.0 NexeraAI/1.0")
                        setRequestProperty("Accept", "text/html")
                    }
                    val status = connection.responseCode
                    if (status !in 200..299) error("Web search returned HTTP $status.")
                    val body = connection.inputStream.bufferedReader().use { it.readText() }
                    connection.disconnect()
                    val anchors = Regex(
                        """(?is)<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*>.*?</a>"""
                    ).findAll(body).take(6)
                    val results = JSONArray()
                    anchors.forEach { match ->
                        val tag = match.value
                        val href = Regex("""(?is)href=["']([^"']+)["']""")
                            .find(tag)?.groupValues?.get(1) ?: ""
                        val titleHtml = Regex("""(?is)>(.*?)</a>""")
                            .find(tag)?.groupValues?.get(1) ?: ""
                        val title = Html.fromHtml(titleHtml, Html.FROM_HTML_MODE_LEGACY)
                            .toString().replace(Regex("\\s+"), " ").trim()
                        val next = body.substring(match.range.last + 1)
                        val snippetHtml = Regex(
                            """(?is)<(?:a|div)[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>(.*?)</(?:a|div)>"""
                        ).find(next)?.groupValues?.get(1) ?: ""
                        val snippet = Html.fromHtml(snippetHtml, Html.FROM_HTML_MODE_LEGACY)
                            .toString().replace(Regex("\\s+"), " ").trim()
                        val parsedHref = if (href.startsWith("//")) "https:$href" else href
                        val parsedUri = Uri.parse(parsedHref)
                        val actualUrl = parsedUri.getQueryParameter("uddg") ?: parsedHref
                        if (title.isNotBlank() && actualUrl.startsWith("http")) {
                            results.put(JSONObject().put("title", title).put("url", actualUrl).put("snippet", snippet))
                        }
                    }
                    sendResult(requestId, JSONObject().put("content", results.toString()))
                } catch (e: Exception) {
                    sendResult(requestId, JSONObject().put("error", e.message ?: "Web search failed."))
                }
            }
        }

        @JavascriptInterface
        fun showPreview(html: String) {
            if (html.length > 2_000_000) return
            runOnUiThread { displayIsolatedPreview(html) }
        }

        @JavascriptInterface
        fun exportZip(projectName: String, filesJson: String) {
            networkExecutor.execute {
                try {
                    val files = JSONObject(filesJson)
                    val bytes = ByteArrayOutputStream()
                    ZipOutputStream(bytes).use { zip ->
                        val names = files.keys().asSequence()
                            .filter { it.matches(Regex("[A-Za-z0-9._-]{1,80}")) && !it.contains("..") }
                            .toList()
                        require(names.isNotEmpty()) { "There are no exportable project files." }
                        names.forEach { name ->
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