package com.nestify.nestifyplayer

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.drawable.DrawableTransitionOptions

/** Poster (narrow) card adapter */
class MediaCardAdapter(
    private val items: List<TmdbItem>,
    private val onItemClick: (TmdbItem) -> Unit,
) : RecyclerView.Adapter<MediaCardAdapter.VH>() {

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val poster: ImageView = view.findViewById(R.id.card_poster)
        val title: TextView   = view.findViewById(R.id.card_title)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_media_card, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        Glide.with(holder.poster)
            .load(item.posterUrl ?: item.backdropUrl)
            .transition(DrawableTransitionOptions.withCrossFade(300))
            .centerCrop()
            .into(holder.poster)
        holder.title.text = item.title
        holder.itemView.setOnClickListener { onItemClick(item) }
        holder.itemView.setOnFocusChangeListener { v, focused ->
            v.animate().scaleX(if (focused) 1.08f else 1f).scaleY(if (focused) 1.08f else 1f).setDuration(120).start()
        }
    }

    override fun getItemCount() = items.size
}

/** Backdrop (wide) card adapter */
class BackdropCardAdapter(
    private val items: List<TmdbItem>,
    private val onItemClick: (TmdbItem) -> Unit,
) : RecyclerView.Adapter<BackdropCardAdapter.VH>() {

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val backdrop: ImageView = view.findViewById(R.id.card_backdrop)
        val title: TextView     = view.findViewById(R.id.card_title)
        val meta: TextView      = view.findViewById(R.id.card_meta)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_backdrop_card, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        Glide.with(holder.backdrop)
            .load(item.backdropUrl ?: item.posterUrl)
            .transition(DrawableTransitionOptions.withCrossFade(300))
            .centerCrop()
            .into(holder.backdrop)
        holder.title.text = item.title
        holder.meta.text = listOfNotNull(
            item.year.takeIf { it.isNotEmpty() },
            item.rating.takeIf { it.isNotEmpty() }?.let { "★ $it" },
        ).joinToString("  ·  ")
        holder.itemView.setOnClickListener { onItemClick(item) }
        holder.itemView.setOnFocusChangeListener { v, focused ->
            v.animate().scaleX(if (focused) 1.05f else 1f).scaleY(if (focused) 1.05f else 1f).setDuration(120).start()
        }
    }

    override fun getItemCount() = items.size
}

/** Continue-watching card adapter */
class ContinueCardAdapter(
    private val items: List<HistoryItem>,
    private val onItemClick: (HistoryItem) -> Unit,
) : RecyclerView.Adapter<ContinueCardAdapter.VH>() {

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val backdrop: ImageView           = view.findViewById(R.id.continue_backdrop)
        val title: TextView               = view.findViewById(R.id.continue_title)
        val progress: android.widget.ProgressBar = view.findViewById(R.id.continue_progress)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_continue_card, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        Glide.with(holder.backdrop)
            .load(item.backdropUrl ?: item.posterUrl)
            .transition(DrawableTransitionOptions.withCrossFade(300))
            .centerCrop()
            .into(holder.backdrop)
        holder.title.text = item.title
        val pct = if (item.duration > 0) (item.positionSeconds * 100 / item.duration).coerceIn(0, 100) else 0
        holder.progress.progress = pct
        holder.itemView.setOnClickListener { onItemClick(item) }
        holder.itemView.setOnFocusChangeListener { v, focused ->
            v.animate().scaleX(if (focused) 1.05f else 1f).scaleY(if (focused) 1.05f else 1f).setDuration(120).start()
        }
    }

    override fun getItemCount() = items.size
}
