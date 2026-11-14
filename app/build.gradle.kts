plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "ai.nexera.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "ai.nexera.app"
        minSdk = 29
        targetSdk = 35
        versionCode = 28
        versionName = "19.3.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.webkit:webkit:1.15.0")
}
