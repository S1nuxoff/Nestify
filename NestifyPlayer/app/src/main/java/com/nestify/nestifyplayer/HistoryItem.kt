package com.nestify.nestifyplayer

data class HistoryItem(
    val movieId: String,       // "tmdb_movie_123" or "tmdb_tv_456"
    val tmdbId: Int,
    val mediaType: String,     // "movie" or "tv"
    val title: String,
    val posterUrl: String?,
    val backdropUrl: String?,
    val positionSeconds: Int,
    val duration: Int,
    val season: Int?,
    val episode: Int?,
)
