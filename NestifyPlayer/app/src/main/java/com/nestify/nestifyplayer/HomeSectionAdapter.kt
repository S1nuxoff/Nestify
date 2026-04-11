package com.nestify.nestifyplayer

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

class HomeSectionAdapter(
    private val sections: List<HomeSection>,
    private val onItemClick: (TmdbItem) -> Unit,
) : RecyclerView.Adapter<HomeSectionAdapter.VH>() {

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val title: TextView      = view.findViewById(R.id.section_title)
        val recycler: RecyclerView = view.findViewById(R.id.section_recycler)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_home_section, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val section = sections[position]
        holder.title.text = section.title

        val lm = LinearLayoutManager(holder.recycler.context, LinearLayoutManager.HORIZONTAL, false)
        holder.recycler.layoutManager = lm
        holder.recycler.setHasFixedSize(true)

        holder.recycler.adapter = if (section.wide) {
            BackdropCardAdapter(section.items, onItemClick)
        } else {
            MediaCardAdapter(section.items, onItemClick)
        }
    }

    override fun getItemCount() = sections.size
}
