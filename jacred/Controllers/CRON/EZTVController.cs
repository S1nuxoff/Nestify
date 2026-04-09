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
    [Route("cron/eztv/[action]")]
    public class EZTVController : BaseController
    {
        static bool _parseWork = false;

        #region Parse
        public async Task<string> Parse(int page = 1)
        {
            if (_parseWork) return "work";
            _parseWork = true;

            try
            {
                for (int p = page; p <= page + 5; p++)
                {
                    string json = await HttpClient.Get(
                        $"https://eztv.re/api/get-torrents?page={p}&limit=100",
                        timeoutSeconds: 15
                    );
                    if (json == null) break;

                    var root = JsonConvert.DeserializeObject<EztvRoot>(json);
                    if (root?.torrents == null || root.torrents.Length == 0) break;

                    foreach (var t in root.torrents)
                    {
                        if (string.IsNullOrWhiteSpace(t.magnet_url)) continue;

                        DateTime createTime = t.date_released_unix > 0
                            ? DateTimeOffset.FromUnixTimeSeconds(t.date_released_unix).DateTime
                            : DateTime.Today;

                        int.TryParse(t.seeds, out int sid);
                        int.TryParse(t.peers, out int pir);
                        long.TryParse(t.size_bytes, out long sizeBytes);

                        int quality = 0;
                        string title = t.title ?? "";
                        string titleUp = title.ToUpper();
                        if (titleUp.Contains("2160P") || titleUp.Contains("4K")) quality = 2160;
                        else if (titleUp.Contains("1080P")) quality = 1080;
                        else if (titleUp.Contains("720P"))  quality = 720;

                        tParse.AddOrUpdate(new TorrentDetails()
                        {
                            trackerName = "eztv",
                            types       = new[] { "serial" },
                            url         = t.episode_url,
                            title       = title,
                            sid         = sid,
                            pir         = pir,
                            sizeName    = sizeBytes > 0 ? $"{sizeBytes / 1073741824.0:F2} GB" : "",
                            size        = sizeBytes / 1048576.0,
                            createTime  = createTime,
                            magnet      = t.magnet_url,
                            name        = t.show_name,
                            originalname = t.show_name,
                            relased     = createTime.Year,
                            quality     = quality,
                            videotype   = "sdr",
                        });
                    }
                }
            }
            catch (Exception e)
            {
                Console.WriteLine($"[EZTV] error: {e.Message}");
            }

            _parseWork = false;
            return "ok";
        }
        #endregion

        #region Models
        class EztvRoot { public EztvTorrent[] torrents { get; set; } }
        class EztvTorrent
        {
            public string title { get; set; }
            public string show_name { get; set; }
            public string magnet_url { get; set; }
            public string episode_url { get; set; }
            public string size_bytes { get; set; }
            public string seeds { get; set; }
            public string peers { get; set; }
            public long date_released_unix { get; set; }
        }
        #endregion
    }
}
