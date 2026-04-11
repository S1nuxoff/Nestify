package com.nestify.nestifyplayer

import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

data class HomeSection(
    val title: String,
    val items: List<TmdbItem>,
    val wide: Boolean,   // true = backdrop card, false = poster card
)

data class HomeData(
    val featured: List<FeaturedItem>,
    val sections: List<HomeSection>,
)

object HomeDataSource {

    // In-memory cache per category (same pattern as the website's pageCache)
    private val cache = mutableMapOf<String, HomeData>()

    fun clearCache() = cache.clear()

    suspend fun load(category: String): HomeData {
        cache[category]?.let { return it }
        val data = fetch(category)
        cache[category] = data
        return data
    }

    private suspend fun fetch(category: String): HomeData = coroutineScope {
        when (category) {
            "all" -> {
                val trendingD   = async { TmdbClient.trending("week") }
                val monthlyD    = async { TmdbClient.monthlyTrending("all") }
                val pmD         = async { TmdbClient.popularMovies() }
                val ptvD        = async { TmdbClient.popularTv() }
                val npD         = async { TmdbClient.nowPlaying() }
                val tmD         = async { TmdbClient.topRated("movie") }
                val ttvD        = async { TmdbClient.topRated("tv") }
                val onAirD      = async { TmdbClient.onTheAir() }

                val trending = trendingD.await()
                val monthly  = monthlyD.await()
                val pm       = pmD.await()
                val ptv      = ptvD.await()
                val np       = npD.await()
                val tm       = tmD.await()
                val ttv      = ttvD.await()
                val onAir    = onAirD.await()

                val featured = buildFeatured(trending.take(8))

                val topMix = (tm.map { it.copy(mediaType = "movie") } + ttv.map { it.copy(mediaType = "tv") })
                    .sortedByDescending { it.rating }
                    .take(20)

                HomeData(
                    featured = featured,
                    sections = listOf(
                        HomeSection("Тренд місяця",         monthly,  wide = true),
                        HomeSection("Найкраще за весь час", topMix,   wide = false),
                        HomeSection("Зараз в кіно",         np,       wide = true),
                        HomeSection("Популярні серіали",    ptv,      wide = false),
                        HomeSection("Серіали в ефірі",      onAir,    wide = true),
                        HomeSection("Популярні фільми",     pm,       wide = false),
                    ),
                )
            }

            "movies" -> {
                val trendingD  = async { TmdbClient.trending("week") }
                val monthlyD   = async { TmdbClient.monthlyTrending("movie") }
                val npD        = async { TmdbClient.nowPlaying() }
                val pmD        = async { TmdbClient.popularMovies() }
                val tmD        = async { TmdbClient.topRated("movie") }
                val upcomingD  = async {
                    TmdbClient.discover("movie", mapOf(
                        "sort_by" to "release_date.desc",
                        "primary_release_date.gte" to "2024-01-01"
                    ))
                }

                val trending = trendingD.await().filter { it.mediaType == "movie" }
                val monthly  = monthlyD.await()
                val np       = npD.await()
                val pm       = pmD.await()
                val tm       = tmD.await()
                val upcoming = upcomingD.await()

                val featuredSrc = trending.ifEmpty { pm.map { it.copy(mediaType = "movie") } }
                val featured = buildFeatured(featuredSrc.take(8))

                HomeData(
                    featured = featured,
                    sections = listOf(
                        HomeSection("Тренд місяця",         monthly,  wide = true),
                        HomeSection("Найкраще за весь час", tm,       wide = false),
                        HomeSection("Зараз в кіно",         np,       wide = true),
                        HomeSection("Нові фільми",          upcoming, wide = false),
                    ),
                )
            }

            "tv" -> {
                val trendingD  = async { TmdbClient.trending("week") }
                val monthlyD   = async { TmdbClient.monthlyTrending("tv") }
                val ptvD       = async { TmdbClient.popularTv() }
                val ttvD       = async { TmdbClient.topRated("tv") }
                val onAirD     = async { TmdbClient.onTheAir() }

                val trending = trendingD.await().filter { it.mediaType == "tv" }
                val monthly  = monthlyD.await()
                val ptv      = ptvD.await()
                val ttv      = ttvD.await()
                val onAir    = onAirD.await()

                val featuredSrc = trending.ifEmpty { ptv.map { it.copy(mediaType = "tv") } }
                val featured = buildFeatured(featuredSrc.take(8))

                HomeData(
                    featured = featured,
                    sections = listOf(
                        HomeSection("Тренд місяця",             monthly,  wide = true),
                        HomeSection("Найкраще за весь час",     ttv,      wide = false),
                        HomeSection("Зараз в ефірі",            onAir,    wide = true),
                        HomeSection("В тренді цього тижня",     trending, wide = false),
                    ),
                )
            }

            "animation" -> {
                val since = run {
                    val c = java.util.Calendar.getInstance()
                    c.add(java.util.Calendar.DAY_OF_YEAR, -30)
                    "${c.get(java.util.Calendar.YEAR)}-${String.format("%02d", c.get(java.util.Calendar.MONTH)+1)}-${String.format("%02d", c.get(java.util.Calendar.DAY_OF_MONTH))}"
                }
                val animMD     = async { TmdbClient.discover("movie", mapOf("with_genres" to "16")) }
                val animTvD    = async { TmdbClient.discover("tv",    mapOf("with_genres" to "16")) }
                val topAnimD   = async { TmdbClient.discover("movie", mapOf("with_genres" to "16", "sort_by" to "vote_average.desc", "vote_count.gte" to "300")) }
                val topAnimTvD = async { TmdbClient.discover("tv",    mapOf("with_genres" to "16", "sort_by" to "vote_average.desc", "vote_count.gte" to "300")) }
                val animMonthD = async { TmdbClient.discover("movie", mapOf("with_genres" to "16", "sort_by" to "popularity.desc", "primary_release_date.gte" to since)) }

                val animM     = animMD.await().map { it.copy(mediaType = "movie") }
                val animTv    = animTvD.await().map { it.copy(mediaType = "tv") }
                val topAnim   = topAnimD.await()
                val topAnimTv = topAnimTvD.await()
                val animMonth = animMonthD.await()

                val featured = buildFeatured((animM + animTv).take(8))

                HomeData(
                    featured = featured,
                    sections = listOf(
                        HomeSection("Тренд місяця",         animMonth, wide = true),
                        HomeSection("Топ мультсеріали",     topAnimTv, wide = false),
                        HomeSection("Популярні мультсеріали", animTv,  wide = true),
                        HomeSection("Топ мультфільми",      topAnim,   wide = false),
                    ),
                )
            }

            else -> HomeData(emptyList(), emptyList())
        }
    }

    private suspend fun buildFeatured(items: List<TmdbItem>): List<FeaturedItem> = coroutineScope {
        items.map { item -> async { TmdbClient.toFeaturedItem(item) } }
            .mapNotNull { it.await() }
    }
}
