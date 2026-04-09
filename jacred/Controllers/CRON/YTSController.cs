using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using JacRed.Engine;
using JacRed.Engine.CORE;
using JacRed.Engine.Parse;
using JacRed.Models.tParse;

namespace JacRed.Controllers.CRON
{
    [Route("cron/yts/[action]")]
    public class YTSController : BaseController
    {
        static bool _parseWork = false;

        #region Parse
        public async Task<string> Parse(int page = 1)
        {
            if (_parseWork) return "work";
            _parseWork = true;

            try
            {
                for (int p = page; p <= page + 10; p++)
                {
                    string json = await HttpClient.Get(
                        $"https://yts.mx/api/v2/list_movies.json?page={p}&limit=50&sort_by=date_added&order_by=desc",
                        timeoutSeconds: 15
                    );
                    if (json == null) break;

                    var root = JsonConvert.DeserializeObject<YtsRoot>(json);
                    if (root?.data?.movies == null || root.data.movies.Length == 0) break;

                    foreach (var movie in root.data.movies)
                    {
                        if (movie.torrents == null) continue;

                        foreach (var torrent in movie.torrents)
                        {
                            if (string.IsNullOrWhiteSpace(torrent.hash)) continue;

                            string magnet = $"magnet:?xt=urn:btih:{torrent.hash.ToLower()}" +
                                $"&dn={Uri.EscapeDataString(movie.title_long)}" +
                                "&tr=udp://open.demonii.com:1337/announce" +
                                "&tr=udp://tracker.openbittorrent.com:80" +
                                "&tr=udp://tracker.coppersurfer.tk:6969" +
                                "&tr=udp://tracker.opentrackr.org:1337/announce";

                            int quality = torrent.quality switch {
                                "2160p" => 2160,
                                "1080p" => 1080,
                                "720p"  => 720,
                                _       => 480
                            };

                            string title = $"{movie.title_long} [{torrent.quality} {torrent.type}] [YTS]";

                            DateTime createTime = movie.date_uploaded_unix > 0
                                ? DateTimeOffset.FromUnixTimeSeconds(movie.date_uploaded_unix).DateTime
                                : DateTime.Today;

                            tParse.AddOrUpdate(new TorrentDetails()
                            {
                                trackerName = "yts",
                                types       = new[] { "movie" },
                                url         = movie.url,
                                title       = title,
                                sid         = torrent.seeds,
                                pir         = torrent.peers,
                                sizeName    = torrent.size,
                                size        = torrent.size_bytes / 1048576.0,
                                createTime  = createTime,
                                magnet      = magnet,
                                name        = movie.title,
                                originalname = movie.title,
                                relased     = movie.year,
                                quality     = quality,
                                videotype   = "sdr",
                            });
                        }
                    }
                }
            }
            catch (Exception e)
            {
                Console.WriteLine($"[YTS] error: {e.Message}");
            }

            _parseWork = false;
            return "ok";
        }
        #endregion

        #region Models
        class YtsRoot { public YtsData data { get; set; } }
        class YtsData { public YtsMovie[] movies { get; set; } }
        class YtsMovie
        {
            public string title { get; set; }
            public string title_long { get; set; }
            public string url { get; set; }
            public int year { get; set; }
            public long date_uploaded_unix { get; set; }
            public YtsTorrent[] torrents { get; set; }
        }
        class YtsTorrent
        {
            public string hash { get; set; }
            public string quality { get; set; }
            public string type { get; set; }
            public string size { get; set; }
            public long size_bytes { get; set; }
            public int seeds { get; set; }
            public int peers { get; set; }
        }
        #endregion
    }
}
