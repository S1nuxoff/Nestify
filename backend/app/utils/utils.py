import requests
import re
import base64
import urllib.parse


def get_video_id_from_embed(url):
    # Используем регулярное выражение для извлечения ID видео из ссылки вида embed
    match = re.search(r"youtube\.com/embed/([a-zA-Z0-9_-]+)", url)
    if match:
        return match.group(1)  # Возвращаем ID видео
    return None


def check_video_exists(video_url):
    video_id = get_video_id_from_embed(video_url)
    if not video_id:
        return None  # Если не получилось извлечь ID, возвращаем None

    # Проверяем доступность через oembed
    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    response = requests.head(oembed_url)

    if response.status_code == 200:
        return video_url  # Видео доступно
    else:
        return None  # Видео недоступно


def get_imdb_id(url):
    encoded_url = url.split("/help/")[1].split("/")[0]
    decoded_url = base64.b64decode(encoded_url).decode("utf-8")
    decoded_url = urllib.parse.unquote(decoded_url)
    imdb_id = decoded_url.split("/title/")[1].split("/")[0]
    return imdb_id
