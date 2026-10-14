using BigFolder.Services;

namespace BigFolder.Models;

public sealed class AppConfig
{
    public List<FolderItem> Items { get; set; } = new();

    public double WindowLeft { get; set; } = 80;

    public double WindowTop { get; set; } = 80;

    public double WindowWidth { get; set; } = GridMetrics.CellSize * 3;

    public double WindowHeight { get; set; } = GridMetrics.CellSize * 3;
}
