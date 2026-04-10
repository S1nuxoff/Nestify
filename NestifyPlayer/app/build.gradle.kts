plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.nestify.nestifyplayer"
    compileSdk {
        version = release(36)
    }

    signingConfigs {
        create("release") {
            storeFile = file("../nestify-release.jks")
            storePassword = "nestify123"
            keyAlias = "nestify"
            keyPassword = "nestify123"
        }
    }

    defaultConfig {
        applicationId = "com.nestify.nestifyplayer"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        setProperty("archivesBaseName", "NestifyPlayer-$versionName")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }

    buildTypes {
        debug {
            buildConfigField("String", "WS_BASE_URL", "\"ws://192.168.0.178:8000\"")
            buildConfigField("String", "BACKEND_BASE_URL", "\"http://192.168.0.178:8000\"")
            buildConfigField("String", "FRONTEND_BASE_URL", "\"http://192.168.0.178:5173\"")
        }
        release {
            buildConfigField("String", "WS_BASE_URL", "\"wss://api.opencine.cloud\"")
            buildConfigField("String", "BACKEND_BASE_URL", "\"https://api.opencine.cloud\"")
            buildConfigField("String", "FRONTEND_BASE_URL", "\"https://opencine.cloud\"")
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

dependencies {
    implementation("com.google.zxing:core:3.5.3")

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.activity:activity-ktx:1.9.1")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    implementation("androidx.media3:media3-exoplayer:1.5.0")
    implementation("androidx.media3:media3-ui:1.5.0")
    implementation("androidx.media3:media3-exoplayer:1.5.0")
    implementation("androidx.media3:media3-ui:1.5.0")
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.activity:activity-ktx:1.9.1")

    // ДОДАЛИ ОЦЕ:
    implementation("androidx.appcompat:appcompat:1.7.0")

    // ExoPlayer
    implementation("androidx.media3:media3-exoplayer:1.5.0")
    implementation("androidx.media3:media3-ui:1.5.0")
    implementation("org.nanohttpd:nanohttpd:2.3.1")
    // HTTP-клієнт
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
// JSON (можна й без нього через org.json, але так зручніше)
    implementation("com.squareup.moshi:moshi-kotlin:1.15.1")

// корутини
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

// картинки для постерів / аватарок
    implementation("com.github.bumptech.glide:glide:4.16.0")
    implementation("org.java-websocket:Java-WebSocket:1.5.6")
    implementation("androidx.viewpager2:viewpager2:1.1.0")
}