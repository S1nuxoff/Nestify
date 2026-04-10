package com.nestify.nestifyplayer

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.drawable.DrawableTransitionOptions

class FeaturedSliderAdapter(
    private val items: List<FeaturedItem>,
    private val onItemClick: (FeaturedItem) -> Unit,
) : RecyclerView.Adapter<FeaturedSliderAdapter.SlideVH>() {

    inner class SlideVH(view: View) : RecyclerView.ViewHolder(view) {
        val backdrop: ImageView = view.findViewById(R.id.slide_backdrop)
        val title: TextView    = view.findViewById(R.id.slide_title)
        val meta: TextView     = view.findViewById(R.id.slide_meta)
        val genres: TextView   = view.findViewById(R.id.slide_genres)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SlideVH {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_featured_slide, parent, false)
        return SlideVH(view)
    }

    override fun onBindViewHolder(holder: SlideVH, position: Int) {
        val item = items[position]

        // Backdrop
        val imageUrl = item.backdropUrl ?: item.posterUrl
        if (imageUrl != null) {
            Glide.with(holder.backdrop)
                .load(imageUrl)
                .transition(DrawableTransitionOptions.withCrossFade(400))
                .centerCrop()
                .into(holder.backdrop)
        }

        // Title
        holder.title.text = item.title

        // Meta: year · rating
        val metaParts = listOfNotNull(
            item.year.takeIf { it.isNotEmpty() },
            item.rating.takeIf { it.isNotEmpty() }?.let { "★ $it" }
        )
        holder.meta.text = metaParts.joinToString("  ·  ")

        // Genres
        holder.genres.text = item.genres.joinToString("  ·  ")
        holder.genres.visibility = if (item.genres.isEmpty()) View.GONE else View.VISIBLE
        holder.itemView.setOnClickListener { onItemClick(item) }
    }

    override fun getItemCount() = items.size
}
