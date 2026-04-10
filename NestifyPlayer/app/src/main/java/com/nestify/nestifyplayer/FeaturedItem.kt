package com.nestify.nestifyplayer

data class FeaturedItem(
    val tmdbId: Int,
    val mediaType: String,        // "movie" or "tv"
    val title: String,
    val backdropUrl: String?,
    val posterUrl: String?,
    val genres: List<String>,
    val year: String,
    val rating: String,
    val overview: String = "",
)
