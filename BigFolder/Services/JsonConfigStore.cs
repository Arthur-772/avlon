using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using BigFolder.Models;

namespace BigFolder.Services;

public sealed class JsonConfigStore : IConfigStore
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true,
    };

    private readonly string _filePath;

    public JsonConfigStore(string? filePath = null)
    {
        var resolvedPath = filePath ?? Path.Combine(AppContext.BaseDirectory, "config.json");
        _filePath = Path.GetFullPath(resolvedPath);
        var directory = Path.GetDirectoryName(_filePath);
        Directory.CreateDirectory(directory!);
    }

    public AppConfig Load()
    {
        try
        {
            if (!File.Exists(_filePath))
            {
                return new AppConfig();
            }

            using var stream = new FileStream(_filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            return JsonSerializer.Deserialize<AppConfig>(stream, SerializerOptions) ?? new AppConfig();
        }
        catch (Exception ex) when (
            ex is IOException or NotSupportedException or UnauthorizedAccessException or JsonException)
        {
            return new AppConfig();
        }
    }

    public void Save(AppConfig config)
    {
        var tempPath = _filePath + ".tmp";
        using (var stream = new FileStream(
            tempPath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None))
        {
            JsonSerializer.Serialize(stream, config, SerializerOptions);
        }

        try
        {
            File.Move(tempPath, _filePath, overwrite: true);
        }
        catch
        {
            File.Delete(tempPath);
            throw;
        }
    }
}
