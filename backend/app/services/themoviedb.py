import requests


def get_themoviedb_movie(title: str, id: str):
    # URL запроса
    url = "https://api.themoviedb.org/3/search/movie"
    api_key = "4ef0d7355d9ffb5151e987764708ce96"
    # api_key = "9d3be13246fa877d86f762d81d186b51"
    language = "ru"
    # Параметры запроса
    if id:
        find_url = f"https://api.themoviedb.org/3/find/{id}"
        find_params = {
            "api_key": api_key,
            "language": language,
            "external_source": "imdb_id",
        }
        r_find = requests.get(find_url, params=find_params)
        if r_find.status_code != 200:
            return "2000"
        find_data = r_find.json()

        if not find_data:
            return "nema daty"
        else:
            movie_data = find_data["movie_results"]
            return movie_data
    else:
        params = {
            "query": title,  # Название фильма
            "api_key": api_key,  # Твой ключ API
            "language": language,  # Язык ответа
            "append_to_response": "content_ratings,release_dates,external_ids,keywords,alternative_titles",  # Дополнительная информация
        }

    response = requests.get(url, params=params)
    if response.status_code == 200:
        # Если запрос успешен, возвращаем данные о фильме
        movie_data = response.json()
        if movie_data["results"]:
            return movie_data["results"][0]  # Возвращаем первый фильм из результатов
        else:
            return None
    else:
        return None
