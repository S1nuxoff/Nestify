FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY JacRed.csproj .
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app/publish

# ── runtime ──────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

COPY --from=build /app/publish .

# Data directory with config and pre-built task lists
# Mount /app/Data as a persistent volume in Dokploy to keep the database
COPY Data ./Data
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 9117

ENTRYPOINT ["sh", "entrypoint.sh"]
